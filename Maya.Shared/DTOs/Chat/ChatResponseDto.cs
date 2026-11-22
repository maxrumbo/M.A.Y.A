namespace Maya.Shared.DTOs.Chat;

/// <summary>
/// Response dari M.A.Y.A. setelah memproses pesan.
/// PendingActions berisi daftar aksi HIGH_RISK yang menunggu konfirmasi biometrik.
/// </summary>
public record ChatResponseDto(
    Guid ConversationId,
    string Reply,
    List<PendingActionDto>? PendingActions,
    DateTimeOffset Timestamp
);
