using System.Diagnostics;
using System.Text.Json;
using Maya.Shared.DTOs.Agent;

namespace Maya.Agent.Commands;

/// <summary>
/// Menjalankan workflow Git secara terstruktur.
/// Keamanan: menggunakan binary git langsung dengan argumen terstruktur, tanpa eval/shell execution.
/// </summary>
public class GitWorkflowCommand : ILocalCommand
{
    private readonly ILogger<GitWorkflowCommand> _logger;

    public string CommandName => "git_workflow";

    private static readonly HashSet<string> AllowedActions = new(StringComparer.OrdinalIgnoreCase)
    {
        "status", "pull", "log", "push"
    };

    public GitWorkflowCommand(ILogger<GitWorkflowCommand> logger)
    {
        _logger = logger;
    }

    public async Task<CommandResultDto> ExecuteAsync(Guid commandId, string payloadJson)
    {
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            var root = doc.RootElement;
            var repoPath = root.TryGetProperty("repo_path", out var rEl) ? rEl.GetString()?.Trim() : null;
            var action = root.TryGetProperty("action", out var aEl) ? aEl.GetString()?.Trim().ToLowerInvariant() : "status";

            if (string.IsNullOrWhiteSpace(action) || !AllowedActions.Contains(action))
            {
                return new CommandResultDto(
                    commandId, false, $"Aksi Git '{action}' tidak diizinkan. Hanya: status, pull, log, push.", DateTimeOffset.UtcNow);
            }

            var workingDir = !string.IsNullOrWhiteSpace(repoPath) && Directory.Exists(repoPath)
                ? repoPath
                : Directory.GetCurrentDirectory();

            _logger.LogInformation("Menjalankan git {Action} di folder: {Dir}", action, workingDir);

            var startInfo = new ProcessStartInfo
            {
                FileName = "git",
                Arguments = action == "log" ? "log -n 5 --oneline" : action,
                WorkingDirectory = workingDir,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = Process.Start(startInfo);
            if (process is null)
            {
                return new CommandResultDto(commandId, false, "Gagal memulai proses Git.", DateTimeOffset.UtcNow);
            }

            var stdout = await process.StandardOutput.ReadToEndAsync();
            var stderr = await process.StandardError.ReadToEndAsync();
            await process.WaitForExitAsync();

            var output = string.IsNullOrWhiteSpace(stderr) ? stdout : $"{stdout}\n{stderr}".Trim();
            var isSuccess = process.ExitCode == 0;

            return new CommandResultDto(
                commandId,
                isSuccess,
                isSuccess ? output : $"Git error (exit code {process.ExitCode}): {output}",
                DateTimeOffset.UtcNow);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gagal menjalankan git workflow.");
            return new CommandResultDto(commandId, false, $"Exception: {ex.Message}", DateTimeOffset.UtcNow);
        }
    }
}
