using System.Diagnostics;
using System.Text.Json;
using Maya.Shared.DTOs.Agent;

namespace Maya.Agent.Commands;

/// <summary>
/// Membuka URL website pada browser default Windows.
/// Keamanan: validasi skema URL wajib diawali http:// atau https://.
/// </summary>
public class OpenUrlCommand : ILocalCommand
{
    private readonly ILogger<OpenUrlCommand> _logger;

    public string CommandName => "open_url";

    public OpenUrlCommand(ILogger<OpenUrlCommand> logger)
    {
        _logger = logger;
    }

    public Task<CommandResultDto> ExecuteAsync(Guid commandId, string payloadJson)
    {
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            var root = doc.RootElement;
            var url = root.TryGetProperty("url", out var uEl) ? uEl.GetString()?.Trim() : null;

            if (string.IsNullOrWhiteSpace(url) ||
                (!url.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
                 !url.StartsWith("https://", StringComparison.OrdinalIgnoreCase)))
            {
                return Task.FromResult(new CommandResultDto(
                    commandId, false, "URL tidak valid. URL wajib diawali http:// atau https://.", DateTimeOffset.UtcNow));
            }

            _logger.LogInformation("Membuka URL di browser default: {Url}", url);

            var startInfo = new ProcessStartInfo(url)
            {
                UseShellExecute = true
            };

            Process.Start(startInfo);

            return Task.FromResult(new CommandResultDto(
                commandId, true, $"URL '{url}' berhasil dibuka di browser default.", DateTimeOffset.UtcNow));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gagal membuka URL: {Payload}", payloadJson);
            return Task.FromResult(new CommandResultDto(
                commandId, false, $"Gagal membuka URL: {ex.Message}", DateTimeOffset.UtcNow));
        }
    }
}
