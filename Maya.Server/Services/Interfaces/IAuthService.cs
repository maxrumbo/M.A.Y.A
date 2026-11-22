using Maya.Shared.DTOs.Auth;

namespace Maya.Server.Services.Interfaces;

/// <summary>
/// Layanan autentikasi M.A.Y.A.:
/// - PIN setup &amp; login → JWT access token + refresh token
/// - WebAuthn/Passkey registration &amp; authentication
/// - Step-Up Token (JWT 60 detik, purpose = "step_up") untuk aksi sensitif
/// </summary>
public interface IAuthService
{
    // ─── PIN ────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Setup Master PIN pertama kali (hash PBKDF2, simpan ke user_auth_configs).
    /// Throws InvalidOperationException jika PIN sudah pernah disetup.
    /// </summary>
    Task SetupPinAsync(string pin);

    /// <summary>
    /// Verifikasi PIN → kembalikan JWT access token (7 hari) + refresh token.
    /// Throws UnauthorizedAccessException jika PIN salah.
    /// </summary>
    Task<AuthTokenResponseDto> LoginWithPinAsync(string pin);

    // ─── WebAuthn / Passkey ──────────────────────────────────────────────────

    /// <summary>
    /// Generate PublicKeyCredentialCreationOptions untuk registrasi WebAuthn/Passkey.
    /// </summary>
    Task<WebAuthnOptionsDto> GetWebAuthnRegisterOptionsAsync();

    /// <summary>
    /// Verifikasi credential WebAuthn dari browser → simpan ke DB, return JWT.
    /// </summary>
    Task<AuthTokenResponseDto> VerifyWebAuthnRegistrationAsync(WebAuthnVerifyDto dto);

    /// <summary>
    /// Generate PublicKeyCredentialRequestOptions untuk login WebAuthn/Passkey.
    /// </summary>
    Task<WebAuthnOptionsDto> GetWebAuthnLoginOptionsAsync();

    /// <summary>
    /// Verifikasi assertion WebAuthn → return JWT access token (7 hari).
    /// </summary>
    Task<AuthTokenResponseDto> VerifyWebAuthnLoginAsync(WebAuthnVerifyDto dto);

    // ─── Step-Up Token ───────────────────────────────────────────────────────

    /// <summary>
    /// Issue Step-Up Token (JWT 60 detik, claim purpose = "step_up") setelah
    /// verifikasi PIN terbaru. Diperlukan untuk Vault Reveal dan Command Confirm.
    ///
    /// H1 Hardening: Token terikat ke targetId (Guid resource spesifik) dan single-use.
    /// </summary>
    Task<StepUpTokenResponseDto> IssueStepUpTokenAsync(string pin, Guid targetId);

    /// <summary>
    /// Validasi Step-Up Token dari header X-Step-Up-Token.
    /// H1 Hardening: Juga validasi targetId cocok dengan route {id} dan token belum pernah dipakai.
    /// Returns false jika token tidak valid, expired, sudah pernah dipakai, atau targetId tidak cocok.
    /// </summary>
    bool ValidateStepUpToken(string stepUpToken, Guid expectedTargetId);
}
