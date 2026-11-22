namespace Maya.Shared.DTOs.Agent;

/// <summary>
/// Status perangkat (laptop atau mobile) yang dibroadcast ke semua client
/// melalui SignalR saat ada perubahan koneksi atau update telemetri.
/// </summary>
public record DeviceStatusDto(
    string DeviceId,
    string DeviceType,
    bool IsOnline,
    double? CpuUsagePercent,
    double? RamUsagePercent,
    int? BatteryPercent,
    DateTimeOffset LastSeenAt
);
