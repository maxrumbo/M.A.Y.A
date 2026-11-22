using Maya.Shared.DTOs.Vault;

namespace Maya.Server.Services.Interfaces;

public interface IVaultService
{
    /// <summary>
    /// Enkripsi secret dengan AES-256-GCM dan simpan ke database.
    /// Plaintext TIDAK PERNAH disimpan.
    /// </summary>
    Task<VaultSummaryDto> CreateEntryAsync(VaultCreateRequestDto req);

    /// <summary>
    /// Daftar entri vault TANPA password plaintext — hanya metadata aman.
    /// </summary>
    Task<List<VaultSummaryDto>> ListSummariesAsync();

    /// <summary>
    /// Dekripsi dan kembalikan plaintext secret.
    /// WAJIB diproteksi Step-Up Biometric Token (Phase 4).
    /// Secret ini TIDAK PERNAH dikirim ke Gemini LLM.
    /// </summary>
    Task<VaultRevealResponseDto> RevealSecretAsync(Guid id);

    Task<bool> DeleteEntryAsync(Guid id);
}
