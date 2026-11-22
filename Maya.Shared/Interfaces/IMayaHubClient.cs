using Maya.Shared.DTOs.Agent;

namespace Maya.Shared.Interfaces;

/// <summary>
/// Kontrak SignalR Hub yang mendefinisikan method yang dapat dipanggil server ke client.
/// Diimplementasikan oleh:
///   - Maya.Agent: untuk menerima perintah eksekusi lokal.
///   - maya-web / maya-mobile: untuk menerima update status real-time.
/// </summary>
public interface IMayaHubClient
{
    /// <summary>
    /// Dikirim ke Maya.Agent untuk mengeksekusi perintah lokal di laptop.
    /// </summary>
    Task ExecuteCommand(AgentCommandDto command);

    /// <summary>
    /// Dibroadcast ke semua client saat status online/offline atau telemetri laptop berubah.
    /// </summary>
    Task AgentStatusChanged(DeviceStatusDto status);

    /// <summary>
    /// Dibroadcast ke semua client saat status eksekusi perintah berubah
    /// (misal: PendingConfirmation → Dispatched → Completed).
    /// </summary>
    Task CommandStatusUpdated(Guid commandId, string status, string? output);
}
