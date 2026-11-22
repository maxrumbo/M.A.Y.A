namespace Maya.Server.Data.Entities;

/// <summary>
/// Konfigurasi autentikasi tunggal milik Maxwell (single-owner system).
/// Menyimpan hash PIN, credential WebAuthn/Passkey, dan encrypted Google token.
/// Mapped ke tabel PostgreSQL: user_auth_configs
/// </summary>
public class UserAuthConfig
{
    public Guid Id { get; set; }

    /// <summary>
    /// Hash Master PIN menggunakan PBKDF2 / Argon2id. TIDAK PERNAH disimpan plaintext.
    /// </summary>
    public string PinHash { get; set; } = string.Empty;

    /// <summary>
    /// Credential ID dari Passkey / Windows Hello (WebAuthn/FIDO2).
    /// </summary>
    public string? WebAuthnCredentialId { get; set; }

    /// <summary>
    /// Public Key dari Passkey / Windows Hello untuk verifikasi signature.
    /// </summary>
    public string? WebAuthnPublicKey { get; set; }

    /// <summary>
    /// Google OAuth2 Refresh Token — dienkripsi sebelum disimpan.
    /// Digunakan untuk mengakses Gmail, Calendar, Photos API.
    /// </summary>
    public string? GoogleRefreshTokenEnc { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
