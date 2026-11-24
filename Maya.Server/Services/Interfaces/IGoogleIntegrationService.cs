namespace Maya.Server.Services.Interfaces;

/// <summary>
/// Layanan integrasi Google OAuth 2.0 (Calendar, Gmail, Photos).
/// Jika Google:ClientId tidak dikonfigurasi, semua method throw NotConfiguredException.
/// </summary>
public interface IGoogleIntegrationService
{
    bool IsConfigured { get; }

    /// <summary>
    /// Generate URL untuk memulai OAuth2 authorization flow.
    /// </summary>
    string GetAuthorizationUrl(string state, string? callbackUrl = null);

    /// <summary>
    /// Exchange authorization code untuk access + refresh token.
    /// Simpan refresh token terenkripsi AES-256-GCM ke user_auth_configs.
    /// </summary>
    Task HandleCallbackAsync(string code, string state, string? callbackUrl = null);

    /// <summary>
    /// Phase 8: True jika refresh token Google sudah tersimpan (OAuth sudah pernah berhasil).
    /// </summary>
    Task<bool> IsConnectedAsync();

    /// <summary>
    /// Phase 8: Hapus refresh token Google yang tersimpan (putuskan koneksi).
    /// </summary>
    Task DisconnectAsync();

    // ─── Gmail Tools ─────────────────────────────────────────────────────────

    /// <summary>
    /// Baca email belum-dibaca. maxResults default 5.
    /// Returns list of { from, subject, snippet, receivedAt }
    /// </summary>
    Task<List<GmailMessageSummary>> ListUnreadEmailsAsync(int maxResults = 5);

    /// <summary>
    /// Kirim email. HIGH RISK — wajib Step-Up + AgentDispatcher confirmation.
    /// </summary>
    Task SendEmailAsync(string to, string subject, string body);

    // ─── Google Calendar Tools ───────────────────────────────────────────────

    /// <summary>
    /// Baca jadwal N hari ke depan.
    /// </summary>
    Task<List<CalendarEventSummary>> GetUpcomingEventsAsync(int daysAhead = 3);

    /// <summary>
    /// Tambah jadwal baru ke Google Calendar.
    /// </summary>
    Task<CalendarEventSummary> CreateEventAsync(string title, DateTimeOffset startIso, DateTimeOffset endIso, string? description = null);
}

public record GmailMessageSummary(string From, string Subject, string Snippet, DateTimeOffset ReceivedAt);
public record CalendarEventSummary(string Id, string Title, DateTimeOffset Start, DateTimeOffset End, string? Description);
