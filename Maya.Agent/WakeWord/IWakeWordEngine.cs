namespace Maya.Agent.WakeWord;

/// <summary>
/// Data event saat frasa wake-word dikenali secara lokal oleh IWakeWordEngine.
/// </summary>
public record WakeWordDetectedEventArgs(
    string Phrase,
    float Confidence,
    DateTimeOffset DetectedAt
);

/// <summary>
/// Abstraksi engine wake-word lokal untuk Maya.Agent (Phase 6B).
///
/// Implementasi default:
///   - <see cref="WindowsSpeechWakeWordEngine"/> (System.Speech, gratis & offline tanpa API key).
///
/// Panduan upgrade ke engine khusus (Picovoice Porcupine / Sherpa-ONNX):
///   1. Buat adapter yang mengimplementasikan interface ini (mis. PorcupineWakeWordEngine atau SherpaOnnxWakeWordEngine).
///   2. Baca kredensial/model path dari IConfiguration (mis. Picovoice:AccessKey dari user-secrets atau path file .ppn/.onnx).
///   3. Daftarkan adapter tersebut di Maya.Agent/Program.cs menggantikan WindowsSpeechWakeWordEngine saat kredensial tersedia.
///   Seluruh orkestrasi (hemat baterai, anti-echo, cooldown, Find-Me, dan SignalR) di WakeWordListenerService
///   otomatis bekerja tanpa perlu diubah.
/// </summary>
public interface IWakeWordEngine : IDisposable
{
    /// <summary>
    /// Nama engine beserta kultur/model yang aktif (ditampilkan di UI).
    /// </summary>
    string EngineName { get; }

    /// <summary>
    /// True bila engine & perangkat audio siap digunakan.
    /// </summary>
    bool IsSupported { get; }

    /// <summary>
    /// Alasan ketidaktersediaan jika IsSupported == false.
    /// </summary>
    string? UnsupportedReason { get; }

    /// <summary>
    /// True bila engine sedang aktif mendengarkan mikrofon.
    /// </summary>
    bool IsListening { get; }

    /// <summary>
    /// Dipicu saat frasa wake-word melewati threshold confidence.
    /// </summary>
    event EventHandler<WakeWordDetectedEventArgs>? WakeWordDetected;

    /// <summary>
    /// Menginisialisasi recognizer & memuat grammar tertutup. Tidak membuka mikrofon sebelum Start() dipanggil.
    /// </summary>
    bool TryInitialize(double confidenceThreshold);

    /// <summary>
    /// Memulai atau melanjutkan pendengaran wake-word secara asinkron.
    /// </summary>
    void Start();

    /// <summary>
    /// Menjeda pendengaran sementara (dipakai untuk Anti-Echo atau Mode Hemat Baterai).
    /// </summary>
    void Pause();

    /// <summary>
    /// Menghentikan pendengaran wake-word.
    /// </summary>
    void Stop();
}
