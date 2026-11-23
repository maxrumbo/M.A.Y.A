namespace Maya.Shared.DTOs.Agent;

/// <summary>
/// Pengaturan wake-word listener dan mode hemat baterai pada Maya.Agent.
/// Default WakeWordEnabled = false (opt-in demi privasi).
/// </summary>
public record AgentSettingsDto(
    bool WakeWordEnabled = false,
    bool BatterySaverEnabled = true,
    int BatteryThresholdPercent = 20
);
