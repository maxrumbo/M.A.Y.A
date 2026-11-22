using Maya.Server.Services.Interfaces;
using Maya.Shared.DTOs.Vault;
using Microsoft.AspNetCore.Mvc;

namespace Maya.Server.Controllers;

/// <summary>
/// Encrypted Password Vault API.
///
/// SECURITY NOTES:
/// - GET /api/vault         → hanya metadata (TANPA password)
/// - POST /api/vault        → enkripsi AES-256-GCM sebelum simpan
/// - GET /api/vault/{id}/reveal → plaintext dikembalikan ke client SETELAH
///   verifikasi Step-Up Biometric (Phase 4). Saat ini belum diproteksi auth.
///
/// Password TIDAK PERNAH dikirim ke Gemini LLM.
/// </summary>
[ApiController]
[Route("api/vault")]
[Produces("application/json")]
public class VaultController : ControllerBase
{
    private readonly IVaultService _vaultService;
    private readonly ILogger<VaultController> _logger;

    public VaultController(IVaultService vaultService, ILogger<VaultController> logger)
    {
        _vaultService = vaultService;
        _logger       = logger;
    }

    /// <summary>
    /// Daftar semua entri vault — TANPA password plaintext.
    /// Hanya mengembalikan: id, service_name, username, notes, updated_at.
    /// </summary>
    [HttpGet]
    [ProducesResponseType<List<VaultSummaryDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<List<VaultSummaryDto>>> GetAll()
    {
        var summaries = await _vaultService.ListSummariesAsync();
        return Ok(summaries);
    }

    /// <summary>
    /// Tambah entri baru ke vault.
    /// PlainSecret akan langsung dienkripsi — tidak pernah disimpan sebagai plaintext.
    /// </summary>
    [HttpPost]
    [ProducesResponseType<VaultSummaryDto>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<VaultSummaryDto>> Create([FromBody] VaultCreateRequestDto req)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var result = await _vaultService.CreateEntryAsync(req);
        return CreatedAtAction(nameof(GetAll), new { }, result);
    }

    /// <summary>
    /// Dekripsi dan kembalikan password plaintext.
    ///
    /// ⚠️  PHASE 4 TODO: Endpoint ini WAJIB diproteksi dengan Step-Up Biometric Token.
    /// Saat ini hanya tersedia untuk testing Phase 2.
    /// Password hanya tersedia selama 15 detik (ExpiresAt) sebelum UI menyembunyikannya.
    /// </summary>
    [HttpGet("{id:guid}/reveal")]
    [ProducesResponseType<VaultRevealResponseDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<VaultRevealResponseDto>> Reveal(Guid id)
    {
        try
        {
            var result = await _vaultService.RevealSecretAsync(id);
            return Ok(result);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    /// <summary>
    /// Hapus entri vault berdasarkan ID.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var success = await _vaultService.DeleteEntryAsync(id);
        return success ? NoContent() : NotFound();
    }
}
