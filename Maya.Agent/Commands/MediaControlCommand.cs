using System.Runtime.InteropServices;
using System.Text.Json;
using Maya.Shared.DTOs.Agent;

namespace Maya.Agent.Commands;

/// <summary>
/// Mengendalikan audio dan media playback Windows menggunakan virtual key events.
/// </summary>
public class MediaControlCommand : ILocalCommand
{
    private readonly ILogger<MediaControlCommand> _logger;

    public string CommandName => "control_laptop_media";

    [DllImport("user32.dll")]
    private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    private const byte VK_VOLUME_MUTE = 0xAD;
    private const byte VK_VOLUME_DOWN = 0xAE;
    private const byte VK_VOLUME_UP = 0xAF;
    private const byte VK_MEDIA_NEXT_TRACK = 0xB0;
    private const byte VK_MEDIA_PREV_TRACK = 0xB1;
    private const byte VK_MEDIA_PLAY_PAUSE = 0xB3;
    private const uint KEYEVENTF_KEYUP = 0x0002;

    public MediaControlCommand(ILogger<MediaControlCommand> logger)
    {
        _logger = logger;
    }

    public Task<CommandResultDto> ExecuteAsync(Guid commandId, string payloadJson)
    {
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            var root = doc.RootElement;
            var action = root.TryGetProperty("action", out var aEl) ? aEl.GetString()?.Trim().ToLowerInvariant() : "play_pause";

            _logger.LogInformation("MediaControlCommand diminta: {Action}", action);

            byte key = action switch
            {
                "play_pause" => VK_MEDIA_PLAY_PAUSE,
                "mute" => VK_VOLUME_MUTE,
                "volume_up" => VK_VOLUME_UP,
                "volume_down" => VK_VOLUME_DOWN,
                "next_track" => VK_MEDIA_NEXT_TRACK,
                "prev_track" or "previous_track" => VK_MEDIA_PREV_TRACK,
                _ => 0
            };

            if (key == 0)
            {
                return Task.FromResult(new CommandResultDto(
                    commandId, false, $"Aksi media '{action}' tidak dikenal.", DateTimeOffset.UtcNow));
            }

            // Simulasi key press & release
            keybd_event(key, 0, 0, UIntPtr.Zero);
            keybd_event(key, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);

            return Task.FromResult(new CommandResultDto(
                commandId, true, $"Aksi media '{action}' berhasil dijalankan di laptop.", DateTimeOffset.UtcNow));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gagal mengontrol media.");
            return Task.FromResult(new CommandResultDto(commandId, false, $"Error media control: {ex.Message}", DateTimeOffset.UtcNow));
        }
    }
}
