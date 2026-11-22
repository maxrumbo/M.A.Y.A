using Maya.Shared.DTOs.Memory;
using Maya.Shared.Enums;

namespace Maya.Server.Services.Interfaces;

public interface IMemoryService
{
    Task<List<MemoryEntryDto>> GetAllMemoriesAsync();

    /// <summary>
    /// Mengambil memori paling relevan untuk diinjeksi ke System Prompt Gemini.
    /// Diurutkan: importance DESC, updated_at DESC.
    /// </summary>
    Task<List<MemoryEntryDto>> GetRelevantMemoriesForPromptAsync(int limit = 30);

    /// <summary>
    /// Insert baru atau update value jika key sudah ada (upsert by key).
    /// </summary>
    Task<MemoryEntryDto> UpsertMemoryAsync(string key, string value, MemoryCategory category, int importance = 5);

    Task<bool> DeleteMemoryAsync(Guid id);

    /// <summary>
    /// Seed memori dasar owner jika tabel masih kosong.
    /// Dipanggil sekali saat startup.
    /// </summary>
    Task SeedInitialMemoriesAsync();
}
