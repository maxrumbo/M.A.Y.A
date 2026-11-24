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

    /// <summary>
    /// Phase 6B: Dikirim server ke Maya.Agent saat pengaturan wake-word / hemat baterai berubah atau saat Agent connect.
    /// </summary>
    Task AgentSettingsChanged(AgentSettingsDto settings);

    /// <summary>
    /// Phase 6B: Dibroadcast ke Web/Mobile UI saat status listener wake-word di laptop berubah.
    /// </summary>
    Task WakeWordStatusChanged(WakeWordStatusDto status);

    /// <summary>
    /// Phase 6B: Dibroadcast ke Web/Mobile UI saat Maya.Agent mendeteksi frasa wake-word.
    /// </summary>
    Task WakeWordHeard(string phrase, DateTimeOffset timestamp);

    /// <summary>
    /// Phase 7: Dikirim server ke HP Android (group MobileDevices) untuk membunyikan alarm Find-Me.
    /// </summary>
    Task FindMyPhoneRequested(FindMeRequestDto request);

    /// <summary>
    /// Phase 7: Dikirim server ke HP Android untuk menghentikan alarm Find-Me.
    /// </summary>
    Task StopFindMyPhone();

    /// <summary>
    /// Phase 7: Dibroadcast ke UI saat jumlah HP online atau status Find-Me HP berubah.
    /// </summary>
    Task MobileStatusChanged(MobileStatusDto status);
}
