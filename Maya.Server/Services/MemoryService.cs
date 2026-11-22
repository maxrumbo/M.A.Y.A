using Maya.Server.Data;
using Maya.Server.Data.Entities;
using Maya.Server.Services.Interfaces;
using Maya.Shared.DTOs.Memory;
using Maya.Shared.Enums;
using Microsoft.EntityFrameworkCore;

namespace Maya.Server.Services;

public class MemoryService : IMemoryService
{
    private readonly MayaDbContext _db;
    private readonly ILogger<MemoryService> _logger;

    public MemoryService(MayaDbContext db, ILogger<MemoryService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<List<MemoryEntryDto>> GetAllMemoriesAsync()
    {
        return await _db.MemoryEntries
            .OrderByDescending(m => m.Importance)
            .ThenByDescending(m => m.UpdatedAt)
            .Select(m => ToDto(m))
            .ToListAsync();
    }

    public async Task<List<MemoryEntryDto>> GetRelevantMemoriesForPromptAsync(int limit = 30)
    {
        return await _db.MemoryEntries
            .OrderByDescending(m => m.Importance)
            .ThenByDescending(m => m.UpdatedAt)
            .Take(limit)
            .Select(m => ToDto(m))
            .ToListAsync();
    }

    public async Task<MemoryEntryDto> UpsertMemoryAsync(
        string key, string value, MemoryCategory category, int importance = 5)
    {
        var existing = await _db.MemoryEntries
            .FirstOrDefaultAsync(m => m.Key == key);

        if (existing is not null)
        {
            existing.Value      = value;
            existing.Category   = category.ToString();
            existing.Importance = Math.Clamp(importance, 1, 10);
            existing.UpdatedAt  = DateTimeOffset.UtcNow;
            _logger.LogInformation("Memory updated: key={Key}", key);
        }
        else
        {
            existing = new MemoryEntry
            {
                Id         = Guid.NewGuid(),
                Key        = key,
                Value      = value,
                Category   = category.ToString(),
                Importance = Math.Clamp(importance, 1, 10),
                CreatedAt  = DateTimeOffset.UtcNow,
                UpdatedAt  = DateTimeOffset.UtcNow
            };
            _db.MemoryEntries.Add(existing);
            _logger.LogInformation("Memory created: key={Key}", key);
        }

        await _db.SaveChangesAsync();
        return ToDto(existing);
    }

    public async Task<bool> DeleteMemoryAsync(Guid id)
    {
        var entry = await _db.MemoryEntries.FindAsync(id);
        if (entry is null) return false;

        _db.MemoryEntries.Remove(entry);
        await _db.SaveChangesAsync();
        _logger.LogInformation("Memory deleted: id={Id}", id);
        return true;
    }

    public async Task SeedInitialMemoriesAsync()
    {
        if (await _db.MemoryEntries.AnyAsync())
        {
            _logger.LogDebug("Memory seed skipped — tabel sudah berisi data.");
            return;
        }

        _logger.LogInformation("Seeding initial memories untuk Maxwell Avinda Rumahorbo...");

        var now = DateTimeOffset.UtcNow;
        var seeds = new[]
        {
            new MemoryEntry
            {
                Id         = Guid.NewGuid(),
                Key        = "owner_full_name",
                Value      = "Maxwell Avinda Rumahorbo",
                Category   = MemoryCategory.Identity.ToString(),
                Importance = 10,
                CreatedAt  = now,
                UpdatedAt  = now
            },
            new MemoryEntry
            {
                Id         = Guid.NewGuid(),
                Key        = "owner_nicknames",
                Value      = "Max, Well, Maxwell, bro, ganteng",
                Category   = MemoryCategory.Identity.ToString(),
                Importance = 10,
                CreatedAt  = now,
                UpdatedAt  = now
            }
        };

        _db.MemoryEntries.AddRange(seeds);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Memory seed selesai: {Count} entri.", seeds.Length);
    }

    // ─── Mapping ──────────────────────────────────────────────────────────────

    private static MemoryEntryDto ToDto(MemoryEntry m) => new(
        m.Id,
        m.Key,
        m.Value,
        Enum.TryParse<MemoryCategory>(m.Category, out var cat) ? cat : MemoryCategory.Personal,
        m.Importance,
        m.CreatedAt,
        m.UpdatedAt
    );
}
