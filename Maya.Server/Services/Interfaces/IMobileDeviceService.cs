using Maya.Shared.DTOs.Agent;

namespace Maya.Server.Services.Interfaces;

public enum FindMyPhoneOutcome
{
    Sent,
    NoDeviceOnline,
    Cooldown
}

public record FindMyPhoneResult(
    FindMyPhoneOutcome Outcome,
    int DeviceCount,
    string Message,
    int RetryAfterSeconds = 0
);

/// <summary>
/// Phase 7: Melacak HP Android yang terhubung ke MayaHub (JWT valid) dan mengirim ping Find-Me ke HP tersebut.
/// </summary>
public interface IMobileDeviceService
{
    void Register(string connectionId, string deviceId);
    bool Unregister(string connectionId);
    int OnlineCount { get; }
    MobileStatusDto GetStatus();

    Task<FindMyPhoneResult> FindMyPhoneAsync(int? durationSeconds, string? message);
    Task<int> StopFindMyPhoneAsync();
}
