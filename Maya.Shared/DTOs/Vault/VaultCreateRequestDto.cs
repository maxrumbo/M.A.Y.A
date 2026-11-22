using System.ComponentModel.DataAnnotations;

namespace Maya.Shared.DTOs.Vault;

/// <summary>
/// Request untuk membuat entri baru di Password Vault.
/// PlainSecret akan langsung dienkripsi dengan AES-256-GCM dan tidak pernah disimpan dalam bentuk plaintext.
/// </summary>
public record VaultCreateRequestDto(
    [Required(ErrorMessage = "Nama layanan wajib diisi.")]
    [MaxLength(100, ErrorMessage = "Nama layanan maksimal 100 karakter.")]
    string ServiceName,

    [Required(ErrorMessage = "Username wajib diisi.")]
    [MaxLength(150, ErrorMessage = "Username maksimal 150 karakter.")]
    string Username,

    [Required(ErrorMessage = "Secret (password) wajib diisi.")]
    string PlainSecret,

    string? Notes
);
