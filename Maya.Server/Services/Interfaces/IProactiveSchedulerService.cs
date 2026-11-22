namespace Maya.Server.Services.Interfaces;

/// <summary>
/// Proactive Background Scheduler — mengecek kondisi proaktif setiap 5 menit:
/// - 06:45 WIB: Morning Briefing via FCM
/// - Inactivity Check-in: jika MAX(chat_messages.created_at) > 12 jam
/// </summary>
public interface IProactiveSchedulerService
{
    // Interface marker — implementasi sebagai BackgroundService
}
