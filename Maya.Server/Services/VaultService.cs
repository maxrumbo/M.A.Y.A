using System.Security.Cryptography;
using System.Text;
using Maya.Server.Data;
using Maya.Server.Data.Entities;
using Maya.Server.Services.Interfaces;
using Maya.Shared.DTOs.Vault;
using Microsoft.EntityFrameworkCore;

namespace Maya.Server.Services;

/// <summary>
/// Layanan enkripsi Password Vault menggunakan AES-256-GCM.
/// Master Key (32 bytes) WAJIB dikonfigurasi via dotnet user-secrets (Maya:VaultMasterKey).
/// Plaintext secret TIDAK PERNAH disimpan di database maupun dikirim ke Gemini LLM.
/// </summary>
public class VaultService : IVaultService
{
    private readonly MayaDbContext _db;
    private readonly byte[] _masterKey;
    private readonly ILogger<VaultService> _logger;

    private const int NonceSizeBytes = 12; // AES-GCM: 96-bit nonce
    private const int TagSizeBytes   = 16; // AES-GCM: 128-bit authentication tag
    private const int RevealTtlSeconds = 15; // Auto-hide setelah 15 detik di UI

    public VaultService(MayaDbContext db, IConfiguration config, ILogger<VaultService> logger)
    {
        _db     = db;
        _logger = logger;

        var base64Key = config["Maya:VaultMasterKey"];
        if (string.IsNullOrWhiteSpace(base64Key))
            throw new InvalidOperationException(
                "Maya:VaultMasterKey belum dikonfigurasi. " +
                "Jalankan: dotnet user-secrets set \"Maya:VaultMasterKey\" \"<32-byte-base64>\"");

        _masterKey = Convert.FromBase64String(base64Key);

        if (_masterKey.Length != 32)
            throw new InvalidOperationException(
                $"Maya:VaultMasterKey harus tepat 32 bytes (AES-256). " +
                $"Ditemukan: {_masterKey.Length} bytes.");
    }

    public async Task<VaultSummaryDto> CreateEntryAsync(VaultCreateRequestDto req)
    {
        var (ciphertext, nonce, tag) = Encrypt(req.PlainSecret);

        var entry = new VaultEntry
        {
            Id              = Guid.NewGuid(),
            ServiceName     = req.ServiceName,
            Username        = req.Username,
            EncryptedSecret = Convert.ToBase64String(ciphertext),
            IvNonce         = Convert.ToBase64String(nonce),
            AuthTag         = Convert.ToBase64String(tag),
            Notes           = req.Notes,
            UpdatedAt       = DateTimeOffset.UtcNow
        };

        _db.VaultEntries.Add(entry);
        await _db.SaveChangesAsync();

        // NEVER LOG the plaintext — log hanya metadata aman
        _logger.LogInformation("Vault entry created: service={ServiceName}", req.ServiceName);
        return ToSummary(entry);
    }

    public async Task<List<VaultSummaryDto>> ListSummariesAsync()
    {
        return await _db.VaultEntries
            .OrderBy(v => v.ServiceName)
            .Select(v => new VaultSummaryDto(v.Id, v.ServiceName, v.Username, v.Notes, v.UpdatedAt))
            .ToListAsync();
    }

    public async Task<VaultRevealResponseDto> RevealSecretAsync(Guid id)
    {
        var entry = await _db.VaultEntries.FindAsync(id)
            ?? throw new KeyNotFoundException($"Vault entry '{id}' tidak ditemukan.");

        var plainSecret = Decrypt(
            Convert.FromBase64String(entry.EncryptedSecret),
            Convert.FromBase64String(entry.IvNonce),
            Convert.FromBase64String(entry.AuthTag)
        );

        // NEVER LOG the plainSecret
        _logger.LogInformation("Vault entry revealed: service={ServiceName}", entry.ServiceName);

        return new VaultRevealResponseDto(
            entry.Id,
            entry.ServiceName,
            entry.Username,
            plainSecret,
            ExpiresAt: DateTimeOffset.UtcNow.AddSeconds(RevealTtlSeconds)
        );
    }

    public async Task<bool> DeleteEntryAsync(Guid id)
    {
        var entry = await _db.VaultEntries.FindAsync(id);
        if (entry is null) return false;

        _db.VaultEntries.Remove(entry);
        await _db.SaveChangesAsync();
        _logger.LogInformation("Vault entry deleted: id={Id}", id);
        return true;
    }

    // ─── AES-256-GCM Crypto Helpers ───────────────────────────────────────────

    private (byte[] ciphertext, byte[] nonce, byte[] tag) Encrypt(string plaintext)
    {
        var plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
        var ciphertext     = new byte[plaintextBytes.Length];
        var nonce          = new byte[NonceSizeBytes];
        var tag            = new byte[TagSizeBytes];

        // Nonce unik per entri — WAJIB random
        RandomNumberGenerator.Fill(nonce);

        using var aes = new AesGcm(_masterKey, TagSizeBytes);
        aes.Encrypt(nonce, plaintextBytes, ciphertext, tag);

        return (ciphertext, nonce, tag);
    }

    private string Decrypt(byte[] ciphertext, byte[] nonce, byte[] tag)
    {
        var plaintext = new byte[ciphertext.Length];

        using var aes = new AesGcm(_masterKey, TagSizeBytes);
        aes.Decrypt(nonce, ciphertext, tag, plaintext); // Throws jika auth tag tidak cocok

        return Encoding.UTF8.GetString(plaintext);
    }

    private static VaultSummaryDto ToSummary(VaultEntry v) =>
        new(v.Id, v.ServiceName, v.Username, v.Notes, v.UpdatedAt);
}
