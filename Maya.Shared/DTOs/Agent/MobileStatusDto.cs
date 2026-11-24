namespace Maya.Shared.DTOs.Agent;

/// <summary>
/// Phase 7: Status perangkat mobile (HP Android) yang sedang terhubung ke MayaHub.
/// </summary>
public record MobileStatusDto(
    int OnlineDevices,
    bool IsFindMeActive
);
