using System.Text.Json;
using Maya.Agent.Services;
using Maya.Shared.DTOs.Agent;

namespace Maya.Agent.Commands;

/// <summary>
/// Mengambil statistik sistem (CPU, RAM, Baterai) terkini dari SystemMonitorService.
/// </summary>
public class GetSystemStatsCommand : ILocalCommand
{
    private readonly SystemMonitorService _monitorService;

    public string CommandName => "get_system_stats";

    public GetSystemStatsCommand(SystemMonitorService monitorService)
    {
        _monitorService = monitorService;
    }

    public Task<CommandResultDto> ExecuteAsync(Guid commandId, string payloadJson)
    {
        var stats = _monitorService.GetLatestStats();
        var output = $"CPU: {stats.CpuUsagePercent:F1}%, RAM: {stats.RamUsagePercent:F1}%, Baterai: {stats.BatteryPercent}% (Timestamp: {stats.Timestamp:HH:mm:ss} UTC)";

        return Task.FromResult(new CommandResultDto(
            commandId,
            true,
            output,
            DateTimeOffset.UtcNow
        ));
    }
}
