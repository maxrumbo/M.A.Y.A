using System.Collections.Concurrent;
using Maya.Server.Hubs;
using Maya.Server.Services.Interfaces;
using Maya.Shared.DTOs.Agent;
using Maya.Shared.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace Maya.Server.Services;

/// <summary>
/// Phase 7: Singleton registry HP Android online + pengirim ping Find-Me ke group "MobileDevices".
/// </summary>
public class MobileDeviceService : IMobileDeviceService
{
    public const string MobileGroup = "MobileDevices";
    private const string PhoneKey = "phone";

    private readonly IHubContext<MayaHub, IMayaHubClient> _hubContext;
    private readonly IAgentSettingsService _agentSettings;
    private readonly ILogger<MobileDeviceService> _logger;

    // connectionId -> deviceId
    private readonly ConcurrentDictionary<string, string> _connections = new();

    public MobileDeviceService(
        IHubContext<MayaHub, IMayaHubClient> hubContext,
        IAgentSettingsService agentSettings,
        ILogger<MobileDeviceService> logger)
    {
        _hubContext = hubContext;
        _agentSettings = agentSettings;
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
        var count = OnlineCount;
        if (count == 0)
        {
            return new FindMyPhoneResult(
                FindMyPhoneOutcome.NoDeviceOnline,
                0,
                "HP belum terhubung. Buka aplikasi M.A.Y.A. di HP (dan login) dulu agar bisa dibunyikan.");
        }

        var duration = Math.Clamp(durationSeconds ?? 10, 1, 30);

        if (!_agentSettings.TryAcquireFindMeCooldown(PhoneKey, duration, out var retryAfter))
        {
            return new FindMyPhoneResult(
                FindMyPhoneOutcome.Cooldown,
                count,
                $"HP baru saja dibunyikan. Tunggu {retryAfter} detik sebelum mencoba lagi.",
                retryAfter);
        }

        var cleanMessage = string.IsNullOrWhiteSpace(message) ? null : message.Trim();
        await _hubContext.Clients.Group(MobileGroup).FindMyPhoneRequested(new FindMeRequestDto(duration, cleanMessage));
        await _hubContext.Clients.All.MobileStatusChanged(GetStatus());

        _logger.LogInformation("Find-Me HP dikirim ke {Count} perangkat selama {Sec} detik.", count, duration);

        return new FindMyPhoneResult(
            FindMyPhoneOutcome.Sent,
            count,
            $"Ping Find-Me terkirim ke {count} HP yang sedang online ({duration} detik). " +
            "Catatan: server hanya memastikan ping terkirim, bukan bahwa HP benar-benar berbunyi.");
    }

    public async Task<int> StopFindMyPhoneAsync()
    {
        _agentSettings.MarkFindMeStopped(PhoneKey);
        await _hubContext.Clients.Group(MobileGroup).StopFindMyPhone();
        await _hubContext.Clients.All.MobileStatusChanged(GetStatus());
        return OnlineCount;
    }
}
