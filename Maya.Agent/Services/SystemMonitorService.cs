using System.Diagnostics;
using System.Runtime.InteropServices;
using Maya.Shared.DTOs.Agent;

namespace Maya.Agent.Services;

/// <summary>
/// Layanan pengumpul telemetri hardware laptop Windows:
/// - CPU Usage (%)
/// - RAM Usage (%)
/// - Battery Level (%)
/// </summary>
public class SystemMonitorService : IDisposable
{
    private readonly IConfiguration _config;
    private readonly ILogger<SystemMonitorService> _logger;

    private readonly string _deviceId;
    private PerformanceCounter? _cpuCounter;
    private double _lastCpu = 0.0;
    private double _lastRam = 0.0;
    private int _lastBattery = 100;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    private class MEMORYSTATUSEX
    {
        public uint dwLength;
        public uint dwMemoryLoad;
        public ulong ullTotalPhys;
        public ulong ullAvailPhys;
        public ulong ullTotalPageFile;
        public ulong ullAvailPageFile;
        public ulong ullTotalVirtual;
        public ulong ullAvailVirtual;
        public ulong ullAvailExtendedVirtual;

        public MEMORYSTATUSEX()
        {
            dwLength = (uint)Marshal.SizeOf(typeof(MEMORYSTATUSEX));
        }
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GlobalMemoryStatusEx([In, Out] MEMORYSTATUSEX lpBuffer);

    [StructLayout(LayoutKind.Sequential)]
    private struct SYSTEM_POWER_STATUS
    {
        public byte ACLineStatus;
        public byte BatteryFlag;
        public byte BatteryLifePercent;
        public byte SystemStatusFlag;
        public uint BatteryLifeTime;
        public uint BatteryFullLifeTime;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetSystemPowerStatus(out SYSTEM_POWER_STATUS sps);

    public SystemMonitorService(IConfiguration config, ILogger<SystemMonitorService> logger)
    {
        _config = config;
        _logger = logger;
        _deviceId = config["DeviceId"] ?? "maxwell-laptop";

        InitCpuCounter();
    }

    private void InitCpuCounter()
    {
        try
        {
            if (OperatingSystem.IsWindows())
            {
                _cpuCounter = new PerformanceCounter("Processor", "% Processor Time", "_Total");
                _cpuCounter.NextValue(); // First reading is always 0
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Tidak dapat menginisialisasi PerformanceCounter CPU.");
        }
    }

    public SystemStatsDto GetLatestStats()
    {
        CollectMetrics();

        return new SystemStatsDto(
            DeviceId: _deviceId,
            CpuUsagePercent: Math.Round(_lastCpu, 1),
            RamUsagePercent: Math.Round(_lastRam, 1),
            BatteryPercent: _lastBattery,
            Timestamp: DateTimeOffset.UtcNow
        );
    }

    private void CollectMetrics()
    {
        try
        {
            // 1. CPU
            if (_cpuCounter != null && OperatingSystem.IsWindows())
            {
                _lastCpu = _cpuCounter.NextValue();
            }

            // 2. RAM
            if (OperatingSystem.IsWindows())
            {
                var memStatus = new MEMORYSTATUSEX();
                if (GlobalMemoryStatusEx(memStatus))
                {
                    _lastRam = memStatus.dwMemoryLoad;
                }
            }

            // 3. Battery
            if (OperatingSystem.IsWindows())
            {
                if (GetSystemPowerStatus(out var sps))
                {
                    if (sps.BatteryLifePercent != 255) // 255 = unknown/desktop
                    {
                        _lastBattery = sps.BatteryLifePercent;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Gagal mengumpulkan satu atau lebih metrik telemetri hardware.");
        }
    }

    public void Dispose()
    {
        _cpuCounter?.Dispose();
    }
}
