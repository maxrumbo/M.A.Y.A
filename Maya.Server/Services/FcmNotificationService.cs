using System.Text;
using FirebaseAdmin;
using FirebaseAdmin.Messaging;
using Google.Apis.Auth.OAuth2;
using Maya.Server.Data;
using Maya.Server.Data.Entities;
using Maya.Server.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Maya.Server.Services;

/// <summary>
/// FcmNotificationService — Firebase Cloud Messaging push notification.
///
/// Singleton-safe: memakai IServiceScopeFactory untuk akses DbContext sehingga aman dipanggil
/// dari controller, hosted service (ProactiveSchedulerService), maupun singleton lain (MobileDeviceService).
///
/// Fallback jika kredensial Firebase belum dikonfigurasi:
/// - IsConfigured = false
/// - SendNotificationAsync / SendDataMessageAsync hanya log, TIDAK CRASH
/// - RegisterFcmTokenAsync tetap menyimpan token ke DB
///
/// Sumber kredensial (urutan prioritas):
///   1. Firebase:ServiceAccountJsonBase64  — JSON service account yang di-Base64 (disarankan untuk env var cloud)
///   2. Firebase:ServiceAccountJson        — JSON mentah (atau otomatis dideteksi Base64 jika tidak diawali '{')
/// </summary>
public class FcmNotificationService : IFcmNotificationService
{
    public const string GeneralChannelId = "maya_general";

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<FcmNotificationService> _logger;
    private readonly bool _isConfigured;

    public bool IsConfigured => _isConfigured;

    public FcmNotificationService(
        IConfiguration config,
        IServiceScopeFactory scopeFactory,
        ILogger<FcmNotificationService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger       = logger;

        var serviceAccountJson = ResolveServiceAccountJson(config);

        if (!string.IsNullOrEmpty(serviceAccountJson))
        {
            try
            {
                // Hanya inisialisasi jika belum ada instance FirebaseApp
                if (FirebaseApp.DefaultInstance is null)
                {
                    FirebaseApp.Create(new AppOptions
                    {
                        Credential = GoogleCredential.FromJson(serviceAccountJson)
                    });
                }
                _isConfigured = true;
                _logger.LogInformation("FcmNotificationService: Firebase Admin SDK berhasil diinisialisasi.");
            }
            catch (Exception ex)
            {
                _isConfigured = false;
                _logger.LogWarning("FcmNotificationService: Gagal inisialisasi Firebase. {Msg}. Fallback ke log-only mode.", ex.Message);
            }
        }
        else
        {
            _isConfigured = false;
            _logger.LogInformation("FcmNotificationService: Kredensial Firebase belum dikonfigurasi. " +
                                   "Notifikasi akan di-log saja (fallback mode).");
        }
    }

    private static string? ResolveServiceAccountJson(IConfiguration config)
    {
        var base64 = config["Firebase:ServiceAccountJsonBase64"];
        if (!string.IsNullOrWhiteSpace(base64))
        {
            var decoded = TryDecodeBase64(base64);
            if (decoded is not null) return decoded;
        }

        var raw = config["Firebase:ServiceAccountJson"];
        if (string.IsNullOrWhiteSpace(raw)) return null;

        raw = raw.Trim();
        if (raw.StartsWith('{')) return raw;

        // Bukan JSON mentah → coba perlakukan sebagai Base64
        return TryDecodeBase64(raw);
    }

    private static string? TryDecodeBase64(string value)
    {
        try
        {
            var text = Encoding.UTF8.GetString(Convert.FromBase64String(value.Trim()));
            return text.TrimStart().StartsWith('{') ? text : null;
        }
        catch (FormatException)
        {
            return null;
        }
    }

    public async Task<bool> SendNotificationAsync(string title, string body, string? data = null)
    {
        var targets = await GetTargetsAsync();

        if (targets.Count == 0)
        {
            _logger.LogInformation("FCM: Tidak ada device mobile terdaftar. Notifikasi diskip. Title: '{Title}'", title);
            return false;
        }

        if (!_isConfigured)
        {
            _logger.LogInformation(
                "FCM [LOG-ONLY MODE]: Judul='{Title}' | Body='{Body}' | Targets={Count} device(s)",
                title, body, targets.Count);
            return false;
        }

        var sent = await SendToTargetsAsync(targets, token => new Message
        {
            Token = token,
            Notification = new Notification { Title = title, Body = body },
            Data = new Dictionary<string, string>
            {
                ["type"] = "notification",
                ["payload"] = data ?? string.Empty
            },
            Android = new AndroidConfig
            {
                Priority = Priority.High,
                Notification = new AndroidNotification { ChannelId = GeneralChannelId }
            }
        });

        _logger.LogInformation("FCM: Notifikasi '{Title}' terkirim ke {Count}/{Total} device(s).",
            title, sent, targets.Count);

        return sent > 0;
    }

    public async Task<int> SendDataMessageAsync(IDictionary<string, string> data, TimeSpan? timeToLive = null)
    {
        var targets = await GetTargetsAsync();

        if (targets.Count == 0)
        {
            _logger.LogInformation("FCM data message diskip: tidak ada device mobile terdaftar.");
            return 0;
        }

        if (!_isConfigured)
        {
            _logger.LogInformation("FCM [LOG-ONLY MODE]: data message type='{Type}' untuk {Count} device(s).",
                data.TryGetValue("type", out var t) ? t : "?", targets.Count);
            return 0;
        }

        var payload = new Dictionary<string, string>(data);

        return await SendToTargetsAsync(targets, token => new Message
        {
            Token = token,
            Data = payload,
            Android = new AndroidConfig
            {
                Priority = Priority.High,
                TimeToLive = timeToLive ?? TimeSpan.FromSeconds(60)
            }
        });
    }

    public async Task<int> CountRegisteredDevicesAsync()
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MayaDbContext>();
        return await db.DeviceStatuses
            .CountAsync(d => d.DeviceType == "mobile" && d.FcmToken != null && d.FcmToken != "");
    }

    public async Task RegisterFcmTokenAsync(string deviceId, string fcmToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MayaDbContext>();

        // Token yang sama tidak boleh melekat di device id lain (mis. setelah install ulang) → cegah alarm ganda
        var duplicates = await db.DeviceStatuses
            .Where(d => d.FcmToken == fcmToken && d.DeviceId != deviceId)
            .ToListAsync();
        foreach (var dup in duplicates)
            dup.FcmToken = null;

        var device = await db.DeviceStatuses.FindAsync(deviceId);

        if (device is null)
        {
            device = new DeviceStatus
            {
                DeviceId   = deviceId,
                DeviceType = "mobile",
                IsOnline   = true,
                FcmToken   = fcmToken,
                LastSeenAt = DateTimeOffset.UtcNow
            };
            db.DeviceStatuses.Add(device);
        }
        else
        {
            device.FcmToken   = fcmToken;
            device.LastSeenAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync();
        _logger.LogInformation("FCM: Token berhasil didaftarkan untuk device '{DeviceId}'.", deviceId);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private async Task<List<(string DeviceId, string Token)>> GetTargetsAsync()
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MayaDbContext>();

        var rows = await db.DeviceStatuses
            .Where(d => d.DeviceType == "mobile" && d.FcmToken != null && d.FcmToken != "")
            .Select(d => new { d.DeviceId, Token = d.FcmToken! })
            .ToListAsync();

        return rows.Select(r => (r.DeviceId, r.Token)).ToList();
    }

    private async Task<int> SendToTargetsAsync(
        List<(string DeviceId, string Token)> targets,
        Func<string, Message> messageFactory)
    {
        var messaging = FirebaseMessaging.DefaultInstance;
        var success = 0;
        var staleDeviceIds = new List<string>();

        foreach (var (deviceId, token) in targets)
        {
            try
            {
                var messageId = await messaging.SendAsync(messageFactory(token));
                _logger.LogDebug("FCM: Pesan terkirim. MessageId: {Id}", messageId);
                success++;
            }
            catch (FirebaseMessagingException ex) when (ex.MessagingErrorCode == MessagingErrorCode.Unregistered)
            {
                _logger.LogWarning("FCM: Token device '{DeviceId}' sudah tidak terdaftar. Dihapus dari DB.", deviceId);
                staleDeviceIds.Add(deviceId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning("FCM: Gagal kirim ke device '{DeviceId}'. {Msg}", deviceId, ex.Message);
            }
        }

        if (staleDeviceIds.Count > 0)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<MayaDbContext>();
                var stale = await db.DeviceStatuses.Where(d => staleDeviceIds.Contains(d.DeviceId)).ToListAsync();
                foreach (var d in stale) d.FcmToken = null;
                await db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning("FCM: Gagal membersihkan token kedaluwarsa. {Msg}", ex.Message);
            }
        }

        return success;
    }
}
