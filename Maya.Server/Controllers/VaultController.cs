using Maya.Server.Filters;
using Maya.Server.Services.Interfaces;
using Maya.Shared.DTOs.Vault;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Maya.Server.Controllers;

/// <summary>
/// Encrypted Password Vault API.
///
/// SECURITY NOTES:
/// - GET /api/vault            → hanya metadata (TANPA password) — perlu JWT
/// - POST /api/vault           → enkripsi AES-256-GCM sebelum simpan — perlu JWT
/// - GET /api/vault/{id}/reveal → WAJIB Step-Up Token (X-Step-Up-Token header, 60 detik)
///   SELAIN Bearer JWT biasa — plaintext dikembalikan 15 detik sebelum UI sembunyikan
///
/// Password TIDAK PERNAH dikirim ke Gemini LLM.
/// </summary>
[ApiController]
[Route("api/vault")]
[Produces("application/json")]
[Authorize]
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
    /// ⚠️  STEP-UP REQUIRED: Endpoint ini WAJIB menyertakan Step-Up Token di header.
    ///
    /// Alur:
    ///   1. POST /api/auth/step-up dengan PIN terbaru → dapat StepUpToken
    ///   2. GET /api/vault/{id}/reveal dengan headers:
    ///        Authorization: Bearer {jwt}
    ///        X-Step-Up-Token: {stepUpToken}
    ///
    /// Password hanya tersedia selama 15 detik (ExpiresAt) sebelum UI menyembunyikannya.
    /// </summary>
    [HttpGet("{id:guid}/reveal")]
    [RequireStepUp]
    [ProducesResponseType<VaultRevealResponseDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
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
