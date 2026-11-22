namespace Maya.Server.Data.Entities;

/// <summary>
/// Log audit setiap perintah yang diminta Maxwell melalui M.A.Y.A.
/// Perintah HIGH_RISK mulai dengan status PendingConfirmation sampai biometrik diverifikasi.
/// Mapped ke tabel PostgreSQL: command_logs
/// </summary>
public class CommandLog
{
    public Guid Id { get; set; }

    /// <summary>
    /// Nullable — FK ke conversations dengan ON DELETE SET NULL.
    /// </summary>
    public Guid? ConversationId { get; set; }

    /// <summary>
    /// Nama tool/perintah, misal: "open_application", "power_control", "git_workflow"
    /// </summary>
    public string CommandName { get; set; } = string.Empty;

    /// <summary>
    /// Parameter perintah dalam format JSON. Disimpan sebagai jsonb di PostgreSQL.
    /// </summary>
    public string PayloadJson { get; set; } = string.Empty;

    /// <summary>
    /// True jika perintah ini HIGH_RISK dan butuh Step-Up biometrik.
    /// </summary>
    public bool RequiresConfirmation { get; set; } = false;

    /// <summary>
    /// Status: "PendingConfirmation", "Dispatched", "Completed", "Failed", "Rejected", "Timeout"
    /// </summary>
    public string Status { get; set; } = string.Empty;

    public string? ResultOutput { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }

    // Navigation property
    public Conversation? Conversation { get; set; }
}
