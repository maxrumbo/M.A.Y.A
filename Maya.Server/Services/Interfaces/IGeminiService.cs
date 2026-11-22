using Maya.Shared.DTOs.Chat;

namespace Maya.Server.Services.Interfaces;

public interface IGeminiService
{
    /// <summary>
    /// Proses pesan Maxwell menggunakan Gemini LLM dengan persona M.A.Y.A.,
    /// sistem memori jangka panjang, dan function calling loop (maks 5 iterasi).
    /// </summary>
    /// <param name="conversationId">ID sesi percakapan aktif (pesan user sudah tersimpan di DB).</param>
    /// <param name="userMessage">Pesan teks terbaru Maxwell (untuk logging).</param>
    /// <param name="deviceId">Device ID untuk mengambil status laptop (nullable).</param>
    /// <returns>
    /// Reply teks akhir M.A.Y.A. dan daftar PendingAction jika ada aksi HIGH_RISK
    /// (misal: request_vault_access) yang menunggu konfirmasi biometrik.
    /// </returns>
    Task<(string Reply, List<PendingActionDto>? PendingActions)> ProcessMessageAsync(
        Guid conversationId,
        string userMessage,
        string? deviceId = null);
}
