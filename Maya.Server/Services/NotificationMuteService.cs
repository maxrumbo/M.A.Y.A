using Maya.Server.Services.Interfaces;

namespace Maya.Server.Services;

/// <summary>
/// Singleton service untuk menyimpan status snooze/mute notifikasi proaktif di memori server.
/// </summary>
public class NotificationMuteService : INotificationMuteService
{
    private DateTimeOffset? _mutedUntil;
    private readonly object _lock = new();
    private readonly ILogger<NotificationMuteService> _logger;

    public NotificationMuteService(ILogger<NotificationMuteService> logger)
    {
        _logger = logger;
    }

    public bool IsMuted
    {
        get
        {
            lock (_lock)
            {
                if (!_mutedUntil.HasValue) return false;
                if (DateTimeOffset.UtcNow >= _mutedUntil.Value)
                {
                    _mutedUntil = null;
                    return false;
                }
                return true;
            }
        }
    }

    public DateTimeOffset? MutedUntil
    {
        get
        {
            lock (_lock)
            {
                return IsMuted ? _mutedUntil : null;
            }
        }
    }

    public int RemainingMinutes
    {
        get
        {
            lock (_lock)
            {
                if (!IsMuted || !_mutedUntil.HasValue) return 0;
                var remaining = _mutedUntil.Value - DateTimeOffset.UtcNow;
                return (int)Math.Max(0, Math.Ceiling(remaining.TotalMinutes));
            }
        }
    }

    public void Mute(TimeSpan duration)
    {
        lock (_lock)
        {
            _mutedUntil = DateTimeOffset.UtcNow.Add(duration);
            _logger.LogInformation("Notifikasi proaktif di-mute selama {Minutes} menit (hingga {Until} UTC).",
                duration.TotalMinutes, _mutedUntil);
        }
    }

    public void Unmute()
    {
        lock (_lock)
        {
            _mutedUntil = null;
            _logger.LogInformation("Status mute notifikasi proaktif dibatalkan (unmuted).");
        }
    }
}
