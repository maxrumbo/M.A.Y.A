namespace Maya.Shared.DTOs.Chat;

/// <summary>
/// Representasi satu pesan dalam riwayat percakapan.
/// Role: "user", "model", "system", atau "tool".
/// </summary>
public record ChatMessageDto(
    Guid Id,
    Guid ConversationId,
    string Role,
    string Content,
    string? ToolCallJson,
    DateTimeOffset CreatedAt
);
