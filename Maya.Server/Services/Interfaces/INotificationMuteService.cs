namespace Maya.Server.Services.Interfaces;

/// <summary>
/// Layanan manajemen status mute / snooze notifikasi proaktif M.A.Y.A. (U3 Hardening/UX).
/// </summary>
public interface INotificationMuteService
{
    bool IsMuted { get; }
    DateTimeOffset? MutedUntil { get; }
    int RemainingMinutes { get; }

    void Mute(TimeSpan duration);
    void Unmute();
}
