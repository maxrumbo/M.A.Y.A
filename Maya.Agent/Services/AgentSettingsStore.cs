using System.Text.Json;
using Maya.Shared.DTOs.Agent;

namespace Maya.Agent.Services;

/// <summary>
/// Menyimpan dan membaca cache lokal pengaturan Maya.Agent di %LOCALAPPDATA%\Maya\agent-settings.json.
/// Sumber kebenaran utama ada di Maya.Server; cache ini memastikan Agent tetap memakai
/// pengaturan terakhir bila server sedang tidak terjangkau saat startup.
/// </summary>
public class AgentSettingsStore
{
    private readonly ILogger<AgentSettingsStore> _logger;
    private readonly string _filePath;
    private readonly object _syncLock = new();
    private AgentSettingsDto _current;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true
    };

    public event Action<AgentSettingsDto>? SettingsUpdated;

    public AgentSettingsStore(ILogger<AgentSettingsStore> logger)
    {
        _logger = logger;
        var baseDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Maya");
        _filePath = Path.Combine(baseDir, "agent-settings.json");
        _current = LoadFromDisk();
    }

    public AgentSettingsDto Current
    {
        get
        {
            lock (_syncLock)
            {
                return _current;
            }
        }
    }

    public void Update(AgentSettingsDto settings)
    {
        var normalized = Normalize(settings);

        lock (_syncLock)
        {
            _current = normalized;
            SaveToDisk(normalized);
        }

        _logger.LogInformation(
            "AgentSettings diperbarui: WakeWordEnabled={Wake}, BatterySaver={Saver}, Threshold={Thr}%",
            normalized.WakeWordEnabled, normalized.BatterySaverEnabled, normalized.BatteryThresholdPercent);

        SettingsUpdated?.Invoke(normalized);
    }

    private static AgentSettingsDto Normalize(AgentSettingsDto s)
    {
        var threshold = Math.Clamp(s.BatteryThresholdPercent, 5, 50);
        return new AgentSettingsDto(
            WakeWordEnabled: s.WakeWordEnabled,
            BatterySaverEnabled: s.BatterySaverEnabled,
            BatteryThresholdPercent: threshold
        );
    }

    private AgentSettingsDto LoadFromDisk()
    {
        try
        {
            if (File.Exists(_filePath))
            {
                var json = File.ReadAllText(_filePath);
                var loaded = JsonSerializer.Deserialize<AgentSettingsDto>(json, JsonOptions);
                if (loaded is not null)
                {
                    return Normalize(loaded);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Gagal membaca cache pengaturan di {Path}. Menggunakan default.", _filePath);
        }

        // Default opt-in: WakeWordEnabled = false
        return new AgentSettingsDto(
            WakeWordEnabled: false,
            BatterySaverEnabled: true,
            BatteryThresholdPercent: 20
        );
    }

    private void SaveToDisk(AgentSettingsDto settings)
    {
        try
        {
            var dir = Path.GetDirectoryName(_filePath);
            if (!string.IsNullOrWhiteSpace(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }

            var json = JsonSerializer.Serialize(settings, JsonOptions);
            File.WriteAllText(_filePath, json);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Gagal menyimpan cache pengaturan lokal ke {Path}.", _filePath);
        }
    }
}
