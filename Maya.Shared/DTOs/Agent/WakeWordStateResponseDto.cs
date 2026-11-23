namespace Maya.Shared.DTOs.Agent;

/// <summary>
/// Respons gabungan pengaturan dan status wake-word untuk endpoint GET /api/agent/wake-word.
/// </summary>
public record WakeWordStateResponseDto(
    AgentSettingsDto Settings,
    WakeWordStatusDto Status,
    bool IsFindMeActive = false
);
