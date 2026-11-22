using Maya.Shared.Enums;

namespace Maya.Shared.DTOs.Memory;

/// <summary>
/// Representasi satu entri memori jangka panjang M.A.Y.A.
/// </summary>
public record MemoryEntryDto(
    Guid Id,
    string Key,
    string Value,
    MemoryCategory Category,
    int Importance,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);
