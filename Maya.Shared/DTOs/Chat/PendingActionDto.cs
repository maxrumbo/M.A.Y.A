namespace Maya.Shared.DTOs.Chat;

/// <summary>
/// Merepresentasikan aksi HIGH_RISK yang belum dieksekusi dan menunggu
/// konfirmasi biometrik / Step-Up PIN dari Maxwell.
/// </summary>
public record PendingActionDto(
    Guid CommandId,
    string CommandName,
    string Description,
    bool RequiresBiometricConfirmation
);
