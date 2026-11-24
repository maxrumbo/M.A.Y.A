using System.Text.Json;
using Maya.Server.Hubs;
using Maya.Server.Services.Interfaces;
using Maya.Shared.DTOs.Agent;
using Maya.Shared.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace Maya.Server.Services;

/// <summary>
/// Phase 6B/7: Sumber kebenaran pengaturan Wake-Word & Hemat Baterai (tersimpan di App_Data/agent-settings.json),
/// melacak status live WakeWordStatusDto dari Maya.Agent, dan menerapkan cooldown Find-Me per perangkat.
/// </summary>
public class AgentSettingsService : IAgentSettingsService
{
    private readonly IHubContext<MayaHub, IMayaHubClient> _hubContext;
    private readonly ILogger<AgentSettingsService> _logger;
    private readonly string _settingsFilePath;
    private readonly object _syncLock = new();

    private const string LaptopGroup = "LaptopAgent";
    private const string LaptopKey = "laptop";
    private const int FindMeCooldownSeconds = 10;

    private AgentSettingsDto _settings;
    private WakeWordStatusDto _wakeWordStatus;
    private readonly Dictionary<string, DateTimeOffset> _cooldownUntil = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, DateTimeOffset> _activeUntil = new(StringComparer.OrdinalIgnoreCase);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true
    };

    public AgentSettingsService(
        IHubContext<MayaHub, IMayaHubClient> hubContext,
        IWebHostEnvironment env,
        ILogger<AgentSettingsService> logger)
    {
        _hubContext = hubContext;
        _logger = logger;

        var dataDir = Path.Combine(env.ContentRootPath, "App_Data");
        _settingsFilePath = Path.Combine(dataDir, "agent-settings.json");

        _settings = LoadSettingsFromDisk();
        _wakeWordStatus = new WakeWordStatusDto(
            State: "Disabled",
            Engine: "WindowsSpeech",
            Reason: _settings.WakeWordEnabled
                ? "Menunggu koneksi Maya.Agent..."
                : "Dimatikan oleh pengguna (opt-in).",
            UpdatedAt: DateTimeOffset.UtcNow
        );
    }

    public AgentSettingsDto GetSettings()
    {
        lock (_syncLock)
        {
            return _settings;
        }
    }

    public async Task<AgentSettingsDto> UpdateSettingsAsync(AgentSettingsDto settings)
    {
        var normalized = Normalize(settings);

        lock (_syncLock)
        {
            _settings = normalized;
            SaveSettingsToDisk(normalized);

            if (!normalized.WakeWordEnabled)
            {
                _wakeWordStatus = _wakeWordStatus with
                {
                    State = "Disabled",
                    Reason = "Dimatikan oleh pengguna (opt-in).",
                    UpdatedAt = DateTimeOffset.UtcNow
                };
            }
        }

        _logger.LogInformation(
            "AgentSettings disimpan: WakeWord={Wake}, BatterySaver={Saver}, Threshold={Thr}%",
            normalized.WakeWordEnabled, normalized.BatterySaverEnabled, normalized.BatteryThresholdPercent);

        // Push pengaturan terbaru langsung ke Maya.Agent yang sedang online
        await _hubContext.Clients.Group(LaptopGroup).AgentSettingsChanged(normalized);

        // Broadcast status terbaru ke UI agar tetap sinkron
        await _hubContext.Clients.All.WakeWordStatusChanged(GetWakeWordStatus());

        return normalized;
    }

    public WakeWordStatusDto GetWakeWordStatus()
    {
        lock (_syncLock)
        {
            return _wakeWordStatus;
        }
    }

    public void UpdateWakeWordStatus(WakeWordStatusDto status)
    {
        lock (_syncLock)
        {
            // Pertahankan LastHeardPhrase/At sebelumnya jika report terbaru tidak membawa data tersebut
            var phrase = status.LastHeardPhrase ?? _wakeWordStatus.LastHeardPhrase;
            var heardAt = status.LastHeardAt ?? _wakeWordStatus.LastHeardAt;
            _wakeWordStatus = status with
            {
                LastHeardPhrase = phrase,
                LastHeardAt = heardAt
            };
        }
    }

    public void RecordWakeWordHeard(string phrase, DateTimeOffset timestamp)
    {
        lock (_syncLock)
        {
            _wakeWordStatus = _wakeWordStatus with
            {
                LastHeardPhrase = phrase,
                LastHeardAt = timestamp,
                UpdatedAt = timestamp
            };
        }
    }

    public void MarkAgentOffline()
    {
        lock (_syncLock)
        {
            _activeUntil.Remove(LaptopKey);
            _wakeWordStatus = _wakeWordStatus with
            {
                State = "Disabled",
                Reason = "Laptop agent sedang offline.",
                UpdatedAt = DateTimeOffset.UtcNow
            };
        }
    }

    // ─── Find-Me: laptop (kompatibel dengan Phase 6B) ──────────────────────────

    public bool IsFindMeActive => IsFindMeActiveFor(LaptopKey);

    public bool TryAcquireFindMeCooldown(int durationSeconds, out int retryAfterSeconds)
        => TryAcquireFindMeCooldown(LaptopKey, durationSeconds, out retryAfterSeconds);

    public void MarkFindMeStopped() => MarkFindMeStopped(LaptopKey);

    // ─── Find-Me: per perangkat (Phase 7) ──────────────────────────────────────

    public bool IsFindMeActiveFor(string deviceKey)
    {
        lock (_syncLock)
        {
            return _activeUntil.TryGetValue(deviceKey, out var until) && DateTimeOffset.UtcNow < until;
        }
    }

    public bool TryAcquireFindMeCooldown(string deviceKey, int durationSeconds, out int retryAfterSeconds)
    {
        var now = DateTimeOffset.UtcNow;
        lock (_syncLock)
        {
            if (_cooldownUntil.TryGetValue(deviceKey, out var cooldownUntil) && now < cooldownUntil)
            {
                retryAfterSeconds = Math.Max(1, (int)Math.Ceiling((cooldownUntil - now).TotalSeconds));
                return false;
            }

            var cooldownSec = Math.Max(FindMeCooldownSeconds, Math.Min(durationSeconds, 15));
            _cooldownUntil[deviceKey] = now.AddSeconds(cooldownSec);
            _activeUntil[deviceKey] = now.AddSeconds(Math.Clamp(durationSeconds, 1, 30));
            retryAfterSeconds = 0;
            return true;
        }
    }

    public void MarkFindMeStopped(string deviceKey)
    {
        lock (_syncLock)
        {
            _activeUntil.Remove(deviceKey);
        }
    }

    private static AgentSettingsDto Normalize(AgentSettingsDto s)
    {
        return new AgentSettingsDto(
            WakeWordEnabled: s.WakeWordEnabled,
            BatterySaverEnabled: s.BatterySaverEnabled,
            BatteryThresholdPercent: Math.Clamp(s.BatteryThresholdPercent, 5, 50)
        );
    }

    private AgentSettingsDto LoadSettingsFromDisk()
    {
        try
        {
            if (File.Exists(_settingsFilePath))
            {
                var json = File.ReadAllText(_settingsFilePath);
                var parsed = JsonSerializer.Deserialize<AgentSettingsDto>(json, JsonOptions);
                if (parsed is not null)
                {
                    return Normalize(parsed);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Gagal membaca {Path}. Menggunakan pengaturan default.", _settingsFilePath);
        }

        return new AgentSettingsDto(
            WakeWordEnabled: false,
            BatterySaverEnabled: true,
            BatteryThresholdPercent: 20
        );
    }

    private void SaveSettingsToDisk(AgentSettingsDto settings)
    {
        try
        {
            var dir = Path.GetDirectoryName(_settingsFilePath);
            if (!string.IsNullOrWhiteSpace(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }

            var json = JsonSerializer.Serialize(settings, JsonOptions);
            File.WriteAllText(_settingsFilePath, json);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Gagal menyimpan pengaturan agent ke {Path}.", _settingsFilePath);
        }
    }
}
