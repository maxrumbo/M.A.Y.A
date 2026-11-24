namespace Maya.Server.Services.Interfaces;

/// <summary>
/// Firebase Cloud Messaging push notification service.
/// Jika Firebase:ServiceAccountJson / Firebase:ServiceAccountJsonBase64 tidak dikonfigurasi,
/// notifikasi hanya di-log ke console (tidak crash).
/// </summary>
public interface IFcmNotificationService
{
    bool IsConfigured { get; }

    /// <summary>
    /// Kirim push notification ke semua device Maxwell yang terdaftar.
    /// Jika FCM tidak dikonfigurasi → log saja, return false.
    /// </summary>
    Task<bool> SendNotificationAsync(string title, string body, string? data = null);

    /// <summary>
    /// Phase 8: Kirim FCM data-only message berprioritas tinggi (tanpa blok notification)
    /// sehingga FirebaseMessagingService di HP selalu dipanggil meski app tertutup total
    /// (dipakai oleh Find My Phone: type = "find_me"). Mengembalikan jumlah token yang berhasil dikirimi.
    /// </summary>
    Task<int> SendDataMessageAsync(IDictionary<string, string> data, TimeSpan? timeToLive = null);

    /// <summary>
    /// Jumlah perangkat mobile yang memiliki FCM token terdaftar.
    /// </summary>
    Task<int> CountRegisteredDevicesAsync();

    /// <summary>
    /// Daftarkan FCM token dari Android app ke device_statuses.
    /// </summary>
    Task RegisterFcmTokenAsync(string deviceId, string fcmToken);
}
