using Maya.Server.Data;
using Maya.Shared.DTOs.Chat;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Maya.Server.Controllers;

[ApiController]
[Route("api/conversations")]
[Produces("application/json")]
public class ConversationsController : ControllerBase
{
    private readonly MayaDbContext _db;

    public ConversationsController(MayaDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Daftar semua sesi percakapan, diurutkan dari yang terbaru.
    /// </summary>
    [HttpGet]
    [ProducesResponseType<List<ConversationSummaryDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<List<ConversationSummaryDto>>> GetAll()
    {
        var conversations = await _db.Conversations
            .Where(c => !c.IsArchived)
            .OrderByDescending(c => c.UpdatedAt)
            .Select(c => new ConversationSummaryDto(
                c.Id,
                c.Title,
                c.IsArchived,
                c.UpdatedAt,
                c.CreatedAt))
            .ToListAsync();

        return Ok(conversations);
    }

    /// <summary>
    /// Riwayat pesan lengkap untuk satu sesi percakapan, diurutkan kronologis.
    /// </summary>
    [HttpGet("{id:guid}/messages")]
    [ProducesResponseType<List<ChatMessageDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<List<ChatMessageDto>>> GetMessages(Guid id)
    {
        var exists = await _db.Conversations.AnyAsync(c => c.Id == id);
        if (!exists) return NotFound();

        var messages = await _db.ChatMessages
            .Where(m => m.ConversationId == id)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new ChatMessageDto(
                m.Id,
                m.ConversationId,
                m.Role,
                m.Content,
                m.ToolCallJson,
                m.CreatedAt))
            .ToListAsync();

        return Ok(messages);
    }

    /// <summary>
    /// Hapus sesi percakapan beserta seluruh pesannya (cascade delete).
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var conversation = await _db.Conversations.FindAsync(id);
        if (conversation is null) return NotFound();

        _db.Conversations.Remove(conversation);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
