using Maya.Server.Data;
using Maya.Server.Data.Entities;
using Maya.Server.Services.Interfaces;
using Maya.Shared.DTOs.Chat;
using Microsoft.AspNetCore.Mvc;

namespace Maya.Server.Controllers;

[ApiController]
[Route("api/chat")]
[Produces("application/json")]
public class ChatController : ControllerBase
{
    private readonly MayaDbContext _db;
    private readonly IGeminiService _geminiService;
    private readonly ILogger<ChatController> _logger;

    public ChatController(
        MayaDbContext db,
        IGeminiService geminiService,
        ILogger<ChatController> logger)
    {
        _db            = db;
        _geminiService = geminiService;
        _logger        = logger;
    }

    /// <summary>
    /// Kirim pesan ke M.A.Y.A. dan terima balasan.
    ///
    /// Flow:
    /// 1. Jika ConversationId null → buat sesi percakapan baru
    /// 2. Simpan pesan user ke chat_messages (role = "user")
    /// 3. Proses dengan GeminiService (function calling loop, inject memories, dll)
    /// 4. Simpan balasan M.A.Y.A. ke chat_messages (role = "model")
    /// 5. Kembalikan ChatResponseDto (termasuk PendingActions jika ada aksi HIGH_RISK)
    /// </summary>
    [HttpPost]
    [ProducesResponseType<ChatResponseDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ChatResponseDto>> PostMessage([FromBody] ChatRequestDto req)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        // ── 1. Resolve Conversation ───────────────────────────────────────────
        Conversation conversation;

        if (req.ConversationId.HasValue)
        {
            conversation = await _db.Conversations.FindAsync(req.ConversationId.Value)
                ?? throw new KeyNotFoundException($"Conversation '{req.ConversationId}' tidak ditemukan.");
        }
        else
        {
            // Buat sesi baru — judul dari 50 karakter pertama pesan
            var title = req.Message.Length > 50
                ? req.Message[..50].TrimEnd() + "…"
                : req.Message;

            conversation = new Conversation
            {
                Id        = Guid.NewGuid(),
                Title     = title,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _db.Conversations.Add(conversation);
            await _db.SaveChangesAsync();

            _logger.LogInformation("New conversation created: {Id}", conversation.Id);
        }

        // ── 2. Simpan pesan user ──────────────────────────────────────────────
        _db.ChatMessages.Add(new ChatMessage
        {
            Id             = Guid.NewGuid(),
            ConversationId = conversation.Id,
            Role           = "user",
            Content        = req.Message,
            CreatedAt      = DateTimeOffset.UtcNow
        });
        await _db.SaveChangesAsync();

        // ── 3. Proses dengan Gemini (pesan sudah ada di DB saat ini) ──────────
        var (reply, pendingActions) = await _geminiService.ProcessMessageAsync(
            conversationId: conversation.Id,
            userMessage:    req.Message,
            deviceId:       req.DeviceId);

        // ── 4. Simpan balasan M.A.Y.A. ────────────────────────────────────────
        _db.ChatMessages.Add(new ChatMessage
        {
            Id             = Guid.NewGuid(),
            ConversationId = conversation.Id,
            Role           = "model",
            Content        = reply,
            CreatedAt      = DateTimeOffset.UtcNow
        });

        // Update timestamp conversation ke pesan terbaru
        conversation.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Chat processed: conversationId={Id}, pendingActions={Count}",
            conversation.Id,
            pendingActions?.Count ?? 0);

        // ── 5. Return response ────────────────────────────────────────────────
        return Ok(new ChatResponseDto(
            ConversationId: conversation.Id,
            Reply:          reply,
            PendingActions: pendingActions,
            Timestamp:      DateTimeOffset.UtcNow
        ));
    }
}
