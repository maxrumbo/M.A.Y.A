using Google.Apis.Auth.OAuth2;
using Google.Apis.Auth.OAuth2.Flows;
using Google.Apis.Auth.OAuth2.Requests;
using Google.Apis.Calendar.v3;
using Google.Apis.Calendar.v3.Data;
using Google.Apis.Gmail.v1;
using Google.Apis.Gmail.v1.Data;
using Google.Apis.Services;
using Maya.Server.Data;
using Maya.Server.Data.Entities;
using Maya.Server.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Maya.Server.Services;

/// <summary>
/// GoogleIntegrationService — integrasi Google Calendar &amp; Gmail via OAuth 2.0.
///
/// Jika Google:ClientId atau Google:ClientSecret tidak dikonfigurasi:
/// - IsConfigured = false
/// - Semua method throw NotSupportedException dengan pesan jelas
/// - Server tetap build dan run normal
///
/// OAuth flow:
/// 1. GET /api/integrations/google/authorize → redirect ke Google
/// 2. GET /api/integrations/google/callback → simpan encrypted refresh token ke DB
/// 3. Semua API call selanjutnya menggunakan refresh token dari DB
/// </summary>
public class GoogleIntegrationService : IGoogleIntegrationService
{
    private readonly IConfiguration _config;
    private readonly ISecretProtector _protector;
    private readonly MayaDbContext _db;
    private readonly ILogger<GoogleIntegrationService> _logger;

    private static readonly string[] Scopes =
    [
        CalendarService.Scope.CalendarReadonly,
        CalendarService.Scope.Calendar,
        GmailService.Scope.GmailReadonly,
        GmailService.Scope.GmailSend,
        GmailService.Scope.GmailModify
    ];

    private readonly string? _clientId;
    private readonly string? _clientSecret;
    private readonly string _callbackUrl;

    public bool IsConfigured =>
        !string.IsNullOrEmpty(_clientId) && !string.IsNullOrEmpty(_clientSecret);

    public GoogleIntegrationService(
        IConfiguration config,
        ISecretProtector protector,
        MayaDbContext db,
        ILogger<GoogleIntegrationService> logger)
    {
        _config       = config;
        _protector    = protector;
        _db           = db;
        _logger       = logger;

        _clientId     = config["Google:ClientId"];
        _clientSecret = config["Google:ClientSecret"];
        _callbackUrl  = config["Google:CallbackUrl"] ?? "http://localhost:5063/api/integrations/google/callback";

        if (!IsConfigured)
            _logger.LogWarning("GoogleIntegrationService: Google:ClientId atau Google:ClientSecret belum dikonfigurasi. " +
                               "Integrasi Google tidak aktif. Set via dotnet user-secrets untuk mengaktifkan.");
    }

    public string GetAuthorizationUrl(string state, string? callbackUrl = null)
    {
        EnsureConfigured();

        var flow = CreateFlow();
        var request = flow.CreateAuthorizationCodeRequest(callbackUrl ?? _callbackUrl);

        // access_type=offline + prompt=consent → Google selalu mengembalikan refresh token
        if (request is GoogleAuthorizationCodeRequestUrl googleRequest)
        {
            googleRequest.AccessType = "offline";
            googleRequest.Prompt     = "consent";
        }

        request.State = state;
        return request.Build().AbsoluteUri;
    }

    public async Task HandleCallbackAsync(string code, string state, string? callbackUrl = null)
    {
        EnsureConfigured();

        var flow = CreateFlow();
        var token = await flow.ExchangeCodeForTokenAsync("maxwell", code, callbackUrl ?? _callbackUrl, CancellationToken.None);

        if (string.IsNullOrEmpty(token.RefreshToken))
            throw new InvalidOperationException("Google tidak mengembalikan refresh token. Cabut akses M.A.Y.A. di myaccount.google.com/permissions lalu coba hubungkan lagi.");

        // Single-owner: baris user_auth_configs dibuat saat setup PIN. Tanpa baris itu, OAuth tidak bisa disimpan.
        var config = await _db.UserAuthConfigs.FirstOrDefaultAsync()
            ?? throw new InvalidOperationException("Master PIN belum disetup. Setup PIN dahulu sebelum menghubungkan Google.");

        // Phase 8: refresh token dienkripsi AES-256-GCM (Maya:VaultMasterKey) — TIDAK PERNAH plaintext di DB.
        config.GoogleRefreshTokenEnc = _protector.Protect(token.RefreshToken);
        config.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();
        _logger.LogInformation("Google OAuth2 refresh token berhasil disimpan (terenkripsi).");
    }

    public async Task<bool> IsConnectedAsync()
    {
        var enc = await _db.UserAuthConfigs
            .Select(c => c.GoogleRefreshTokenEnc)
            .FirstOrDefaultAsync();
        return !string.IsNullOrEmpty(enc);
    }

    public async Task DisconnectAsync()
    {
        var config = await _db.UserAuthConfigs.FirstOrDefaultAsync();
        if (config is null || string.IsNullOrEmpty(config.GoogleRefreshTokenEnc)) return;

        config.GoogleRefreshTokenEnc = null;
        config.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        _logger.LogInformation("Koneksi Google diputus (refresh token dihapus).");
    }

    // ─── Gmail ───────────────────────────────────────────────────────────────

    public async Task<List<GmailMessageSummary>> ListUnreadEmailsAsync(int maxResults = 5)
    {
        EnsureConfigured();

        var gmailService = await CreateGmailServiceAsync();
        var request = gmailService.Users.Messages.List("me");
        request.Q           = "is:unread";
        request.MaxResults   = maxResults;

        ListMessagesResponse? response;
        try
        {
            response = await request.ExecuteAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GoogleIntegration: Gagal mengambil daftar email.");
            throw;
        }

        var results = new List<GmailMessageSummary>();
        foreach (var msg in response.Messages ?? [])
        {
            var detail = await gmailService.Users.Messages.Get("me", msg.Id).ExecuteAsync();
            var from    = GetHeader(detail.Payload.Headers, "From")    ?? "Unknown";
            var subject = GetHeader(detail.Payload.Headers, "Subject") ?? "(no subject)";
            var dateStr = GetHeader(detail.Payload.Headers, "Date")    ?? string.Empty;

            DateTimeOffset receivedAt = DateTimeOffset.TryParse(dateStr, out var dt) ? dt : DateTimeOffset.UtcNow;

            results.Add(new GmailMessageSummary(
                From      : from,
                Subject   : subject,
                Snippet   : detail.Snippet ?? string.Empty,
                ReceivedAt: receivedAt
            ));
        }

        return results;
    }

    public async Task SendEmailAsync(string to, string subject, string body)
    {
        EnsureConfigured();

        var gmailService = await CreateGmailServiceAsync();

        // Build RFC 2822 email
        var rawEmail = $"To: {to}\r\nSubject: {subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n{body}";
        var encodedEmail = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(rawEmail))
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');

        await gmailService.Users.Messages.Send(new Message { Raw = encodedEmail }, "me").ExecuteAsync();
        _logger.LogInformation("GoogleIntegration: Email terkirim ke {To}", to);
    }

    // ─── Google Calendar ─────────────────────────────────────────────────────

    public async Task<List<CalendarEventSummary>> GetUpcomingEventsAsync(int daysAhead = 3)
    {
        EnsureConfigured();

        var calService = await CreateCalendarServiceAsync();
        var request = calService.Events.List("primary");
        request.TimeMinDateTimeOffset = DateTimeOffset.UtcNow;
        request.TimeMaxDateTimeOffset = DateTimeOffset.UtcNow.AddDays(daysAhead);
        request.SingleEvents          = true;
        request.OrderBy               = EventsResource.ListRequest.OrderByEnum.StartTime;
        request.MaxResults            = 10;

        var response = await request.ExecuteAsync();

        return response.Items?
            .Select(e => new CalendarEventSummary(
                Id         : e.Id,
                Title      : e.Summary ?? "(no title)",
                Start      : e.Start.DateTimeDateTimeOffset ?? DateTimeOffset.Parse(e.Start.Date!),
                End        : e.End.DateTimeDateTimeOffset   ?? DateTimeOffset.Parse(e.End.Date!),
                Description: e.Description
            ))
            .ToList() ?? [];
    }

    public async Task<CalendarEventSummary> CreateEventAsync(
        string title, DateTimeOffset startIso, DateTimeOffset endIso, string? description = null)
    {
        EnsureConfigured();

        var calService = await CreateCalendarServiceAsync();
        var newEvent = new Event
        {
            Summary     = title,
            Description = description,
            Start       = new EventDateTime { DateTimeDateTimeOffset = startIso },
            End         = new EventDateTime { DateTimeDateTimeOffset = endIso }
        };

        var created = await calService.Events.Insert(newEvent, "primary").ExecuteAsync();
        _logger.LogInformation("GoogleIntegration: Event '{Title}' berhasil dibuat.", title);

        return new CalendarEventSummary(
            Id         : created.Id,
            Title      : created.Summary,
            Start      : created.Start.DateTimeDateTimeOffset ?? startIso,
            End        : created.End.DateTimeDateTimeOffset   ?? endIso,
            Description: created.Description
        );
    }

    // ─── Private Helpers ─────────────────────────────────────────────────────

    private void EnsureConfigured()
    {
        if (!IsConfigured)
            throw new NotSupportedException(
                "Integrasi Google belum dikonfigurasi. " +
                "Set Google:ClientId dan Google:ClientSecret via 'dotnet user-secrets set' di Maya.Server.");
    }

    private GoogleAuthorizationCodeFlow CreateFlow() =>
        new(new GoogleAuthorizationCodeFlow.Initializer
        {
            ClientSecrets = new ClientSecrets
            {
                ClientId     = _clientId!,
                ClientSecret = _clientSecret!
            },
            Scopes = Scopes
        });

    private async Task<GmailService> CreateGmailServiceAsync()
    {
        var credential = await GetCredentialAsync();
        return new GmailService(new BaseClientService.Initializer
        {
            HttpClientInitializer = credential,
            ApplicationName       = "M.A.Y.A."
        });
    }

    private async Task<CalendarService> CreateCalendarServiceAsync()
    {
        var credential = await GetCredentialAsync();
        return new CalendarService(new BaseClientService.Initializer
        {
            HttpClientInitializer = credential,
            ApplicationName       = "M.A.Y.A."
        });
    }

    private async Task<UserCredential> GetCredentialAsync()
    {
        var config = await _db.UserAuthConfigs.FirstOrDefaultAsync()
            ?? throw new InvalidOperationException("Google refresh token belum ada. Lakukan OAuth flow terlebih dahulu via /api/integrations/google/authorize.");

        if (string.IsNullOrEmpty(config.GoogleRefreshTokenEnc))
            throw new InvalidOperationException("Google belum terhubung. Hubungkan akun Google dari panel Integrasi di aplikasi M.A.Y.A.");

        // Migrasi otomatis: jika masih tersimpan plaintext (legacy), enkripsi sekarang juga.
        if (!_protector.IsProtected(config.GoogleRefreshTokenEnc))
        {
            var legacy = config.GoogleRefreshTokenEnc;
            config.GoogleRefreshTokenEnc = _protector.Protect(legacy);
            config.UpdatedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync();
            _logger.LogInformation("Google refresh token legacy dimigrasi ke format terenkripsi.");
        }

        var flow = CreateFlow();
        var token = new Google.Apis.Auth.OAuth2.Responses.TokenResponse
        {
            RefreshToken = _protector.Unprotect(config.GoogleRefreshTokenEnc)
        };

        return new UserCredential(flow, "maxwell", token);
    }

    private static string? GetHeader(IList<MessagePartHeader>? headers, string name) =>
        headers?.FirstOrDefault(h => h.Name.Equals(name, StringComparison.OrdinalIgnoreCase))?.Value;
}
