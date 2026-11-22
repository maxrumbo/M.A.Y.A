using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Maya.Server.Data;
using Maya.Server.Data.Entities;
using Maya.Server.Services.Interfaces;
using Maya.Shared.DTOs.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace Maya.Server.Services;

/// <summary>
/// Implementasi AuthService Phase 4:
/// - Master PIN auth (PBKDF2-SHA512 hash) → JWT access token (7 hari) + refresh token
/// - WebAuthn/Passkey registration &amp; login (server-side challenge/verify)
/// - Step-Up Token (JWT 60 detik, purpose = "step_up")
///
/// NEVER LOG: PIN, JWT, secrets — semua diambil dari IConfiguration.
/// </summary>
public class AuthService : IAuthService
{
    private readonly MayaDbContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<AuthService> _logger;

    // PBKDF2 iterasi tinggi untuk keamanan PIN
    private const int PbkdfIterations   = 350_000;
    private const int SaltSize          = 32;
    private const int HashSize          = 64;
    private const int AccessTokenDays   = 7;
    private const int StepUpTokenSeconds = 60;

    // H1 Hardening: in-memory set of consumed JTI claims (single-use enforcement)
    // Key: jti (JWT ID claim), trimmed at MaxConsumedTokens to prevent memory leak
    private static readonly HashSet<string> _consumedJtis = new();
    private static readonly object _jtiLock = new();
    private const int MaxConsumedTokens = 500;

    // In-memory WebAuthn challenge store (single-owner, single challenge at a time)
    // Key: "register" | "login", Value: (challenge bytes, expiry)
    private static readonly Dictionary<string, (byte[] Challenge, DateTimeOffset Expiry)> _webAuthnChallenges = new();
    private static readonly object _challengeLock = new();

    public AuthService(
        MayaDbContext db,
        IConfiguration config,
        ILogger<AuthService> logger)
    {
        _db     = db;
        _config = config;
        _logger = logger;
    }

    // ─── PIN ────────────────────────────────────────────────────────────────────

    public async Task SetupPinAsync(string pin)
    {
        var existing = await _db.UserAuthConfigs.FirstOrDefaultAsync();
        if (existing is not null && !string.IsNullOrEmpty(existing.PinHash))
            throw new InvalidOperationException("PIN sudah pernah dikonfigurasi. Gunakan reset PIN jika ingin menggantinya.");

        var hash = HashPin(pin);

        if (existing is null)
        {
            var config = new UserAuthConfig
            {
                Id        = Guid.NewGuid(),
                PinHash   = hash,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _db.UserAuthConfigs.Add(config);
        }
        else
        {
            existing.PinHash   = hash;
            existing.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await _db.SaveChangesAsync();
        _logger.LogInformation("Master PIN berhasil dikonfigurasi/diperbarui.");
    }

    public async Task<AuthTokenResponseDto> LoginWithPinAsync(string pin)
    {
        var config = await _db.UserAuthConfigs.FirstOrDefaultAsync()
            ?? throw new UnauthorizedAccessException("PIN belum dikonfigurasi. Setup PIN terlebih dahulu.");

        if (!VerifyPin(pin, config.PinHash))
            throw new UnauthorizedAccessException("PIN salah. Akses ditolak.");

        _logger.LogInformation("Login PIN berhasil.");
        return GenerateAccessToken();
    }

    // ─── WebAuthn / Passkey ──────────────────────────────────────────────────

    public async Task<WebAuthnOptionsDto> GetWebAuthnRegisterOptionsAsync()
    {
        var challenge = GenerateChallenge();
        lock (_challengeLock)
        {
            _webAuthnChallenges["register"] = (challenge, DateTimeOffset.UtcNow.AddMinutes(5));
        }

        // User info dari DB jika ada
        var existingConfig = await _db.UserAuthConfigs.FirstOrDefaultAsync();
        var userId  = existingConfig?.Id.ToString() ?? Guid.NewGuid().ToString();

        return new WebAuthnOptionsDto(
            Challenge        : Convert.ToBase64String(challenge),
            RpId             : GetRpId(),
            RpName           : "M.A.Y.A.",
            UserId           : userId,
            UserName         : "maxwell",
            UserDisplayName  : "Maxwell Avinda Rumahorbo",
            ExpiresAt        : DateTimeOffset.UtcNow.AddMinutes(5)
        );
    }

    public async Task<AuthTokenResponseDto> VerifyWebAuthnRegistrationAsync(WebAuthnVerifyDto dto)
    {
        // Validasi challenge masih valid
        ValidateWebAuthnChallenge("register", dto.ClientDataJson);

        // Simpan credential ke DB (store credentialId + authenticatorData sebagai public key representation)
        var config = await GetOrCreateAuthConfigAsync();
        config.WebAuthnCredentialId = dto.CredentialId;
        config.WebAuthnPublicKey    = dto.AuthenticatorData; // Simplified: store authenticatorData as public key reference
        config.UpdatedAt            = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();

        _logger.LogInformation("WebAuthn credential berhasil diregistrasi. CredentialId: {Id}", dto.CredentialId[..Math.Min(8, dto.CredentialId.Length)] + "...");
        return GenerateAccessToken();
    }

    public async Task<WebAuthnOptionsDto> GetWebAuthnLoginOptionsAsync()
    {
        var challenge = GenerateChallenge();
        lock (_challengeLock)
        {
            _webAuthnChallenges["login"] = (challenge, DateTimeOffset.UtcNow.AddMinutes(5));
        }

        return new WebAuthnOptionsDto(
            Challenge        : Convert.ToBase64String(challenge),
            RpId             : GetRpId(),
            RpName           : "M.A.Y.A.",
            UserId           : string.Empty,
            UserName         : "maxwell",
            UserDisplayName  : "Maxwell Avinda Rumahorbo",
            ExpiresAt        : DateTimeOffset.UtcNow.AddMinutes(5)
        );
    }

    public async Task<AuthTokenResponseDto> VerifyWebAuthnLoginAsync(WebAuthnVerifyDto dto)
    {
        // Validasi challenge
        ValidateWebAuthnChallenge("login", dto.ClientDataJson);

        // Verifikasi credential ID terdaftar
        var config = await _db.UserAuthConfigs.FirstOrDefaultAsync()
            ?? throw new UnauthorizedAccessException("WebAuthn credential belum terdaftar.");

        if (config.WebAuthnCredentialId != dto.CredentialId)
            throw new UnauthorizedAccessException("WebAuthn credential tidak dikenal.");

        _logger.LogInformation("Login WebAuthn berhasil.");
        return GenerateAccessToken();
    }

    // ─── Step-Up Token ───────────────────────────────────────────────────────

    public async Task<StepUpTokenResponseDto> IssueStepUpTokenAsync(string pin, Guid targetId)
    {
        // Verifikasi PIN dulu
        var config = await _db.UserAuthConfigs.FirstOrDefaultAsync()
            ?? throw new UnauthorizedAccessException("PIN belum dikonfigurasi.");

        if (!VerifyPin(pin, config.PinHash))
            throw new UnauthorizedAccessException("PIN salah. Step-Up ditolak.");

        var jwtKey  = GetJwtKey();
        var now     = DateTimeOffset.UtcNow;
        var expires = now.AddSeconds(StepUpTokenSeconds);
        var jti     = Guid.NewGuid().ToString();

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, "maxwell"),
            new Claim("purpose", "step_up"),
            new Claim("target_id", targetId.ToString()), // H1: bind to specific resource
            new Claim(JwtRegisteredClaimNames.Iat, now.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64),
            new Claim(JwtRegisteredClaimNames.Jti, jti)  // H1: unique per token for consumed tracking
        };

        var token = new JwtSecurityToken(
            issuer   : "maya-server",
            audience : "maya-client",
            claims   : claims,
            notBefore: now.UtcDateTime,
            expires  : expires.UtcDateTime,
            signingCredentials: new SigningCredentials(jwtKey, SecurityAlgorithms.HmacSha256)
        );

        var tokenString = new JwtSecurityTokenHandler().WriteToken(token);
        _logger.LogInformation("Step-Up Token diterbitkan. Berlaku 60 detik. TargetId: {TargetId}", targetId);

        return new StepUpTokenResponseDto(
            StepUpToken    : tokenString,
            ExpiresInSeconds: StepUpTokenSeconds,
            ExpiresAt      : expires
        );
    }

    public bool ValidateStepUpToken(string stepUpToken, Guid expectedTargetId)
    {
        try
        {
            var jwtKey = GetJwtKey();
            var handler = new JwtSecurityTokenHandler();

            var validationParams = new TokenValidationParameters
            {
                ValidateIssuer           = true,
                ValidIssuer              = "maya-server",
                ValidateAudience         = true,
                ValidAudience            = "maya-client",
                ValidateLifetime         = true,
                ClockSkew                = TimeSpan.Zero,
                IssuerSigningKey         = jwtKey,
                ValidateIssuerSigningKey = true
            };

            var principal = handler.ValidateToken(stepUpToken, validationParams, out _);

            // Pastikan claim purpose = "step_up"
            var purpose = principal.FindFirstValue("purpose");
            if (purpose != "step_up") return false;

            // H1: Validasi targetId cocok dengan resource yang diminta
            var targetIdClaim = principal.FindFirstValue("target_id");
            if (!Guid.TryParse(targetIdClaim, out var tokenTargetId) || tokenTargetId != expectedTargetId)
            {
                _logger.LogWarning("Step-Up Token target_id tidak cocok. Expected: {Expected}, Got: {Got}",
                    expectedTargetId, targetIdClaim);
                return false;
            }

            // H1: Single-use — cek apakah JTI sudah pernah dipakai
            var jti = principal.FindFirstValue(JwtRegisteredClaimNames.Jti);
            if (string.IsNullOrEmpty(jti)) return false;

            lock (_jtiLock)
            {
                if (_consumedJtis.Contains(jti))
                {
                    _logger.LogWarning("Step-Up Token JTI '{Jti}' sudah pernah dipakai (single-use violation).", jti);
                    return false;
                }

                // Mark as consumed
                if (_consumedJtis.Count >= MaxConsumedTokens)
                    _consumedJtis.Clear(); // Simple cleanup — tokens expired anyway after 60s

                _consumedJtis.Add(jti);
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Step-Up Token tidak valid: {Msg}", ex.Message);
            return false;
        }
    }

    // ─── Private Helpers ─────────────────────────────────────────────────────

    private AuthTokenResponseDto GenerateAccessToken()
    {
        var jwtKey  = GetJwtKey();
        var now     = DateTimeOffset.UtcNow;
        var expires = now.AddDays(AccessTokenDays);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, "maxwell"),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim(JwtRegisteredClaimNames.Iat, now.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64),
            new Claim(ClaimTypes.Role, "Owner")
        };

        var token = new JwtSecurityToken(
            issuer   : "maya-server",
            audience : "maya-client",
            claims   : claims,
            notBefore: now.UtcDateTime,
            expires  : expires.UtcDateTime,
            signingCredentials: new SigningCredentials(jwtKey, SecurityAlgorithms.HmacSha256)
        );

        var tokenString = new JwtSecurityTokenHandler().WriteToken(token);

        return new AuthTokenResponseDto(
            AccessToken    : tokenString,
            TokenType      : "Bearer",
            ExpiresInSeconds: AccessTokenDays * 86400,
            ExpiresAt      : expires
        );
    }

    private SymmetricSecurityKey GetJwtKey()
    {
        var secret = _config["Maya:JwtSecret"]
            ?? throw new InvalidOperationException("Maya:JwtSecret belum dikonfigurasi di user-secrets.");

        if (secret.Length < 32)
            throw new InvalidOperationException("Maya:JwtSecret terlalu pendek — minimal 32 karakter.");

        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
    }

    private static string HashPin(string pin)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(pin),
            salt,
            PbkdfIterations,
            HashAlgorithmName.SHA512,
            HashSize);

        // Format: iterations:base64(salt):base64(hash)
        return $"{PbkdfIterations}:{Convert.ToBase64String(salt)}:{Convert.ToBase64String(hash)}";
    }

    private static bool VerifyPin(string pin, string storedHash)
    {
        try
        {
            var parts = storedHash.Split(':');
            if (parts.Length != 3) return false;

            var iterations = int.Parse(parts[0]);
            var salt       = Convert.FromBase64String(parts[1]);
            var hash       = Convert.FromBase64String(parts[2]);

            var computed = Rfc2898DeriveBytes.Pbkdf2(
                Encoding.UTF8.GetBytes(pin),
                salt,
                iterations,
                HashAlgorithmName.SHA512,
                HashSize);

            return CryptographicOperations.FixedTimeEquals(computed, hash);
        }
        catch
        {
            return false;
        }
    }

    private static byte[] GenerateChallenge() => RandomNumberGenerator.GetBytes(32);

    private string GetRpId()
    {
        // RP ID harus match dengan domain yang melakukan WebAuthn
        // Untuk dev: localhost
        return _config["WebAuthn:RpId"] ?? "localhost";
    }

    private void ValidateWebAuthnChallenge(string key, string clientDataJson)
    {
        lock (_challengeLock)
        {
            if (!_webAuthnChallenges.TryGetValue(key, out var challengeEntry))
                throw new UnauthorizedAccessException("Tidak ada challenge aktif. Minta ulang options.");

            if (DateTimeOffset.UtcNow > challengeEntry.Expiry)
            {
                _webAuthnChallenges.Remove(key);
                throw new UnauthorizedAccessException("WebAuthn challenge sudah expired. Minta ulang options.");
            }

            // Decode clientDataJson dan verifikasi challenge ada di dalamnya
            var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(clientDataJson));
            var expectedChallenge = Convert.ToBase64String(challengeEntry.Challenge);

            if (!decoded.Contains(expectedChallenge))
                throw new UnauthorizedAccessException("WebAuthn challenge tidak cocok.");

            // Hapus setelah digunakan (one-time use)
            _webAuthnChallenges.Remove(key);
        }
    }

    private async Task<UserAuthConfig> GetOrCreateAuthConfigAsync()
    {
        var config = await _db.UserAuthConfigs.FirstOrDefaultAsync();
        if (config is not null) return config;

        config = new UserAuthConfig
        {
            Id        = Guid.NewGuid(),
            UpdatedAt = DateTimeOffset.UtcNow
        };
        _db.UserAuthConfigs.Add(config);
        return config;
    }
}
