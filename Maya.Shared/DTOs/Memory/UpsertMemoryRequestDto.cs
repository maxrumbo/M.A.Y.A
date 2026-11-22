using System.ComponentModel.DataAnnotations;
using Maya.Shared.Enums;

namespace Maya.Shared.DTOs.Memory;

/// <summary>
/// Request untuk membuat atau memperbarui entri memori.
/// Jika Key sudah ada, value-nya diperbarui (upsert).
/// </summary>
public record UpsertMemoryRequestDto(
    [Required(ErrorMessage = "Key wajib diisi.")]
    [MaxLength(120, ErrorMessage = "Key maksimal 120 karakter.")]
    string Key,

    [Required(ErrorMessage = "Value wajib diisi.")]
    string Value,

    MemoryCategory Category,

    [Range(1, 10, ErrorMessage = "Importance harus antara 1–10.")]
    int Importance = 5
);
