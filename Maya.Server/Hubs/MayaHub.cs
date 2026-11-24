using System.Security.Cryptography;
using Maya.Server.Data;
using Maya.Server.Data.Entities;
using Maya.Server.Services;
using Maya.Server.Services.Interfaces;
using Maya.Shared.DTOs.Agent;
using Maya.Shared.Interfaces;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Maya.Server.Hubs;

/// <summary>
/// SignalR Hub utama M.A.Y.A. (/hubs/maya).
/// Menghubungkan Maya.Server (Cloud) dengan:
/// 1. Maya.Agent (Windows Laptop Daemon) - diautentikasi dengan X-Agent-Secret
/// 2. Client Web / Mobile - mendengarkan update real-time status laptop & eksekusi command
/// </summary>
public class MayaHub : Hub<IMayaHubClient>
{
    private readonly IConfiguration _config;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IAgentDispatcherService _dispatcher;
    private readonly IAgentSettingsService _agentSettings;
    private readonly IMobileDeviceService _mobileDevices;
    private readonly ILogger<MayaHub> _logger;

    private const string LaptopGroup = "LaptopAgent";
    private const string DefaultLaptopDeviceId = "maxwell-laptop";

    public MayaHub(
        IConfiguration config,
        IServiceScopeFactory scopeFactory,
        IAgentDispatcherService dispatcher,
        IAgentSettingsService agentSettings,
        IMobileDeviceService mobileDevices,
        ILogger<MayaHub> logger)
    {
        _config = config;
        _scopeFactory = scopeFactory;
        _dispatcher = dispatcher;
        _agentSettings = agentSettings;
        _mobileDevices = mobileDevices;
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var httpContext = Context.GetHttpContext();
        var agentSecretHeader = httpContext?.Request.Headers["X-Agent-Secret"].FirstOrDefault();
        var expectedSecret = _config["Maya:AgentSecret"];

        if (!string.IsNullOrWhiteSpace(expectedSecret) &&
            !string.IsNullOrWhiteSpace(agentSecretHeader) &&
            CryptographicOperations.FixedTimeEquals(
                System.Text.Encoding.UTF8.GetBytes(agentSecretHeader),
                System.Text.Encoding.UTF8.GetBytes(expectedSecret)))
        {
            // Koneksi dari Maya.Agent terverifikasi
            Context.Items["IsAgent"] = true;
            await Groups.AddToGroupAsync(Context.ConnectionId, LaptopGroup);
            _logger.LogInformation("Maya.Agent connected (ConnectionId: {ConnId}). Added to {Group}.",
                Context.ConnectionId, LaptopGroup);

            // Update status online di database
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<MayaDbContext>();

            var device = await db.DeviceStatuses.FindAsync(DefaultLaptopDeviceId);
            var now = DateTimeOffset.UtcNow;

            if (device is null)
            {
                device = new DeviceStatus
                {
                    DeviceId = DefaultLaptopDeviceId,
                    DeviceType = "laptop",
                    IsOnline = true,
                    LastSeenAt = now
                };
                db.DeviceStatuses.Add(device);
            }
            else
            {
                device.IsOnline = true;
                device.LastSeenAt = now;
            }

            await db.SaveChangesAsync();

            // Broadcast ke semua client
            await Clients.Others.AgentStatusChanged(new DeviceStatusDto(
                DeviceId: device.DeviceId,
                DeviceType: device.DeviceType,
                IsOnline: true,
                CpuUsagePercent: device.CpuUsagePercent,
                RamUsagePercent: device.RamUsagePercent,
                BatteryPercent: device.BatteryPercent,
                LastSeenAt: device.LastSeenAt
            ));

            // Phase 6B: Push pengaturan wake-word & hemat baterai terakhir ke Agent yang baru terhubung
            await Clients.Caller.AgentSettingsChanged(_agentSettings.GetSettings());
        }
        else
        {
            // Phase 7 hardening: client non-Agent WAJIB membawa JWT valid.
            // Koneksi anonim ditolak agar tidak menerima broadcast (status laptop, wake-word, Find-Me).
            if (Context.User?.Identity?.IsAuthenticated != true)
            {
                _logger.LogWarning(
                    "Koneksi anonim ke MayaHub ditolak (ConnId: {ConnId}). Client wajib membawa JWT valid.",
                    Context.ConnectionId);
                Context.Abort();
                return;
            }

            _logger.LogInformation("Client connected to MayaHub: {ConnId}", Context.ConnectionId);
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        // Phase 7: bersihkan registrasi HP Android (jika koneksi ini adalah HP)
        if (_mobileDevices.Unregister(Context.ConnectionId))
        {
            _logger.LogInformation("HP Android terputus dari MayaHub: {ConnId}", Context.ConnectionId);
            await Clients.All.MobileStatusChanged(_mobileDevices.GetStatus());
        }

        if (Context.Items.TryGetValue("IsAgent", out var isAgentObj) && isAgentObj is true)
        {
            _logger.LogWarning("Maya.Agent disconnected: {ConnId}", Context.ConnectionId);

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<MayaDbContext>();

            var device = await db.DeviceStatuses.FindAsync(DefaultLaptopDeviceId);
            var now = DateTimeOffset.UtcNow;

            if (device is not null)
            {
                device.IsOnline = false;
                device.LastSeenAt = now;
                await db.SaveChangesAsync();

                await Clients.Others.AgentStatusChanged(new DeviceStatusDto(
                    DeviceId: device.DeviceId,
                    DeviceType: device.DeviceType,
                    IsOnline: false,
                    CpuUsagePercent: device.CpuUsagePercent,
                    RamUsagePercent: device.RamUsagePercent,
                    BatteryPercent: device.BatteryPercent,
                    LastSeenAt: now
                ));
            }

            // Phase 6B: Tandai status wake-word offline & broadcast ke UI
            _agentSettings.MarkAgentOffline();
            await Clients.Others.WakeWordStatusChanged(_agentSettings.GetWakeWordStatus());
        }

        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Dipanggil berkala oleh Maya.Agent (setiap 30 detik) untuk melaporkan statistik CPU, RAM, Baterai.
    /// </summary>
    public async Task SendHeartbeat(SystemStatsDto stats)
    {
        if (!Context.Items.ContainsKey("IsAgent"))
        {
            _logger.LogWarning("SendHeartbeat diabaikan: bukan dari Maya.Agent terautentikasi.");
            return;
        }

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MayaDbContext>();

        var device = await db.DeviceStatuses.FindAsync(stats.DeviceId);
        var now = DateTimeOffset.UtcNow;

        if (device is null)
        {
            device = new DeviceStatus
            {
                DeviceId = stats.DeviceId,
                DeviceType = "laptop",
                IsOnline = true,
                CpuUsagePercent = stats.CpuUsagePercent,
                RamUsagePercent = stats.RamUsagePercent,
                BatteryPercent = stats.BatteryPercent,
                LastSeenAt = now
            };
            db.DeviceStatuses.Add(device);
        }
        else
        {
            device.IsOnline = true;
            device.CpuUsagePercent = stats.CpuUsagePercent;
            device.RamUsagePercent = stats.RamUsagePercent;
            device.BatteryPercent = stats.BatteryPercent;
            device.LastSeenAt = now;
        }

        await db.SaveChangesAsync();

        // Broadcast status terbaru ke Web/Mobile app
        await Clients.Others.AgentStatusChanged(new DeviceStatusDto(
            DeviceId: device.DeviceId,
            DeviceType: device.DeviceType,
            IsOnline: true,
            CpuUsagePercent: device.CpuUsagePercent,
            RamUsagePercent: device.RamUsagePercent,
            BatteryPercent: device.BatteryPercent,
            LastSeenAt: now
        ));
    }

    /// <summary>
    /// Dipanggil oleh Maya.Agent setelah selesai mengeksekusi suatu command lokal.
    /// </summary>
    public async Task ReportCommandResult(CommandResultDto result)
    {
        _logger.LogInformation("Menerima command result untuk CommandId={CommandId}, IsSuccess={IsSuccess}",
            result.CommandId, result.IsSuccess);

        _dispatcher.HandleResult(result);

        // Update di database
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MayaDbContext>();

        var log = await db.CommandLogs.FindAsync(result.CommandId);
        if (log is not null)
        {
            log.Status = result.IsSuccess ? "Completed" : "Failed";
            log.ResultOutput = result.Output;
            log.CompletedAt = result.CompletedAt;
            await db.SaveChangesAsync();
        }

        // Broadcast status update
        await Clients.Others.CommandStatusUpdated(
            result.CommandId,
            result.IsSuccess ? "Completed" : "Failed",
            result.Output
        );
    }

    /// <summary>
    /// Phase 6B: Dipanggil oleh Maya.Agent saat status listener wake-word berubah
    /// (Active / PausedBattery / Disabled / Unsupported).
    /// </summary>
    public async Task ReportWakeWordStatus(WakeWordStatusDto status)
    {
        if (!Context.Items.ContainsKey("IsAgent"))
        {
            _logger.LogWarning("ReportWakeWordStatus diabaikan: bukan dari Maya.Agent terautentikasi.");
            return;
        }

        _agentSettings.UpdateWakeWordStatus(status);
        var merged = _agentSettings.GetWakeWordStatus();

        _logger.LogInformation("WakeWordStatus dari Agent: {State} ({Engine}) - {Reason}",
            merged.State, merged.Engine, merged.Reason ?? "-");

        await Clients.Others.WakeWordStatusChanged(merged);
    }

    /// <summary>
    /// Phase 6B: Dipanggil oleh Maya.Agent saat frasa wake-word dikenali secara lokal.
    /// </summary>
    public async Task ReportWakeWordHeard(string phrase, DateTimeOffset timestamp)
    {
        if (!Context.Items.ContainsKey("IsAgent"))
        {
            _logger.LogWarning("ReportWakeWordHeard diabaikan: bukan dari Maya.Agent terautentikasi.");
            return;
        }

        _agentSettings.RecordWakeWordHeard(phrase, timestamp);
        _logger.LogInformation("WakeWordHeard dari Agent: '{Phrase}' pada {Time}", phrase, timestamp);

        await Clients.Others.WakeWordHeard(phrase, timestamp);
        await Clients.Others.WakeWordStatusChanged(_agentSettings.GetWakeWordStatus());
    }

    /// <summary>
    /// Phase 7: Dipanggil oleh app Android (maya-client di dalam APK) setelah terhubung untuk mendaftarkan
    /// HP sebagai target "Find My Phone". Hanya untuk koneksi ber-JWT valid (bukan Agent).
    /// </summary>
    public async Task RegisterMobileDevice(string deviceId)
    {
        if (Context.Items.ContainsKey("IsAgent") || Context.User?.Identity?.IsAuthenticated != true)
        {
            _logger.LogWarning("RegisterMobileDevice ditolak: koneksi tidak terautentikasi sebagai client mobile.");
            return;
        }

        var safeId = new string((deviceId ?? string.Empty)
            .Where(c => char.IsLetterOrDigit(c) || c == '-' || c == '_')
            .Take(64)
            .ToArray());
        if (string.IsNullOrWhiteSpace(safeId))
        {
            safeId = "maxwell-phone";
        }

        _mobileDevices.Register(Context.ConnectionId, safeId);
        await Groups.AddToGroupAsync(Context.ConnectionId, MobileDeviceService.MobileGroup);

        _logger.LogInformation("HP Android terdaftar sebagai target Find-Me (device: {DeviceId}).", safeId);
        await Clients.All.MobileStatusChanged(_mobileDevices.GetStatus());
    }
}
