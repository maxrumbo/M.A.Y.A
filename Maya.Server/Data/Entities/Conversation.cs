namespace Maya.Server.Data.Entities;

/// <summary>
/// Merepresentasikan satu sesi percakapan antara Maxwell dan M.A.Y.A.
/// Mapped ke tabel PostgreSQL: conversations
/// </summary>
public class Conversation
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public bool IsArchived { get; set; } = false;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    // Navigation properties
    public ICollection<ChatMessage> ChatMessages { get; set; } = new List<ChatMessage>();
    public ICollection<CommandLog> CommandLogs { get; set; } = new List<CommandLog>();
}
