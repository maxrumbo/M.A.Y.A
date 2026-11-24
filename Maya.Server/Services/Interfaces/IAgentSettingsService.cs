using Maya.Shared.DTOs.Agent;

namespace Maya.Server.Services.Interfaces;

/// <summary>
/// Phase 6B/7: Sumber kebenaran pengaturan Wake-Word, status listener live,
/// dan cooldown Mode "Find-Me" per perangkat ("laptop" / "phone").
/// </summary>
public interface IAgentSettingsService
{
    AgentSettingsDto GetSettings();
    Task<AgentSettingsDto> UpdateSettingsAsync(AgentSettingsDto settings);

    WakeWordStatusDto GetWakeWordStatus();
    void UpdateWakeWordStatus(WakeWordStatusDto status);
    void RecordWakeWordHeard(string phrase, DateTimeOffset timestamp);
    void MarkAgentOffline();

    // ─── Find-Me (laptop; kompatibel dengan Phase 6B) ───
    bool IsFindMeActive { get; }
    bool TryAcquireFindMeCooldown(int durationSeconds, out int retryAfterSeconds);
    void MarkFindMeStopped();

    // ─── Find-Me per perangkat (Phase 7) ───
    bool IsFindMeActiveFor(string deviceKey);
    bool TryAcquireFindMeCooldown(string deviceKey, int durationSeconds, out int retryAfterSeconds);
    void MarkFindMeStopped(string deviceKey);
}
