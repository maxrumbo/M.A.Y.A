namespace Maya.Shared.DTOs.Agent;

/// <summary>
/// Status live listener wake-word yang dilaporkan Maya.Agent ke server dan UI.
/// State: "Active" | "PausedBattery" | "Disabled" | "Unsupported"
/// </summary>
public record WakeWordStatusDto(
    string State,
    string Engine,
    string? Reason,
    DateTimeOffset UpdatedAt,
    string? LastHeardPhrase = null,
    DateTimeOffset? LastHeardAt = null
);
