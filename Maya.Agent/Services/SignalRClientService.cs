using Maya.Agent.WakeWord;
using Maya.Shared.DTOs.Agent;
using Microsoft.AspNetCore.SignalR.Client;

namespace Maya.Agent.Services;

/// <summary>
/// Menjaga koneksi real-time ke Maya.Server via SignalR Hub (/hubs/maya).
/// Fitur:
/// - Header autentikasi X-Agent-Secret
/// - WithAutomaticReconnect() untuk koneksi lab/kampus yang dinamis
/// - Listener ExecuteCommand & AgentSettingsChanged (Phase 6B)
/// - Pelaporan WakeWordStatus & WakeWordHeard ke server (Phase 6B)
/// - Heartbeat telemetri berkala (setiap 30 detik)
/// </summary>
public class SignalRClientService : IAsyncDisposable
{
    private readonly IConfiguration _config;
    private readonly CommandExecutorService _executor;
    private readonly SystemMonitorService _monitor;
    private readonly AgentSettingsStore _settingsStore;
    private readonly WakeWordListenerService _wakeWordListener;
    private readonly ILogger<SignalRClientService> _logger;

    private HubConnection? _hubConnection;
    private CancellationTokenSource? _heartbeatCts;
    private Task? _heartbeatTask;

    public SignalRClientService(
        IConfiguration config,
        CommandExecutorService executor,
        SystemMonitorService monitor,
        AgentSettingsStore settingsStore,
        WakeWordListenerService wakeWordListener,
        ILogger<SignalRClientService> logger)
    {
        _config = config;
        _executor = executor;
        _monitor = monitor;
        _settingsStore = settingsStore;
        _wakeWordListener = wakeWordListener;
        _logger = logger;

        _wakeWordListener.StatusChanged += status => _ = ReportWakeWordStatusAsync(status);
        _wakeWordListener.WakeWordHeard += (phrase, ts) => _ = ReportWakeWordHeardAsync(phrase, ts);
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var hubUrl = _config["ServerHubUrl"] ?? "http://localhost:5063/hubs/maya";
        var agentSecret = _config["Maya:AgentSecret"] ?? "";

        _logger.LogInformation("Menghubungkan ke MayaHub di {Url}...", hubUrl);

        _hubConnection = new HubConnectionBuilder()
            .WithUrl(hubUrl, options =>
            {
                if (!string.IsNullOrWhiteSpace(agentSecret))
                {
                    options.Headers["X-Agent-Secret"] = agentSecret;
                }
            })
            .WithAutomaticReconnect(new[]
            {
                TimeSpan.Zero,
                TimeSpan.FromSeconds(2),
                TimeSpan.FromSeconds(5),
                TimeSpan.FromSeconds(10),
                TimeSpan.FromSeconds(30)
            })
            .Build();

        // Daftarkan handler perintah dari server
        _hubConnection.On<AgentCommandDto>("ExecuteCommand", async (command) =>
        {
            _logger.LogInformation("Menerima permintaan eksekusi dari Maya.Server: {Name}", command.CommandName);
            var result = await _executor.ExecuteAsync(command);

            try
            {
                if (_hubConnection.State == HubConnectionState.Connected)
                {
                    await _hubConnection.InvokeAsync("ReportCommandResult", result);
                    _logger.LogInformation("Hasil command {Id} berhasil dilaporkan ke server.", result.CommandId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Gagal mengirimkan ReportCommandResult ke server.");
            }
        });

        // Phase 6B: Handler pengaturan wake-word & hemat baterai dari Maya.Server
        _hubConnection.On<AgentSettingsDto>("AgentSettingsChanged", (settings) =>
        {
            _logger.LogInformation(
                "Menerima AgentSettingsChanged dari server: WakeWord={Wake}, BatterySaver={Saver}, Threshold={Thr}%",
                settings.WakeWordEnabled, settings.BatterySaverEnabled, settings.BatteryThresholdPercent);
            _settingsStore.Update(settings);
        });

        _hubConnection.Reconnecting += error =>
        {
            _logger.LogWarning("Koneksi SignalR ke server terputus. Mencoba reconnect otomatis... Error: {Msg}", error?.Message);
            return Task.CompletedTask;
        };

        _hubConnection.Reconnected += async connectionId =>
        {
            _logger.LogInformation("Koneksi SignalR berhasil tersambung kembali. New connection ID: {Id}", connectionId);
            await ReportWakeWordStatusAsync(_wakeWordListener.CurrentStatus);
        };

        _hubConnection.Closed += error =>
        {
            _logger.LogWarning("Koneksi SignalR ditutup. Error: {Msg}", error?.Message);
            return Task.CompletedTask;
        };

        try
        {
            await _hubConnection.StartAsync(cancellationToken);
            _logger.LogInformation("Berhasil terhubung ke MayaHub via SignalR! (State: {State})", _hubConnection.State);

            // Kirim heartbeat pertama & status wake-word segera setelah terhubung
            await SendHeartbeatAsync();
            await ReportWakeWordStatusAsync(_wakeWordListener.CurrentStatus);

            // Mulai loop heartbeat berkala
            _heartbeatCts = new CancellationTokenSource();
            _heartbeatTask = HeartbeatLoopAsync(_heartbeatCts.Token);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gagal memulai koneksi ke MayaHub. Daemon akan mencoba terhubung kembali di background.");
        }
    }

    private async Task HeartbeatLoopAsync(CancellationToken ct)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));

        while (!ct.IsCancellationRequested && await timer.WaitForNextTickAsync(ct))
        {
            try
            {
                if (_hubConnection?.State == HubConnectionState.Connected)
                {
                    await SendHeartbeatAsync();
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Gagal mengirim heartbeat ke MayaHub.");
            }
        }
    }

    private async Task SendHeartbeatAsync()
    {
        if (_hubConnection?.State != HubConnectionState.Connected) return;

        var stats = _monitor.GetLatestStats();
        await _hubConnection.InvokeAsync("SendHeartbeat", stats);
        _logger.LogDebug("Heartbeat terkirim: CPU={Cpu}%, RAM={Ram}%, Bat={Bat}%",
            stats.CpuUsagePercent, stats.RamUsagePercent, stats.BatteryPercent);
    }

    private async Task ReportWakeWordStatusAsync(WakeWordStatusDto status)
    {
        try
        {
            if (_hubConnection?.State == HubConnectionState.Connected)
            {
                await _hubConnection.InvokeAsync("ReportWakeWordStatus", status);
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Gagal melaporkan WakeWordStatus ke MayaHub.");
        }
    }

    private async Task ReportWakeWordHeardAsync(string phrase, DateTimeOffset timestamp)
    {
        try
        {
            if (_hubConnection?.State == HubConnectionState.Connected)
            {
                await _hubConnection.InvokeAsync("ReportWakeWordHeard", phrase, timestamp);
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Gagal melaporkan WakeWordHeard ke MayaHub.");
        }
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Menghentikan SignalRClientService...");

        if (_heartbeatCts != null)
        {
            _heartbeatCts.Cancel();
            if (_heartbeatTask != null)
            {
                try { await _heartbeatTask; } catch { }
            }
        }

        if (_hubConnection != null)
        {
            await _hubConnection.StopAsync(cancellationToken);
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_hubConnection != null)
        {
            await _hubConnection.DisposeAsync();
        }
        _heartbeatCts?.Dispose();
    }
}
