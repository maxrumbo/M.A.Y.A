namespace Maya.Shared.DTOs.Chat;

/// <summary>
/// Merepresentasikan aksi HIGH_RISK yang belum dieksekusi dan menunggu
/// konfirmasi biometrik / Step-Up PIN dari Maxwell.
/// </summary>
public record PendingActionDto(
    Guid   CommandId,
    string CommandName,
    string Description,
    bool   RequiresBiometricConfirmation,

    /// <summary>
    /// Preview email untuk gmail_send_email — ditampilkan di Confirmation Card
    /// agar Maxwell bisa melihat isi email sebelum mengkonfirmasi (H5 Hardening).
    /// Null untuk aksi non-email.
    /// </summary>
    EmailPreviewDto? EmailPreview = null
);

/// <summary>
/// Preview email yang akan dikirim — ditampilkan di Step-Up Confirmation Card.
/// BodyPreview dipotong maks 200 karakter.
/// </summary>
public record EmailPreviewDto(
    string To,
    string Subject,
    string BodyPreview
);

