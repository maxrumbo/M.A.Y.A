namespace Maya.Shared.DTOs.Agent;

/// <summary>
/// Phase 7: Respons POST /api/mobile/find-me.
/// Menandakan ping TERKIRIM ke N HP online. Server tidak dapat memastikan HP benar-benar berbunyi.
/// </summary>
public record MobileFindMeResponseDto(
    int DeviceCount,
    string Message,
    DateTimeOffset SentAt
);
