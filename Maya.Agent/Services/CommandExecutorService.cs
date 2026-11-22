using Maya.Agent.Commands;
using Maya.Shared.DTOs.Agent;

namespace Maya.Agent.Services;

/// <summary>
/// Mengelola dan mengeksekusi semua command lokal yang terdaftar.
/// </summary>
public class CommandExecutorService
{
    private readonly Dictionary<string, ILocalCommand> _commands;
    private readonly ILogger<CommandExecutorService> _logger;

    public CommandExecutorService(
        IEnumerable<ILocalCommand> commands,
        ILogger<CommandExecutorService> logger)
    {
        _commands = commands.ToDictionary(c => c.CommandName, StringComparer.OrdinalIgnoreCase);
        _logger = logger;
    }

    public async Task<CommandResultDto> ExecuteAsync(AgentCommandDto command)
    {
        _logger.LogInformation("Menerima perintah: {CommandName} (ID: {CommandId})",
            command.CommandName, command.CommandId);

        if (!_commands.TryGetValue(command.CommandName, out var handler))
        {
            _logger.LogWarning("Command '{CommandName}' tidak didukung oleh agent ini.", command.CommandName);
            return new CommandResultDto(
                command.CommandId,
                false,
                $"Perintah '{command.CommandName}' tidak dikenali oleh daemon laptop.",
                DateTimeOffset.UtcNow);
        }

        try
        {
            return await handler.ExecuteAsync(command.CommandId, command.PayloadJson);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception saat mengeksekusi command {CommandName}", command.CommandName);
            return new CommandResultDto(
                command.CommandId,
                false,
                $"Error eksekusi: {ex.Message}",
                DateTimeOffset.UtcNow);
        }
    }
}
