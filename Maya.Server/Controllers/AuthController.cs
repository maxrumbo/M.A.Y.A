using Maya.Server.Services.Interfaces;
using Maya.Shared.DTOs.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Maya.Server.Controllers;

/// <summary>
/// Autentikasi M.A.Y.A. — PIN, WebAuthn/Passkey, Step-Up Token.
///
/// Endpoint publik (tidak perlu JWT):
///   POST /api/auth/setup-pin        — Setup Master PIN pertama kali
///   POST /api/auth/login-pin        — Login dengan PIN → JWT access token (7 hari)
///   POST /api/auth/webauthn/register-options  — Dapatkan WebAuthn challenge untuk registrasi
///   POST /api/auth/webauthn/register-verify   — Verifikasi credential WebAuthn → JWT
///   POST /api/auth/webauthn/login-options     — Dapatkan WebAuthn challenge untuk login
///   POST /api/auth/webauthn/login-verify      — Verifikasi assertion WebAuthn → JWT
///
/// Endpoint terproteksi JWT (perlu Bearer token):
///   POST /api/auth/step-up          — Issue Step-Up Token (60 detik) untuk aksi sensitif
///   GET  /api/auth/me               — Info user saat ini (untuk verifikasi token valid)
/// </summary>
[ApiController]
[Route("api/auth")]
[Produces("application/json")]
[EnableRateLimiting("AuthLimit")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthService authService, ILogger<AuthController> logger)
    {
        _authService = authService;
        _logger      = logger;
    }

    // ─── PIN Setup ────────────────────────────────────────────────────────────

    /// <summary>
    /// Setup Master PIN pertama kali.
    /// Hanya bisa dijalankan sekali — jika PIN sudah ada, akan error 409 Conflict.
    /// </summary>
    [HttpPost("setup-pin")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SetupPin([FromBody] PinSetupRequestDto req)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        if (req.Pin != req.ConfirmPin)
            return BadRequest(new { error = "PIN dan konfirmasi PIN tidak cocok." });

        if (req.Pin.Length < 4 || req.Pin.Length > 16)
            return BadRequest(new { error = "PIN harus antara 4-16 karakter." });

        try
        {
            await _authService.SetupPinAsync(req.Pin);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }

    // ─── PIN Login ────────────────────────────────────────────────────────────

    /// <summary>
    /// Login dengan Master PIN → kembalikan JWT access token (berlaku 7 hari).
    ///
    /// Gunakan token ini sebagai: Authorization: Bearer {token}
    /// </summary>
    [HttpPost("login-pin")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthTokenResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> LoginWithPin([FromBody] PinLoginRequestDto req)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        try
        {
            var token = await _authService.LoginWithPinAsync(req.Pin);
            return Ok(token);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
    }

    // ─── WebAuthn Registration ────────────────────────────────────────────────

    /// <summary>
    /// Dapatkan PublicKeyCredentialCreationOptions untuk registrasi WebAuthn/Passkey (Windows Hello).
    ///
    /// Gunakan response ini sebagai input navigator.credentials.create() di browser.
    /// Challenge berlaku 5 menit.
    /// </summary>
    [HttpPost("webauthn/register-options")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(WebAuthnOptionsDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetWebAuthnRegisterOptions()
    {
        var options = await _authService.GetWebAuthnRegisterOptionsAsync();
        return Ok(options);
    }

    /// <summary>
    /// Verifikasi hasil navigator.credentials.create() dari browser → simpan credential, return JWT.
    /// </summary>
    [HttpPost("webauthn/register-verify")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthTokenResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> VerifyWebAuthnRegistration([FromBody] WebAuthnVerifyDto dto)
    {
        try
        {
            var token = await _authService.VerifyWebAuthnRegistrationAsync(dto);
            return Ok(token);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "WebAuthn registration verification failed.");
            return BadRequest(new { error = "Verifikasi WebAuthn gagal: " + ex.Message });
        }
    }

    // ─── WebAuthn Login ───────────────────────────────────────────────────────

    /// <summary>
    /// Dapatkan PublicKeyCredentialRequestOptions untuk login WebAuthn/Passkey.
    ///
    /// Gunakan response ini sebagai input navigator.credentials.get() di browser.
    /// Challenge berlaku 5 menit.
    /// </summary>
    [HttpPost("webauthn/login-options")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(WebAuthnOptionsDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetWebAuthnLoginOptions()
    {
        var options = await _authService.GetWebAuthnLoginOptionsAsync();
        return Ok(options);
    }

    /// <summary>
    /// Verifikasi hasil navigator.credentials.get() dari browser → return JWT.
    /// </summary>
    [HttpPost("webauthn/login-verify")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthTokenResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> VerifyWebAuthnLogin([FromBody] WebAuthnVerifyDto dto)
    {
        try
        {
            var token = await _authService.VerifyWebAuthnLoginAsync(dto);
            return Ok(token);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
    }

    // ─── Step-Up Token ────────────────────────────────────────────────────────

    /// <summary>
    /// Issue Step-Up Token (JWT 60 detik, purpose = "step_up").
    ///
    /// H1 Hardening: Token terikat ke TargetId (Guid resource spesifik) dan single-use.
    /// Satu token hanya bisa dipakai sekali untuk satu resource.
    ///
    /// Diperlukan sebelum:
    ///   - GET /api/vault/{id}/reveal → Header: X-Step-Up-Token: {token}
    ///   - POST /api/agent/commands/{id}/confirm → Header: X-Step-Up-Token: {token}
    ///
    /// TargetId HARUS sama dengan {id} resource yang akan diakses.
    /// </summary>
    [HttpPost("step-up")]
    [Authorize]
    [EnableRateLimiting("StepUpLimit")]
    [ProducesResponseType(typeof(StepUpTokenResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> IssueStepUpToken([FromBody] StepUpConfirmRequestDto req)
    {
        try
        {
            var stepUpToken = await _authService.IssueStepUpTokenAsync(req.VerificationToken, req.TargetId);
            return Ok(stepUpToken);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
    }

    // ─── Me Endpoint ─────────────────────────────────────────────────────────

    /// <summary>
    /// Verifikasi JWT masih valid dan return info user saat ini.
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public IActionResult GetMe()
    {
        var sub = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
               ?? User.FindFirst("sub")?.Value;

        return Ok(new
        {
            user       = sub ?? "maxwell",
            role       = "Owner",
            issuedAt   = DateTimeOffset.UtcNow,
            message    = "JWT valid. M.A.Y.A. mengenalimu, Max."
        });
    }
}
