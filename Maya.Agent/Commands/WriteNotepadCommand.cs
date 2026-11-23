using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Maya.Shared.DTOs.Agent;

namespace Maya.Agent.Commands;

/// <summary>
/// Menyimpan teks catatan ke file .txt di Documents/MayaNotes/ lalu langsung membukanya di Notepad.
/// Perintah ini bersifat Low-Risk dan dapat dieksekusi tanpa konfirmasi biometrik/PIN.
/// </summary>
public class WriteNotepadCommand : ILocalCommand
{
    private readonly ILogger<WriteNotepadCommand> _logger;

    public string CommandName => "write_notepad";

    public WriteNotepadCommand(ILogger<WriteNotepadCommand> logger)
    {
        _logger = logger;
    }

    public async Task<CommandResultDto> ExecuteAsync(Guid commandId, string payloadJson)
    {
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            var root = doc.RootElement;

            var title = root.TryGetProperty("title", out var tEl) ? tEl.GetString()?.Trim() : null;
            var content = root.TryGetProperty("content", out var cEl) ? cEl.GetString() : null;

            if (string.IsNullOrWhiteSpace(title))
            {
                title = $"Catatan_{DateTime.Now:yyyyMMdd_HHmmss}";
            }

            // Folder Documents/MayaNotes/
            var docsFolder = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
            var targetDir = Path.Combine(docsFolder, "MayaNotes");
            if (!Directory.Exists(targetDir))
            {
                Directory.CreateDirectory(targetDir);
            }

            // Sanitasi nama file
            var invalidChars = Path.GetInvalidFileNameChars();
            var sanitizedTitle = string.Concat(title.Where(c => !invalidChars.Contains(c))).Trim();
            if (string.IsNullOrWhiteSpace(sanitizedTitle))
            {
                sanitizedTitle = $"Catatan_{DateTime.Now:yyyyMMdd_HHmmss}";
            }

            if (!sanitizedTitle.EndsWith(".txt", StringComparison.OrdinalIgnoreCase))
            {
                sanitizedTitle += ".txt";
            }

            var filePath = Path.Combine(targetDir, sanitizedTitle);

            // Simpan konten ke file teks
            await File.WriteAllTextAsync(filePath, content ?? string.Empty, Encoding.UTF8);

            _logger.LogInformation("Berhasil menyimpan catatan ke {FilePath}. Membuka Notepad...", filePath);

            // Buka file dengan Notepad
            var startInfo = new ProcessStartInfo
            {
                FileName = "notepad.exe",
                Arguments = $"\"{filePath}\"",
                UseShellExecute = true
            };

            Process.Start(startInfo);

            return new CommandResultDto(
                commandId,
                true,
                $"Catatan berhasil disimpan ke '{filePath}' dan dibuka di Notepad.",
                DateTimeOffset.UtcNow);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gagal menjalankan perintah write_notepad untuk CommandId={Id}", commandId);
            return new CommandResultDto(
                commandId,
                false,
                $"Gagal menulis ke Notepad: {ex.Message}",
                DateTimeOffset.UtcNow);
        }
    }
}
