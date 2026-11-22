namespace Maya.Server.Data.Entities;

/// <summary>
/// Satu pesan dalam sesi percakapan.
/// Role: "user", "model", "system", "tool"
/// Mapped ke tabel PostgreSQL: chat_messages
/// </summary>
public class ChatMessage
{
    public Guid Id { get; set; }
    public Guid ConversationId { get; set; }

    /// <summary>
    /// "user", "model", "system", atau "tool"
    /// </summary>
    public string Role { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// JSON payload jika pesan ini adalah tool call / tool response dari Gemini.
    /// Disimpan sebagai jsonb di PostgreSQL.
    /// </summary>
    public string? ToolCallJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    // Navigation property
    public Conversation Conversation { get; set; } = null!;
}
