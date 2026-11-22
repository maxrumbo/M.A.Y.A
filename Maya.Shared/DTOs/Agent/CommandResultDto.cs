namespace Maya.Shared.DTOs.Agent;

/// <summary>
/// Hasil eksekusi perintah yang dikirim balik dari Maya.Agent ke Maya.Server.
/// </summary>
public record CommandResultDto(
    Guid CommandId,
    bool IsSuccess,
    string Output,
    DateTimeOffset CompletedAt
);
