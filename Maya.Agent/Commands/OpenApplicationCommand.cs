using System.Diagnostics;
using System.Text.Json;
using Maya.Shared.DTOs.Agent;

namespace Maya.Agent.Commands;

/// <summary>
/// Membuka aplikasi desktop yang terdaftar dalam AppAllowlist.
/// Keamanan: dilarang menjalankan binary di luar allowlist dan dilarang shell execution.
/// </summary>
public class OpenApplicationCommand : ILocalCommand
{
    private readonly IConfiguration _config;
    private readonly ILogger<OpenApplicationCommand> _logger;

    public string CommandName => "open_application";

    public OpenApplicationCommand(IConfiguration config, ILogger<OpenApplicationCommand> logger)
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
            var appName = root.TryGetProperty("app_name", out var aEl) ? aEl.GetString()?.Trim().ToLowerInvariant() : null;

            if (string.IsNullOrWhiteSpace(appName))
            {
                return Task.FromResult(new CommandResultDto(
                    commandId, false, "Nama aplikasi tidak valid atau kosong.", DateTimeOffset.UtcNow));
            }

            var allowlist = _config.GetSection("AppAllowlist").Get<Dictionary<string, string>>()
                ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            if (!allowlist.TryGetValue(appName, out var exeTarget) || string.IsNullOrWhiteSpace(exeTarget))
            {
                return Task.FromResult(new CommandResultDto(
                    commandId,
                    false,
                    $"Aplikasi '{appName}' tidak ditemukan dalam AppAllowlist.",
                    DateTimeOffset.UtcNow));
            }

            _logger.LogInformation("Membuka aplikasi allowlisted: {AppName} -> {Target}", appName, exeTarget);

            var startInfo = new ProcessStartInfo
            {
                FileName = exeTarget,
                UseShellExecute = true
            };

            Process.Start(startInfo);

            return Task.FromResult(new CommandResultDto(
                commandId,
                true,
                $"Aplikasi '{appName}' berhasil diluncurkan.",
                DateTimeOffset.UtcNow));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gagal meluncurkan aplikasi dengan payload {Payload}", payloadJson);
            return Task.FromResult(new CommandResultDto(
                commandId, false, $"Gagal membuka aplikasi: {ex.Message}", DateTimeOffset.UtcNow));
        }
    }
}
