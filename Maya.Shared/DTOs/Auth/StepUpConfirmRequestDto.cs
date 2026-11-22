using System.ComponentModel.DataAnnotations;

namespace Maya.Shared.DTOs.Auth;

/// <summary>
/// Request untuk Step-Up Authentication (konfirmasi aksi sensitif HIGH_RISK).
/// Token berumur pendek 60 detik dengan claim purpose = "step_up".
/// </summary>
public record StepUpConfirmRequestDto(
    [Required(ErrorMessage = "Verification token wajib diisi.")]
    string VerificationToken
);
