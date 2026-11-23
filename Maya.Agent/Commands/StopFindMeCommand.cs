using Maya.Agent.Audio;
using Maya.Shared.DTOs.Agent;

namespace Maya.Agent.Commands;

/// <summary>
/// Phase 6B: Perintah lokal Low-Risk "stop_find_me" untuk menghentikan alarm Find-Me
/// yang sedang berbunyi di laptop dan segera mengembalikan volume ke kondisi awal.
/// </summary>
public class StopFindMeCommand : ILocalCommand
{
    private readonly AudioAlertService _audioAlert;
    private readonly ILogger<StopFindMeCommand> _logger;

    public string CommandName => "stop_find_me";

    public StopFindMeCommand(AudioAlertService audioAlert, ILogger<StopFindMeCommand> logger)
    {
        _audioAlert = audioAlert;
        _logger = logger;
    }

    public Task<CommandResultDto> ExecuteAsync(Guid commandId, string payloadJson)
    {
        var wasActive = _audioAlert.StopFindMe();
        _logger.LogInformation("Command stop_find_me dijalankan (wasActive={WasActive}).", wasActive);

        var output = wasActive
            ? "Alarm Find-Me berhasil dihentikan dan volume dikembalikan ke kondisi semula."
            : "Tidak ada alarm Find-Me yang sedang aktif.";

        return Task.FromResult(new CommandResultDto(
            commandId,
            true,
            output,
            DateTimeOffset.UtcNow));
    }
}
