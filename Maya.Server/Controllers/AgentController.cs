using Maya.Server.Data;
using Maya.Server.Services.Interfaces;
using Maya.Shared.DTOs.Agent;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Maya.Server.Controllers;

[ApiController]
[Route("api/agent")]
[Produces("application/json")]
public class AgentController : ControllerBase
{
    private readonly MayaDbContext _db;
    private readonly IAgentDispatcherService _dispatcher;
    private readonly ILogger<AgentController> _logger;

    private const string DefaultLaptopDeviceId = "maxwell-laptop";

    public AgentController(
        MayaDbContext db,
        IAgentDispatcherService dispatcher,
        ILogger<AgentController> logger)
    {
        _db = db;
        _dispatcher = dispatcher;
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
    /// </summary>
    [HttpPost("commands/{id:guid}/confirm")]
    [ProducesResponseType<CommandResultDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
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
}
