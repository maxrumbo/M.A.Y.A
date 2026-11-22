using System.Diagnostics;
using System.Text.Json;
using Maya.Shared.DTOs.Agent;

namespace Maya.Agent.Commands;

/// <summary>
/// Kontrol daya dan layar Windows.
/// Mendukung mode DryRun (Maya:DryRunPower = true) untuk keamanan testing.
/// </summary>
public class PowerControlCommand : ILocalCommand
{
    private readonly IConfiguration _config;
    private readonly ILogger<PowerControlCommand> _logger;

    public string CommandName => "power_control";

    public PowerControlCommand(IConfiguration config, ILogger<PowerControlCommand> logger)
    {
        _config = config;
        _logger = logger;
    }

    public Task<CommandResultDto> ExecuteAsync(Guid commandId, string payloadJson)
    {
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            var root = doc.RootElement;
            var action = root.TryGetProperty("action", out var aEl) ? aEl.GetString()?.Trim().ToLowerInvariant() : "lock_screen";

            var dryRun = _config.GetValue<bool>("Maya:DryRunPower", false);

            _logger.LogInformation("PowerControlCommand diminta: {Action} (DryRun: {DryRun})", action, dryRun);

            if (dryRun && action != "lock_screen")
            {
                _logger.LogWarning("DryRun aktif: perintah daya {Action} disimulasikan tanpa mematikan perangkat.", action);
                return Task.FromResult(new CommandResultDto(
                    commandId,
                    true,
                    $"[DryRun Mode] Perintah daya '{action}' berhasil diverifikasi dan disimulasikan tanpa mengeksekusi ke sistem operasi.",
                    DateTimeOffset.UtcNow));
            }

            switch (action)
            {
                case "lock_screen":
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = "rundll32.exe",
                        Arguments = "user32.dll,LockWorkStation",
                        UseShellExecute = true
                    });
                    return Task.FromResult(new CommandResultDto(commandId, true, "Layar laptop berhasil dikunci.", DateTimeOffset.UtcNow));

                case "sleep":
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = "rundll32.exe",
                        Arguments = "powrprof.dll,SetSuspendState 0,1,0",
                        UseShellExecute = true
                    });
                    return Task.FromResult(new CommandResultDto(commandId, true, "Laptop dialihkan ke mode Sleep.", DateTimeOffset.UtcNow));

                case "restart":
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = "shutdown.exe",
                        Arguments = "/r /t 5 /c \"Restart diminta oleh M.A.Y.A.\"",
                        UseShellExecute = false,
                        CreateNoWindow = true
                    });
                    return Task.FromResult(new CommandResultDto(commandId, true, "Laptop akan restart dalam 5 detik.", DateTimeOffset.UtcNow));

                case "shutdown":
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = "shutdown.exe",
                        Arguments = "/s /t 5 /c \"Shutdown diminta oleh M.A.Y.A.\"",
                        UseShellExecute = false,
                        CreateNoWindow = true
                    });
                    return Task.FromResult(new CommandResultDto(commandId, true, "Laptop akan shutdown dalam 5 detik.", DateTimeOffset.UtcNow));

                default:
                    return Task.FromResult(new CommandResultDto(
                        commandId, false, $"Aksi daya '{action}' tidak dikenal.", DateTimeOffset.UtcNow));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gagal menjalankan power command.");
            return Task.FromResult(new CommandResultDto(commandId, false, $"Error power control: {ex.Message}", DateTimeOffset.UtcNow));
        }
    }
}
