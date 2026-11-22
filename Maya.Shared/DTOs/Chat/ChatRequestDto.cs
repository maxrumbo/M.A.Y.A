using System.ComponentModel.DataAnnotations;

namespace Maya.Shared.DTOs.Chat;

/// <summary>
/// Request payload untuk mengirim pesan ke M.A.Y.A.
/// ConversationId null berarti membuat sesi percakapan baru.
/// </summary>
public record ChatRequestDto(
    Guid? ConversationId,

    [Required(ErrorMessage = "Pesan tidak boleh kosong.")]
    [MaxLength(10000, ErrorMessage = "Pesan terlalu panjang (maks 10.000 karakter).")]
    string Message,

    string? DeviceId
);
