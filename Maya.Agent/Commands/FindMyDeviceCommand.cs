using System.Text.Json;
using Maya.Agent.Audio;
using Maya.Shared.DTOs.Agent;

namespace Maya.Agent.Commands;

/// <summary>
/// Phase 6B: Perintah lokal Low-Risk "find_my_device".
/// Membunyikan ping 3 nada + TTS ("Aku di sini, Max!") dengan auto-unmute sementara
/// dan mengembalikan volume ke kondisi awal setelah selesai.
/// </summary>
public class FindMyDeviceCommand : ILocalCommand
{
    private readonly AudioAlertService _audioAlert;
    private readonly ILogger<FindMyDeviceCommand> _logger;

    public string CommandName => "find_my_device";

    public FindMyDeviceCommand(AudioAlertService audioAlert, ILogger<FindMyDeviceCommand> logger)
    {
        _audioAlert = audioAlert;
        _logger = logger;
    }

    public async Task<CommandResultDto> ExecuteAsync(Guid commandId, string payloadJson)
    {
        try
        {
            int? durationSeconds = null;
            string? message = null;

            if (!string.IsNullOrWhiteSpace(payloadJson))
            {
                using var doc = JsonDocument.Parse(payloadJson);
                var root = doc.RootElement;

                if (root.TryGetProperty("durationSeconds", out var dEl) && dEl.ValueKind == JsonValueKind.Number)
                    durationSeconds = dEl.GetInt32();
                else if (root.TryGetProperty("duration_seconds", out var dsEl) && dsEl.ValueKind == JsonValueKind.Number)
                    durationSeconds = dsEl.GetInt32();

                if (root.TryGetProperty("message", out var mEl) && mEl.ValueKind == JsonValueKind.String)
                    message = mEl.GetString();
            }

            var (_, effectiveDuration, effectiveMessage) = await _audioAlert.StartFindMeAsync(durationSeconds, message);

            _logger.LogInformation("Command find_my_device dijalankan (durasi={Sec}s).", effectiveDuration);

            return new CommandResultDto(
                commandId,
                true,
                $"Laptop berbunyi selama {effectiveDuration} detik dengan pesan \"{effectiveMessage}\".",
                DateTimeOffset.UtcNow);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gagal mengeksekusi command find_my_device.");
            return new CommandResultDto(
                commandId,
                false,
                $"Gagal membunyikan alarm Find-Me: {ex.Message}",
                DateTimeOffset.UtcNow);
        }
    }
}
