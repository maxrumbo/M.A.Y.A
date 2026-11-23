using Maya.Server.Data;
using Maya.Server.Filters;
using Maya.Server.Services.Interfaces;
using Maya.Shared.DTOs.Agent;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Maya.Server.Controllers;

[ApiController]
[Route("api/agent")]
[Produces("application/json")]
[Authorize]
public class AgentController : ControllerBase
{
    private readonly MayaDbContext _db;
    private readonly IAgentDispatcherService _dispatcher;
    private readonly IAgentSettingsService _agentSettings;
    private readonly ILogger<AgentController> _logger;

    private const string DefaultLaptopDeviceId = "maxwell-laptop";

    public AgentController(
        MayaDbContext db,
        IAgentDispatcherService dispatcher,
        IAgentSettingsService agentSettings,
        ILogger<AgentController> logger)
    {
        _db = db;
        _dispatcher = dispatcher;
        _agentSettings = agentSettings;
        _logger = logger;
    }

    /// <summary>
    /// Mengambil status online/offline dan telemetri hardware laptop terkini.
    /// </summary>
    [HttpGet("status")]
    [ProducesResponseType<DeviceStatusDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DeviceStatusDto>> GetStatus([FromQuery] string deviceId = DefaultLaptopDeviceId)
    {
        var device = await _db.DeviceStatuses
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.DeviceId == deviceId);

        if (device is null)
        {
            return Ok(new DeviceStatusDto(
                DeviceId: deviceId,
                DeviceType: "laptop",
                IsOnline: false,
                CpuUsagePercent: null,
                RamUsagePercent: null,
                BatteryPercent: null,
                LastSeenAt: DateTimeOffset.UtcNow
            ));
        }

        return Ok(new DeviceStatusDto(
            DeviceId: device.DeviceId,
            DeviceType: device.DeviceType,
            IsOnline: device.IsOnline,
            CpuUsagePercent: device.CpuUsagePercent,
            RamUsagePercent: device.RamUsagePercent,
            BatteryPercent: device.BatteryPercent,
            LastSeenAt: device.LastSeenAt
        ));
    }

    /// <summary>
    /// Mengonfirmasi dan mengeksekusi perintah HIGH_RISK yang tertunda (status PendingConfirmation).
    ///
    /// ⚠️  STEP-UP REQUIRED: Endpoint ini WAJIB menyertakan Step-Up Token di header.
    ///
    /// H1 Hardening: Step-Up Token harus terikat ke CommandId ini (TargetId = id).
    ///
    /// Alur:
    ///   1. Chat → M.A.Y.A. return PendingActions dengan RequiresBiometricConfirmation: true
    ///   2. POST /api/auth/step-up dengan PIN terbaru + TargetId = {id command} → dapat StepUpToken
    ///   3. POST /api/agent/commands/{id}/confirm dengan headers:
    ///        Authorization: Bearer {jwt}
    ///        X-Step-Up-Token: {stepUpToken}
    /// </summary>
    [HttpPost("commands/{id:guid}/confirm")]
    [RequireStepUp]
    [ProducesResponseType<CommandResultDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CommandResultDto>> ConfirmCommand(Guid id)
    {
        try
        {
            _logger.LogInformation("Menerima konfirmasi untuk Command ID: {CommandId}", id);
            var result = await _dispatcher.ConfirmAndDispatchAsync(id);
            return Ok(result);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = $"Command '{id}' tidak ditemukan." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gagal mengonfirmasi command {Id}", id);
            return StatusCode(500, new { error = "Terjadi kesalahan internal saat mengeksekusi perintah." });
        }
    }

    /// <summary>
    /// H2 Hardening: Batalkan command HIGH_RISK yang masih menunggu konfirmasi (PendingConfirmation).
    ///
    /// Tidak memerlukan Step-Up Token — cancel harus mudah dilakukan.
    /// Hanya memerlukan JWT Bearer biasa.
    ///
    /// Return:
    ///   204 No Content  → berhasil dibatalkan
    ///   400 Bad Request → command tidak dalam status PendingConfirmation
    ///   404 Not Found   → command tidak ditemukan
    /// </summary>
    [HttpPost("commands/{id:guid}/cancel")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CancelCommand(Guid id)
    {
        try
        {
            _logger.LogInformation("Menerima permintaan cancel untuk Command ID: {CommandId}", id);
            await _dispatcher.CancelCommandAsync(id);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = $"Command '{id}' tidak ditemukan." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gagal membatalkan command {Id}", id);
            return StatusCode(500, new { error = "Terjadi kesalahan internal saat membatalkan perintah." });
        }
    }

    // ─── Phase 6B: Mode "Find-Me" & Wake-Word Control ────────────────────────

    /// <summary>
    /// Phase 6B: Membunyikan alarm ping + suara lantang ("Aku di sini, Max!") di laptop Maxwell.
    /// Low-Risk (tanpa Step-Up), diproteksi cooldown agar tidak bisa di-spam.
    /// Mengembalikan 409 jika laptop offline, 429 jika masih dalam masa cooldown.
    /// </summary>
    [HttpPost("find-me")]
    [ProducesResponseType<CommandResultDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<CommandResultDto>> FindMe([FromBody] FindMeRequestDto? req = null)
    {
        if (!await _dispatcher.IsAgentOnlineAsync(DefaultLaptopDeviceId))
        {
            return Conflict(new
            {
                error = "Laptop Maxwell sedang offline.",
                detail = "Pastikan daemon Maya.Agent sudah berjalan dan terhubung ke server."
            });
        }

        var duration = Math.Clamp(req?.DurationSeconds ?? 10, 1, 30);
        if (!_agentSettings.TryAcquireFindMeCooldown(duration, out var retryAfter))
        {
            Response.Headers["Retry-After"] = retryAfter.ToString();
            return StatusCode(StatusCodes.Status429TooManyRequests, new
            {
                error = "Cooldown Find-Me masih aktif.",
                detail = $"Tunggu {retryAfter} detik sebelum membunyikan laptop kembali.",
                retryAfterSeconds = retryAfter
            });
        }

        var (_, _, result) = await _dispatcher.DispatchCommandAsync(
            commandName: "find_my_device",
            payload: new { durationSeconds = duration, message = req?.Message },
            conversationId: null,
            requiresConfirmation: false,
            description: $"Find-Me ping laptop ({duration} detik)");

        if (result is null || !result.IsSuccess)
        {
            _agentSettings.MarkFindMeStopped();
            return StatusCode(StatusCodes.Status502BadGateway, new
            {
                error = "Gagal membunyikan laptop.",
                detail = result?.Output ?? "Tidak ada respons dari Maya.Agent."
            });
        }

        return Ok(result);
    }

    /// <summary>
    /// Phase 6B: Menghentikan alarm Find-Me yang sedang berbunyi di laptop Maxwell.
    /// </summary>
    [HttpPost("find-me/stop")]
    [ProducesResponseType<CommandResultDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CommandResultDto>> StopFindMe()
    {
        _agentSettings.MarkFindMeStopped();

        if (!await _dispatcher.IsAgentOnlineAsync(DefaultLaptopDeviceId))
        {
            return Conflict(new
            {
                error = "Laptop Maxwell sedang offline.",
                detail = "Tidak dapat mengirim perintah Stop ke laptop yang offline."
            });
        }

        var (_, _, result) = await _dispatcher.DispatchCommandAsync(
            commandName: "stop_find_me",
            payload: new { },
            conversationId: null,
            requiresConfirmation: false,
            description: "Hentikan alarm Find-Me di laptop");

        return Ok(result ?? new CommandResultDto(Guid.Empty, true, "Perintah stop dikirim.", DateTimeOffset.UtcNow));
    }

    /// <summary>
    /// Phase 6B: Mengambil pengaturan dan status live Wake-Word Listener di laptop.
    /// </summary>
    [HttpGet("wake-word")]
    [ProducesResponseType<WakeWordStateResponseDto>(StatusCodes.Status200OK)]
    public ActionResult<WakeWordStateResponseDto> GetWakeWordState()
    {
        return Ok(new WakeWordStateResponseDto(
            Settings: _agentSettings.GetSettings(),
            Status: _agentSettings.GetWakeWordStatus(),
            IsFindMeActive: _agentSettings.IsFindMeActive
        ));
    }

    /// <summary>
    /// Phase 6B: Memperbarui pengaturan Wake-Word Listener & Mode Hemat Baterai,
    /// menyimpannya ke file JSON server, dan langsung mendorongnya ke Maya.Agent via SignalR.
    /// </summary>
    [HttpPut("wake-word")]
    [ProducesResponseType<WakeWordStateResponseDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<WakeWordStateResponseDto>> UpdateWakeWordSettings([FromBody] AgentSettingsDto req)
    {
        var updated = await _agentSettings.UpdateSettingsAsync(req);

        return Ok(new WakeWordStateResponseDto(
            Settings: updated,
            Status: _agentSettings.GetWakeWordStatus(),
            IsFindMeActive: _agentSettings.IsFindMeActive
        ));
    }
}
