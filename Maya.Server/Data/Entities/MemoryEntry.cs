namespace Maya.Server.Data.Entities;

/// <summary>
/// Satu fakta atau preferensi yang diingat M.A.Y.A. secara jangka panjang.
/// Key bersifat unik — upsert berdasarkan key.
/// Importance 1–10; nilai 10 selalu diinjeksi ke system prompt Gemini.
/// Mapped ke tabel PostgreSQL: memory_entries
/// </summary>
public class MemoryEntry
{
    public Guid Id { get; set; }

    /// <summary>
    /// Kunci unik fakta, misal: "campus_name", "coding_ide", "owner_full_name"
    /// </summary>
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;

    /// <summary>
    /// Kategori: "Identity", "Preference", "Routine", "Project", "Personal"
    /// </summary>
    public string Category { get; set; } = string.Empty;

    /// <summary>
    /// Skala kepentingan 1–10. Default 5. Nilai 10 = selalu diinjeksi ke prompt.
    /// </summary>
    public int Importance { get; set; } = 5;

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
