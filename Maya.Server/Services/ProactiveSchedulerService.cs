using Maya.Server.Data;
using Maya.Server.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Maya.Server.Services;

/// <summary>
/// ProactiveSchedulerService — BackgroundService yang berjalan setiap 5 menit.
///
/// Jadwal proaktif:
/// 1. 06:45 WIB (UTC+7 = 23:45 UTC hari sebelumnya): Morning Briefing
///    - Generate ringkasan hari ini via Gemini (Calendar + Gmail)
///    - Kirim via FCM ke HP Maxwell
///
/// 2. Inactivity Check-in:
///    - Jika MAX(chat_messages.created_at) > 12 jam
///    - Dan jam saat ini 08:00–22:00 WIB
///    - Generate sapaan proaktif hangat dari M.A.Y.A.
///    - Kirim via FCM
///
/// FCM dan Google dibungkus dengan fallback jika belum dikonfigurasi.
/// </summary>
public class ProactiveSchedulerService : BackgroundService, IProactiveSchedulerService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly INotificationMuteService _muteService;
    private readonly ILogger<ProactiveSchedulerService> _logger;

    private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(5);

    // Timezone WIB (UTC+7): "SE Asia Standard Time" di Windows, "Asia/Jakarta" di Linux/Docker (IANA)
    private static readonly TimeZoneInfo WibZone = ResolveWibZone();

    // Tracking — hindari kirim 2x di hari yang sama
    private DateOnly? _lastMorningBriefingDate;
    private DateOnly? _lastCheckInDate;

    private static TimeZoneInfo ResolveWibZone()
    {
        foreach (var id in new[] { "SE Asia Standard Time", "Asia/Jakarta" })
        {
            if (TimeZoneInfo.TryFindSystemTimeZoneById(id, out var tz)) return tz;
        }
        return TimeZoneInfo.CreateCustomTimeZone("WIB", TimeSpan.FromHours(7), "WIB", "WIB");
    }

    public ProactiveSchedulerService(
        IServiceScopeFactory scopeFactory,
        INotificationMuteService muteService,
        ILogger<ProactiveSchedulerService> logger)
    {
        _scopeFactory = scopeFactory;
        _muteService  = muteService;
        _logger       = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("ProactiveSchedulerService dimulai. Interval: setiap {Min} menit.", CheckInterval.TotalMinutes);

        using var timer = new PeriodicTimer(CheckInterval);

        while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await RunChecksAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ProactiveSchedulerService: error saat RunChecksAsync.");
            }
        }
    }

    private async Task RunChecksAsync(CancellationToken cancellationToken)
    {
        // U3: Jika notifikasi sedang di-snooze / di-mute, jangan jalankan pengiriman proaktif
        if (_muteService.IsMuted)
        {
            _logger.LogInformation("ProactiveScheduler: Notifikasi sedang di-mute ({Minutes}m tersisa). Skip checks.",
                _muteService.RemainingMinutes);
            return;
        }

        var nowWib = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, WibZone);
        var todayWib = DateOnly.FromDateTime(nowWib);

        await using var scope = _scopeFactory.CreateAsyncScope();
        var db          = scope.ServiceProvider.GetRequiredService<MayaDbContext>();
        var fcm         = scope.ServiceProvider.GetRequiredService<IFcmNotificationService>();
        var googleSvc   = scope.ServiceProvider.GetRequiredService<IGoogleIntegrationService>();
        var geminiSvc   = scope.ServiceProvider.GetRequiredService<IGeminiService>();

        // ─── 1. Morning Briefing (06:45 WIB) ──────────────────────────────────
        if (nowWib.Hour == 6 && nowWib.Minute >= 45 && nowWib.Minute < 50
            && _lastMorningBriefingDate != todayWib)
        {
            _lastMorningBriefingDate = todayWib;
            await SendMorningBriefingAsync(fcm, googleSvc, geminiSvc, cancellationToken);
        }

        // ─── 2. Inactivity Check-in (08:00–22:00 WIB) ────────────────────────
        var hourWib = nowWib.Hour;
        if (hourWib >= 8 && hourWib < 22 && _lastCheckInDate != todayWib)
        {
            if (await CheckInactivityAsync(db, fcm, geminiSvc, cancellationToken))
                _lastCheckInDate = todayWib; // maks 1x check-in per hari WIB (anti-spam)
        }
    }

    private async Task SendMorningBriefingAsync(
        IFcmNotificationService fcm,
        IGoogleIntegrationService googleSvc,
        IGeminiService geminiSvc,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation("ProactiveScheduler: Mengirim Morning Briefing...");

        var briefingParts = new List<string> { "Selamat pagi, Max! 🌅 Ini ringkasan harianmu:" };

        // Coba ambil jadwal & email dari Google (fallback jika belum dikonfigurasi / belum terhubung)
        var googleConnected = false;
        if (googleSvc.IsConfigured)
        {
            try
            {
                googleConnected = await googleSvc.IsConnectedAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning("ProactiveScheduler: Gagal cek status koneksi Google. {Msg}", ex.Message);
            }
        }

        if (googleConnected)
        {
            try
            {
                var events = await googleSvc.GetUpcomingEventsAsync(daysAhead: 1);
                if (events.Count > 0)
                {
                    briefingParts.Add($"📅 {events.Count} jadwal hari ini:");
                    foreach (var ev in events.Take(3))
                        briefingParts.Add($"  • {ev.Title} pukul {ev.Start:HH:mm}");
                }
                else
                {
                    briefingParts.Add("📅 Tidak ada jadwal khusus hari ini.");
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("ProactiveScheduler: Gagal ambil Google Calendar. {Msg}", ex.Message);
            }

            try
            {
                var unread = await googleSvc.ListUnreadEmailsAsync(maxResults: 3);
                if (unread.Count > 0)
                {
                    briefingParts.Add($"✉️ {unread.Count}+ email belum dibaca:");
                    foreach (var mail in unread)
                        briefingParts.Add($"  • {mail.Subject}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("ProactiveScheduler: Gagal ambil Gmail. {Msg}", ex.Message);
            }
        }
        else
        {
            _logger.LogInformation("ProactiveScheduler: Google belum terhubung — skip ringkasan jadwal & email.");
        }

        var briefingText = string.Join("\n", briefingParts);

        // Kirim FCM (fallback jika tidak dikonfigurasi → hanya log)
        await fcm.SendNotificationAsync("Selamat Pagi dari M.A.Y.A. 🌅", briefingText);

        _logger.LogInformation("ProactiveScheduler: Morning Briefing selesai.");
    }

    private async Task<bool> CheckInactivityAsync(
        MayaDbContext db,
        IFcmNotificationService fcm,
        IGeminiService geminiSvc,
        CancellationToken cancellationToken)
    {
        // Ambil waktu pesan terakhir dari DB
        var lastMessageAt = await db.ChatMessages
            .OrderByDescending(m => m.CreatedAt)
            .Select(m => (DateTimeOffset?)m.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (lastMessageAt is null) return false; // Belum ada pesan sama sekali

        var hoursSinceLast = (DateTimeOffset.UtcNow - lastMessageAt.Value).TotalHours;

        if (hoursSinceLast < 12) return false; // Masih aktif, skip

        _logger.LogInformation(
            "ProactiveScheduler: Maxwell belum aktif selama {Hours:0.0} jam. Mengirim check-in proaktif.",
            hoursSinceLast);

        // Generate sapaan proaktif
        var greetings = new[]
        {
            "Hei Max, sudah lama nggak ngobrol nih 😊 Lagi sibuk apa? Ada yang bisa M.A.Y.A. bantu?",
            "Max, kamu baik-baik aja? Udah {hours} jam nggak ada kabar 🤍 M.A.Y.A. di sini kalau butuh apa-apa.",
            "Halo Max! Kayaknya kamu lagi sibuk banget. Ada yang bisa gue bantu hari ini?",
            "M.A.Y.A. kangen ngobrol sama kamu, Max. Ada apa hari ini?"
        };

        var greeting = greetings[Random.Shared.Next(greetings.Length)]
            .Replace("{hours}", $"{(int)hoursSinceLast}");

        // Hanya dianggap "terkirim" (mengunci cooldown harian) jika FCM benar-benar mengirim
        // atau tidak ada device sama sekali yang bisa dikirimi; kegagalan sementara boleh dicoba lagi.
        var delivered = await fcm.SendNotificationAsync("M.A.Y.A. 💫", greeting);
        return delivered || !fcm.IsConfigured;
    }
}
