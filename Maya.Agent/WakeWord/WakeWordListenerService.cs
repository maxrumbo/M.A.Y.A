using Maya.Agent.Audio;
using Maya.Agent.Services;
using Maya.Shared.DTOs.Agent;

namespace Maya.Agent.WakeWord;

/// <summary>
/// BackgroundService orkestrator Wake-Word di Windows (Phase 6B):
/// - Default OFF (opt-in) sesuai AgentSettingsStore, tidak menyentuh mikrofon bila mati
/// - Mode Hemat Baterai: auto-pause jika baterai < threshold (default 20%) & tidak di-charge,
///   auto-resume jika >= threshold + 5% (hysteresis) atau charger tersambung
/// - Anti-Echo Guard: pause recognizer saat AudioAlertService sedang berbicara/ping, resume setelah 350ms
/// - Cooldown: mencegah trigger berulang/loop (5s wake-word, 10s Find-Me)
/// - Follow-up window 5 detik setelah "Hey Maya" untuk frasa lanjutan "kamu di mana" / "where are you"
/// </summary>
public class WakeWordListenerService : BackgroundService
{
    private readonly IWakeWordEngine _engine;
    private readonly AgentSettingsStore _settingsStore;
    private readonly SystemMonitorService _monitor;
    private readonly AudioAlertService _audioAlert;
    private readonly IConfiguration _config;
    private readonly ILogger<WakeWordListenerService> _logger;

    private readonly object _stateLock = new();
    private bool _engineInitialized;
    private string _logicalState = "Disabled";
    private string? _stateReason = "Dimatikan oleh pengguna (opt-in).";
    private string? _lastHeardPhrase;
    private DateTimeOffset? _lastHeardAt;
    private DateTimeOffset _lastWakeAt = DateTimeOffset.MinValue;
    private DateTimeOffset _lastFindMeAt = DateTimeOffset.MinValue;
    private DateTimeOffset _followUpUntil = DateTimeOffset.MinValue;

    public event Action<WakeWordStatusDto>? StatusChanged;
    public event Action<string, DateTimeOffset>? WakeWordHeard;

    public WakeWordListenerService(
        IWakeWordEngine engine,
        AgentSettingsStore settingsStore,
        SystemMonitorService monitor,
        AudioAlertService audioAlert,
        IConfiguration config,
        ILogger<WakeWordListenerService> logger)
    {
        _engine = engine;
        _settingsStore = settingsStore;
        _monitor = monitor;
        _audioAlert = audioAlert;
        _config = config;
        _logger = logger;

        _engine.WakeWordDetected += OnWakeWordDetected;
        _settingsStore.SettingsUpdated += OnSettingsUpdated;
        _audioAlert.PlaybackStateChanged += OnPlaybackStateChanged;
    }

    public WakeWordStatusDto CurrentStatus
    {
        get
        {
            lock (_stateLock)
            {
                return BuildStatusLocked();
            }
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("WakeWordListenerService dimulai (default state: {State}).", _logicalState);

        // Evaluasi awal dari pengaturan lokal tersimpan
        EvaluateState(forceNotify: true);

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));
        try
        {
            while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
            {
                EvaluateState(forceNotify: false);
            }
        }
        catch (OperationCanceledException)
        {
            // Normal shutdown
        }
    }

    public override Task StopAsync(CancellationToken cancellationToken)
    {
        _engine.Stop();
        _engine.WakeWordDetected -= OnWakeWordDetected;
        _settingsStore.SettingsUpdated -= OnSettingsUpdated;
        _audioAlert.PlaybackStateChanged -= OnPlaybackStateChanged;
        return base.StopAsync(cancellationToken);
    }

    private void OnSettingsUpdated(AgentSettingsDto _)
    {
        EvaluateState(forceNotify: true);
    }

    private void OnPlaybackStateChanged(bool isPlaying)
    {
        if (isPlaying)
        {
            // Anti-Echo Guard: segera jeda recognizer saat Agent mengeluarkan suara/alarm
            _engine.Pause();
        }
        else
        {
            // Beri jeda 350ms agar gema speaker ruangan reda sebelum lanjut mendengarkan
            _ = Task.Run(async () =>
            {
                await Task.Delay(350);
                lock (_stateLock)
                {
                    if (_logicalState == "Active" && !_audioAlert.IsSpeakingOrAlerting)
                    {
                        _engine.Start();
                    }
                }
            });
        }
    }

    /// <summary>
    /// Mengevaluasi state listener berdasarkan pengaturan terkini, dukungan hardware, dan status baterai.
    /// </summary>
    public void EvaluateState(bool forceNotify)
    {
        var settings = _settingsStore.Current;
        var thresholdConfidence = _config.GetValue<double?>("WakeWord:ConfidenceThreshold") ?? 0.80;

        WakeWordStatusDto? statusToBroadcast = null;

        lock (_stateLock)
        {
            var prevState = _logicalState;
            var prevReason = _stateReason;

            if (!settings.WakeWordEnabled)
            {
                _engine.Stop();
                _logicalState = "Disabled";
                _stateReason = "Dimatikan oleh pengguna (opt-in).";
            }
            else
            {
                // Lazy initialize hanya saat user benar-benar mengaktifkan wake-word
                if (!_engineInitialized)
                {
                    _engineInitialized = true;
                    _engine.TryInitialize(thresholdConfidence);
                }

                if (!_engine.IsSupported)
                {
                    _engine.Stop();
                    _logicalState = "Unsupported";
                    _stateReason = _engine.UnsupportedReason ?? "Speech recognizer / mikrofon tidak tersedia.";
                }
                else
                {
                    var (batteryPercent, isCharging) = _monitor.GetBatteryStatus();
                    var threshold = Math.Clamp(settings.BatteryThresholdPercent, 5, 50);
                    var resumeThreshold = Math.Min(threshold + 5, 95); // Hysteresis +5%

                    var shouldPauseForBattery = false;
                    if (settings.BatterySaverEnabled && !isCharging)
                    {
                        if (_logicalState == "PausedBattery")
                        {
                            // Tetap pause sampai baterai >= threshold + 5% (mis. 25%) atau charger dicolok
                            shouldPauseForBattery = batteryPercent < resumeThreshold;
                        }
                        else
                        {
                            shouldPauseForBattery = batteryPercent < threshold;
                        }
                    }

                    if (shouldPauseForBattery)
                    {
                        _engine.Pause();
                        _logicalState = "PausedBattery";
                        _stateReason = $"Dijeda otomatis: baterai {batteryPercent}% (< {threshold}%) dan tidak di-charge.";
                    }
                    else
                    {
                        _logicalState = "Active";
                        _stateReason = null;

                        if (!_audioAlert.IsSpeakingOrAlerting)
                        {
                            _engine.Start();
                        }
                    }
                }
            }

            if (forceNotify || prevState != _logicalState || prevReason != _stateReason)
            {
                statusToBroadcast = BuildStatusLocked();
                _logger.LogInformation(
                    "Status WakeWordListener: {State} | Engine={Engine} | Reason={Reason}",
                    statusToBroadcast.State, statusToBroadcast.Engine, statusToBroadcast.Reason ?? "-");
            }
        }

        if (statusToBroadcast is not null)
        {
            StatusChanged?.Invoke(statusToBroadcast);
        }
    }

    private void OnWakeWordDetected(object? sender, WakeWordDetectedEventArgs e)
    {
        // Extra safety anti-echo: abaikan bila Agent sedang bersuara
        if (_audioAlert.IsSpeakingOrAlerting)
        {
            return;
        }

        var normalized = e.Phrase.Trim().ToLowerInvariant();
        var now = e.DetectedAt;

        var wakeCooldownSec = _config.GetValue<int?>("WakeWord:CooldownSeconds") ?? 5;
        var findMeCooldownSec = _config.GetValue<int?>("WakeWord:FindMeCooldownSeconds") ?? 10;

        bool isStopPhrase = normalized is "maya stop" or "stop maya" or "maya diam";
        bool isDirectFindMe = normalized is "maya kamu di mana" or "maya dimana" or "maya where are you" or "where are you maya";
        bool isFollowUpFindMe = normalized is "kamu di mana" or "where are you";
        bool isPlainWake = normalized is "maya" or "hey maya" or "hai maya";

        if (isStopPhrase)
        {
            RecordHeard(e.Phrase, now);
            _audioAlert.StopFindMe();
            return;
        }

        if (isFollowUpFindMe)
        {
            bool withinWindow;
            lock (_stateLock)
            {
                withinWindow = now <= _followUpUntil;
            }

            if (!withinWindow)
            {
                // Di luar jendela follow-up 5 detik → abaikan agar tidak false trigger
                return;
            }

            isDirectFindMe = true;
        }

        if (isDirectFindMe)
        {
            lock (_stateLock)
            {
                if ((now - _lastFindMeAt).TotalSeconds < findMeCooldownSec)
                {
                    _logger.LogDebug("Wake-word Find-Me diabaikan karena masih dalam masa cooldown ({Sec}s).", findMeCooldownSec);
                    return;
                }

                _lastFindMeAt = now;
                _followUpUntil = DateTimeOffset.MinValue;
            }

            RecordHeard(e.Phrase, now);
            _ = _audioAlert.StartFindMeAsync();
            return;
        }

        if (isPlainWake)
        {
            lock (_stateLock)
            {
                if ((now - _lastWakeAt).TotalSeconds < wakeCooldownSec)
                {
                    _logger.LogDebug("Wake-word '{Phrase}' diabaikan karena masih dalam masa cooldown ({Sec}s).", e.Phrase, wakeCooldownSec);
                    return;
                }

                _lastWakeAt = now;
            }

            RecordHeard(e.Phrase, now);

            _ = Task.Run(async () =>
            {
                await _audioAlert.PlayAcknowledgeAsync("Ya, Max?");
                lock (_stateLock)
                {
                    // Buka jendela follow-up 5 detik setelah M.A.Y.A. selesai menyaut
                    _followUpUntil = DateTimeOffset.UtcNow.AddSeconds(5);
                }
            });
        }
    }

    private void RecordHeard(string phrase, DateTimeOffset timestamp)
    {
        WakeWordStatusDto updatedStatus;
        lock (_stateLock)
        {
            _lastHeardPhrase = phrase;
            _lastHeardAt = timestamp;
            updatedStatus = BuildStatusLocked();
        }

        WakeWordHeard?.Invoke(phrase, timestamp);
        StatusChanged?.Invoke(updatedStatus);
    }

    private WakeWordStatusDto BuildStatusLocked()
    {
        return new WakeWordStatusDto(
            State: _logicalState,
            Engine: _engine.EngineName,
            Reason: _stateReason,
            UpdatedAt: DateTimeOffset.UtcNow,
            LastHeardPhrase: _lastHeardPhrase,
            LastHeardAt: _lastHeardAt
        );
    }
}
