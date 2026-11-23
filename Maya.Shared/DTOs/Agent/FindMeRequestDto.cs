namespace Maya.Shared.DTOs.Agent;

/// <summary>
/// Permintaan untuk membunyikan alarm dan suara "Find-Me" di perangkat laptop.
/// Durasi default 10 detik, maksimal 30 detik.
/// </summary>
public record FindMeRequestDto(
    int? DurationSeconds = 10,
    string? Message = null
);
