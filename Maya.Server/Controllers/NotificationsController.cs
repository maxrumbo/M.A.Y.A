using Maya.Server.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Maya.Server.Controllers;

[ApiController]
[Route("api/notifications")]
[Produces("application/json")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly INotificationMuteService _muteService;

    public NotificationsController(INotificationMuteService muteService)
    {
        _muteService = muteService;
    }

    /// <summary>
    /// Mendapatkan status mute saat ini.
    /// </summary>
    [HttpGet("mute-status")]
    public IActionResult GetMuteStatus()
    {
        return Ok(new
        {
            isMuted = _muteService.IsMuted,
            mutedUntil = _muteService.MutedUntil,
            remainingMinutes = _muteService.RemainingMinutes
        });
    }

    /// <summary>
    /// Mute notifikasi proaktif selama sejumlah menit tertentu (misal 30, 120, atau 1440).
    /// </summary>
    [HttpPost("mute")]
    public IActionResult Mute([FromBody] MuteRequestDto req)
    {
        if (req.DurationMinutes <= 0)
            return BadRequest(new { error = "Durasi mute harus lebih besar dari 0 menit." });

        _muteService.Mute(TimeSpan.FromMinutes(req.DurationMinutes));
        return Ok(new
        {
            isMuted = true,
            mutedUntil = _muteService.MutedUntil,
            remainingMinutes = _muteService.RemainingMinutes,
            message = $"Notifikasi di-mute selama {req.DurationMinutes} menit."
        });
    }

    /// <summary>
    /// Membatalkan mute notifikasi proaktif.
    /// </summary>
    [HttpPost("unmute")]
    public IActionResult Unmute()
    {
        _muteService.Unmute();
        return Ok(new
        {
            isMuted = false,
            message = "Notifikasi proaktif kembali aktif."
        });
    }
}

public record MuteRequestDto(int DurationMinutes);
