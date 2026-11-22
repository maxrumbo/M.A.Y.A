namespace Maya.Server.Data.Entities;

/// <summary>
/// Status koneksi dan telemetri hardware perangkat Maxwell (laptop atau HP).
/// Primary Key adalah device_id (string), bukan UUID.
/// Mapped ke tabel PostgreSQL: device_statuses
/// </summary>
public class DeviceStatus
{
    /// <summary>
    /// Identifier unik perangkat, misal: "maxwell-laptop", "maxwell-android"
    /// </summary>
    public string DeviceId { get; set; } = string.Empty;

    /// <summary>
    /// "laptop" atau "mobile"
    /// </summary>
    public string DeviceType { get; set; } = string.Empty;

    /// <summary>
    /// True jika Maya.Agent / Maya.Mobile saat ini terhubung via SignalR.
    /// </summary>
    public bool IsOnline { get; set; }

    public double? CpuUsagePercent { get; set; }
    public double? RamUsagePercent { get; set; }
    public int? BatteryPercent { get; set; }

    /// <summary>
    /// Firebase Cloud Messaging token — hanya ada untuk perangkat mobile.
    /// </summary>
    public string? FcmToken { get; set; }

    /// <summary>
    /// Waktu terakhir heartbeat diterima dari perangkat.
    /// </summary>
    public DateTimeOffset LastSeenAt { get; set; }
}
