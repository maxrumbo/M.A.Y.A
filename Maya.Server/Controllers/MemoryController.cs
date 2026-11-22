using Maya.Server.Services.Interfaces;
using Maya.Shared.DTOs.Memory;
using Microsoft.AspNetCore.Mvc;

namespace Maya.Server.Controllers;

[ApiController]
[Route("api/memories")]
[Produces("application/json")]
public class MemoryController : ControllerBase
{
    private readonly IMemoryService _memoryService;

    public MemoryController(IMemoryService memoryService)
    {
        _memoryService = memoryService;
    }

    /// <summary>
    /// Ambil semua memori jangka panjang M.A.Y.A. tentang Maxwell,
    /// diurutkan berdasarkan importance DESC.
    /// </summary>
    [HttpGet]
    [ProducesResponseType<List<MemoryEntryDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<List<MemoryEntryDto>>> GetAll()
    {
        var memories = await _memoryService.GetAllMemoriesAsync();
        return Ok(memories);
    }

    /// <summary>
    /// Buat atau perbarui entri memori (upsert berdasarkan key).
    /// Jika key sudah ada, value dan importance-nya diperbarui.
    /// </summary>
    [HttpPost]
    [ProducesResponseType<MemoryEntryDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<MemoryEntryDto>> Upsert([FromBody] UpsertMemoryRequestDto req)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var result = await _memoryService.UpsertMemoryAsync(
            req.Key, req.Value, req.Category, req.Importance);
        return Ok(result);
    }

    /// <summary>
    /// Hapus satu entri memori berdasarkan ID.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var success = await _memoryService.DeleteMemoryAsync(id);
        return success ? NoContent() : NotFound();
    }
}
