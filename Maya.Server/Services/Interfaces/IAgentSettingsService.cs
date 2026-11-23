using Maya.Shared.DTOs.Agent;

namespace Maya.Server.Services.Interfaces;

/// <summary>
/// Phase 6B: Layanan singleton sumber kebenaran untuk pengaturan Wake-Word, status listener live,
/// dan cooldown Mode "Find-Me" pada Maya.Server (persist di file JSON tanpa migrasi DB).
/// </summary>
public interface IAgentSettingsService
{
    AgentSettingsDto GetSettings();
    Task<AgentSettingsDto> UpdateSettingsAsync(AgentSettingsDto settings);

    WakeWordStatusDto GetWakeWordStatus();
    void UpdateWakeWordStatus(WakeWordStatusDto status);
    void RecordWakeWordHeard(string phrase, DateTimeOffset timestamp);
    void MarkAgentOffline();

    bool IsFindMeActive { get; }
    bool TryAcquireFindMeCooldown(int durationSeconds, out int retryAfterSeconds);
    void MarkFindMeStopped();
}
