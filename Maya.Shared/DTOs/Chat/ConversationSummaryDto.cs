namespace Maya.Shared.DTOs.Chat;

/// <summary>
/// Ringkasan sesi percakapan untuk ditampilkan di sidebar riwayat chat.
/// </summary>
public record ConversationSummaryDto(
    Guid Id,
    string Title,
    bool IsArchived,
    DateTimeOffset UpdatedAt,
    DateTimeOffset CreatedAt
);
