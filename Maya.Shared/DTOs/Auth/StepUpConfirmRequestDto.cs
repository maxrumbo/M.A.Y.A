using System.ComponentModel.DataAnnotations;

namespace Maya.Shared.DTOs.Auth;

/// <summary>
/// Request untuk Step-Up Authentication (konfirmasi aksi sensitif HIGH_RISK).
/// Token berumur pendek 60 detik dengan claim purpose = "step_up".
///
/// H1 Hardening: TargetId mengikat token ke satu resource spesifik (command/vault ID).
/// Token hanya valid untuk resource dengan ID tersebut dan hanya bisa dipakai sekali.
/// </summary>
public record StepUpConfirmRequestDto(
    [Required(ErrorMessage = "Verification token wajib diisi.")]
    string VerificationToken,

    /// <summary>
    /// ID resource yang akan diakses (Guid command atau vault entry).
    /// Token yang diterbitkan hanya valid untuk targetId ini.
    /// </summary>
    [Required(ErrorMessage = "TargetId wajib diisi — sertakan ID command atau vault yang akan diakses.")]
    Guid TargetId
);

