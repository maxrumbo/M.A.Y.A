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
/// Menggunakan IServiceScopeFactory agar aman digunakan baik dari Scoped controller
/// maupun Singleton hosted service (ProactiveSchedulerService) tanpa DI lifetime mismatch.
///
/// Fallback behavior jika Firebase:ServiceAccountJson belum dikonfigurasi:
/// - IsConfigured = false
/// - SendNotificationAsync hanya log ke console, return false — TIDAK CRASH
/// - RegisterFcmTokenAsync menyimpan token ke DB (tetap jalan tanpa Firebase)
///
/// Cara konfigurasi:
///   dotnet user-secrets set "Firebase:ServiceAccountJson" "{ ... json dari Firebase Console ... }" --project Maya.Server
/// </summary>
public class FcmNotificationService : IFcmNotificationService
{
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

        var serviceAccountJson = config["Firebase:ServiceAccountJson"];

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
            _logger.LogInformation("FcmNotificationService: Firebase:ServiceAccountJson belum dikonfigurasi. " +
                                   "Notifikasi akan di-log saja (fallback mode).");
        }
    }

    public async Task<bool> SendNotificationAsync(string title, string body, string? data = null)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MayaDbContext>();

        // Ambil semua FCM token mobile dari DB
        var mobileDevices = await db.DeviceStatuses
            .Where(d => d.DeviceType == "mobile" && !string.IsNullOrEmpty(d.FcmToken))
            .Select(d => d.FcmToken!)
            .ToListAsync();

        if (mobileDevices.Count == 0)
        {
            _logger.LogInformation("FCM: Tidak ada device mobile terdaftar. Notifikasi diskip. Title: '{Title}'", title);
            return false;
        }

        if (!_isConfigured)
        {
            // Fallback: log saja
            _logger.LogInformation(
                "FCM [LOG-ONLY MODE]: Judul='{Title}' | Body='{Body}' | Targets={Count} device(s)",
                title, body, mobileDevices.Count);
            return false;
        }

        try
        {
            var messaging = FirebaseMessaging.DefaultInstance;
            var successCount = 0;

            foreach (var token in mobileDevices)
            {
                var message = new Message
                {
                    Token = token,
                    Notification = new Notification
                    {
                        Title = title,
                        Body  = body
                    },
                    Data = data is not null
                        ? new Dictionary<string, string> { ["payload"] = data }
                        : null,
                    Android = new AndroidConfig
                    {
                        Priority = Priority.High
                    }
                };

                try
                {
                    var messageId = await messaging.SendAsync(message);
                    _logger.LogDebug("FCM: Pesan terkirim. MessageId: {Id}", messageId);
                    successCount++;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("FCM: Gagal kirim ke token {Token}. {Msg}",
                        token[..Math.Min(8, token.Length)] + "...", ex.Message);
                }
            }

            _logger.LogInformation("FCM: Notifikasi '{Title}' terkirim ke {Count}/{Total} device(s).",
                title, successCount, mobileDevices.Count);

            return successCount > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FCM: Error saat mengirim notifikasi '{Title}'.", title);
            return false;
        }
    }

    public async Task RegisterFcmTokenAsync(string deviceId, string fcmToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MayaDbContext>();

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
}
