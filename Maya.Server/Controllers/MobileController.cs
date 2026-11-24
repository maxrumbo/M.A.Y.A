using Maya.Server.Services.Interfaces;
using Maya.Shared.DTOs.Agent;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Maya.Server.Controllers;

/// <summary>
/// Phase 7: Kontrol perangkat mobile (HP Android) - Mode "Find My Phone".
/// Low-Risk (tanpa Step-Up), diproteksi JWT + cooldown.
/// </summary>
[ApiController]
[Route("api/mobile")]
[Produces("application/json")]
[Authorize]
public class MobileController : ControllerBase
{
    private readonly IMobileDeviceService _mobileDevices;
    private readonly ILogger<MobileController> _logger;

    public MobileController(IMobileDeviceService mobileDevices, ILogger<MobileController> logger)
    {
        _mobileDevices = mobileDevices;
        _logger = logger;
    }

    /// <summary>
    /// Status HP Android yang sedang terhubung (jumlah online dan apakah alarm Find-Me aktif).
    /// </summary>
    [HttpGet("status")]
    [ProducesResponseType<MobileStatusDto>(StatusCodes.Status200OK)]
    public ActionResult<MobileStatusDto> GetStatus() => Ok(_mobileDevices.GetStatus());

    /// <summary>
    /// Membunyikan alarm + getar + suara di HP Android yang sedang membuka aplikasi M.A.Y.A.
    /// 409 jika tidak ada HP online, 429 jika masih cooldown.
    /// Catatan: 200 berarti ping TERKIRIM, server tidak bisa memastikan HP benar-benar berbunyi.
    /// </summary>
    [HttpPost("find-me")]
    [ProducesResponseType<MobileFindMeResponseDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> FindMyPhone([FromBody] FindMeRequestDto? req = null)
    {
        var result = await _mobileDevices.FindMyPhoneAsync(req?.DurationSeconds, req?.Message);

        switch (result.Outcome)
        {
            case FindMyPhoneOutcome.NoDeviceOnline:
                return Conflict(new { error = "HP tidak terhubung.", detail = result.Message });

            case FindMyPhoneOutcome.Cooldown:
                Response.Headers["Retry-After"] = result.RetryAfterSeconds.ToString();
                return StatusCode(StatusCodes.Status429TooManyRequests, new
                {
                    error = "Cooldown Find-Me HP masih aktif.",
                    detail = result.Message,
                    retryAfterSeconds = result.RetryAfterSeconds
                });

            default:
                return Ok(new MobileFindMeResponseDto(result.DeviceCount, result.Message, DateTimeOffset.UtcNow));
        }
    }

    /// <summary>
    /// Menghentikan alarm Find-Me di HP Android.
    /// </summary>
    [HttpPost("find-me/stop")]
    [ProducesResponseType<MobileStatusDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<MobileStatusDto>> StopFindMyPhone()
    {
        await _mobileDevices.StopFindMyPhoneAsync();
        return Ok(_mobileDevices.GetStatus());
    }
}
