namespace Maya.Server.Data.Entities;

/// <summary>
/// Satu entri di Encrypted Password Vault.
/// Secret dienkripsi menggunakan AES-256-GCM. Plaintext TIDAK PERNAH disimpan.
/// Mapped ke tabel PostgreSQL: vault_entries
/// </summary>
public class VaultEntry
{
    public Guid Id { get; set; }
    public string ServiceName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;

    /// <summary>
    /// Ciphertext password dalam encoding Base64 (AES-256-GCM output).
    /// </summary>
    public string EncryptedSecret { get; set; } = string.Empty;

    /// <summary>
    /// Nonce 12-byte dalam encoding Base64. Unik per entri.
    /// </summary>
    public string IvNonce { get; set; } = string.Empty;

    /// <summary>
    /// GCM Authentication Tag 16-byte dalam encoding Base64. Unik per entri.
    /// </summary>
    public string AuthTag { get; set; } = string.Empty;

    /// <summary>
    /// Catatan non-sensitif (misal: "Akun kampus IT Del").
    /// </summary>
    public string? Notes { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
