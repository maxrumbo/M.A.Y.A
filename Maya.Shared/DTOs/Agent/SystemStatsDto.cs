namespace Maya.Shared.DTOs.Agent;

/// <summary>
/// Data telemetri hardware laptop yang dikirim Maya.Agent setiap 30 detik (heartbeat).
/// </summary>
public record SystemStatsDto(
    string DeviceId,
    double CpuUsagePercent,
    double RamUsagePercent,
    int BatteryPercent,
    DateTimeOffset Timestamp
);
