using System.ComponentModel.DataAnnotations;

namespace Maya.Shared.DTOs.Auth;

/// <summary>
/// Request payload untuk login menggunakan Master PIN.
/// </summary>
public record PinLoginRequestDto(
    [Required(ErrorMessage = "PIN wajib diisi.")]
    [MinLength(4, ErrorMessage = "PIN minimal 4 karakter.")]
    [MaxLength(16, ErrorMessage = "PIN maksimal 16 karakter.")]
    string Pin
);
