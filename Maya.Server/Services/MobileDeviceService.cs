using System.Collections.Concurrent;
using Maya.Server.Hubs;
using Maya.Server.Services.Interfaces;
using Maya.Shared.DTOs.Agent;
using Maya.Shared.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace Maya.Server.Services;

/// <summary>
/// Phase 7 &amp; 8: Singleton registry HP Android online + pengirim ping Find-Me.
/// Jalur 1: SignalR group "MobileDevices" (HP sedang membuka app).
/// Jalur 2 (Phase 8): FCM high-priority data message type="find_me" — membangunkan HP
/// meski app tertutup total / SignalR sudah mati.
/// </summary>
public class MobileDeviceService : IMobileDeviceService
{
    public const string MobileGroup = "MobileDevices";
    private const string PhoneKey = "phone";

    private readonly IHubContext<MayaHub, IMayaHubClient> _hubContext;
    private readonly IAgentSettingsService _agentSettings;
    private readonly IFcmNotificationService _fcm;
    private readonly ILogger<MobileDeviceService> _logger;

    // connectionId -> deviceId
    private readonly ConcurrentDictionary<string, string> _connections = new();

    public MobileDeviceService(
        IHubContext<MayaHub, IMayaHubClient> hubContext,
        IAgentSettingsService agentSettings,
        IFcmNotificationService fcm,
        ILogger<MobileDeviceService> logger)
    {
        _hubContext = hubContext;
        _agentSettings = agentSettings;
        _fcm = fcm;
        _logger = logger;
    }

    public void Register(string connectionId, string deviceId)
    {
        _connections[connectionId] = deviceId;
    }

    public bool Unregister(string connectionId)
    {
        return _connections.TryRemove(connectionId, out _);
    }

    public int OnlineCount => _connections.Values.Distinct(StringComparer.Ordinal).Count();

    public MobileStatusDto GetStatus()
    {
        return new MobileStatusDto(OnlineCount, _agentSettings.IsFindMeActiveFor(PhoneKey));
    }

    public async Task<FindMyPhoneResult> FindMyPhoneAsync(int? durationSeconds, string? message)
    {
        var online = OnlineCount;
        var pushDevices = await CountPushDevicesSafeAsync();

        if (online == 0 && pushDevices == 0)
        {
            return new FindMyPhoneResult(
                FindMyPhoneOutcome.NoDeviceOnline,
                0,
                "HP belum terhubung. Buka aplikasi M.A.Y.A. di HP (dan login) dulu agar bisa dibunyikan. " +
                "Agar bisa dibunyikan saat app tertutup, aktifkan Push Notification (Firebase) di panel Integrasi.");
        }

        var duration = Math.Clamp(durationSeconds ?? 10, 1, 30);

        if (!_agentSettings.TryAcquireFindMeCooldown(PhoneKey, duration, out var retryAfter))
        {
            return new FindMyPhoneResult(
                FindMyPhoneOutcome.Cooldown,
                Math.Max(online, pushDevices),
                $"HP baru saja dibunyikan. Tunggu {retryAfter} detik sebelum mencoba lagi.",
                retryAfter);
        }

        var cleanMessage = string.IsNullOrWhiteSpace(message) ? null : message.Trim();

        // Jalur 1: SignalR (HP sedang membuka app)
        if (online > 0)
        {
            await _hubContext.Clients.Group(MobileGroup).FindMyPhoneRequested(new FindMeRequestDto(duration, cleanMessage));
        }

        // Jalur 2: FCM data message (membangunkan app yang tertutup / socket basi)
        var pushed = 0;
        if (pushDevices > 0 && _fcm.IsConfigured)
        {
            try
            {
                pushed = await _fcm.SendDataMessageAsync(new Dictionary<string, string>
                {
                    ["type"] = "find_me",
                    ["durationSeconds"] = duration.ToString(),
                    ["message"] = cleanMessage ?? string.Empty
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Find-Me HP: pengiriman FCM gagal. {Msg}", ex.Message);
            }
        }

        await _hubContext.Clients.All.MobileStatusChanged(GetStatus());

        _logger.LogInformation(
            "Find-Me HP dikirim: SignalR={Online} perangkat, FCM={Pushed} perangkat, {Sec} detik.",
            online, pushed, duration);

        if (online == 0 && pushed == 0)
        {
            return new FindMyPhoneResult(
                FindMyPhoneOutcome.NoDeviceOnline,
                0,
                "HP tidak sedang membuka app dan push FCM tidak terkirim (cek konfigurasi Firebase di server).");
        }

        var channels = online > 0 && pushed > 0 ? "SignalR + FCM push"
                     : online > 0 ? "SignalR"
                     : "FCM push (app tertutup)";

        return new FindMyPhoneResult(
            FindMyPhoneOutcome.Sent,
            online > 0 ? online : pushed,
            $"Ping Find-Me terkirim via {channels} ({duration} detik). " +
            "Catatan: server hanya memastikan ping terkirim, bukan bahwa HP benar-benar berbunyi.");
    }

    public async Task<int> StopFindMyPhoneAsync()
    {
        _agentSettings.MarkFindMeStopped(PhoneKey);
        await _hubContext.Clients.Group(MobileGroup).StopFindMyPhone();

        if (_fcm.IsConfigured)
        {
            try
            {
                await _fcm.SendDataMessageAsync(
                    new Dictionary<string, string> { ["type"] = "find_me_stop" },
                    TimeSpan.FromSeconds(30));
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Stop Find-Me HP: pengiriman FCM gagal. {Msg}", ex.Message);
            }
        }

        await _hubContext.Clients.All.MobileStatusChanged(GetStatus());
        return OnlineCount;
    }

    private async Task<int> CountPushDevicesSafeAsync()
    {
        if (!_fcm.IsConfigured) return 0;
        try
        {
            return await _fcm.CountRegisteredDevicesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Find-Me HP: gagal menghitung device FCM (DB offline?). {Msg}", ex.Message);
            return 0;
        }
    }
}
