namespace Maya.Shared.DTOs.Vault;

/// <summary>
/// Ringkasan entri vault TANPA password plaintext.
/// Digunakan untuk menampilkan daftar layanan tersimpan di UI.
/// </summary>
public record VaultSummaryDto(
    Guid Id,
    string ServiceName,
    string Username,
    string? Notes,
    DateTimeOffset UpdatedAt
);
