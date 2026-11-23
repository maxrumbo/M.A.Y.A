using System.Globalization;
using System.Runtime.Versioning;
using System.Speech.Recognition;

namespace Maya.Agent.WakeWord;

/// <summary>
/// Implementasi default IWakeWordEngine menggunakan Windows Speech Recognition (System.Speech)
/// dengan closed grammar (daftar frasa terbatas) — gratis, offline, ringan di CPU, dan tanpa API key.
///
/// Catatan akurasi:
///   Windows biasanya menyediakan recognizer en-US (dan kadang id-ID jika Language Pack Speech terpasang).
///   Engine ini memilih id-ID jika tersedia, atau fallback ke en-US dengan frasa Inggris + Indonesia best-effort.
/// </summary>
public class WindowsSpeechWakeWordEngine : IWakeWordEngine
{
    private readonly ILogger<WindowsSpeechWakeWordEngine> _logger;
    private readonly object _syncLock = new();

    private SpeechRecognitionEngine? _recognizer;
    private double _confidenceThreshold = 0.80;
    private volatile bool _isSupported;
    private volatile bool _isListening;
    private string _engineName = "WindowsSpeech";
    private string? _unsupportedReason;

    private static readonly string[] WakePhrases =
    [
        "maya",
        "hey maya",
        "hai maya",
        "maya kamu di mana",
        "maya dimana",
        "maya where are you",
        "where are you maya",
        "kamu di mana",
        "where are you",
        "maya stop",
        "stop maya",
        "maya diam"
    ];

    public string EngineName => _engineName;
    public bool IsSupported => _isSupported;
    public string? UnsupportedReason => _unsupportedReason;
    public bool IsListening => _isListening;

    public event EventHandler<WakeWordDetectedEventArgs>? WakeWordDetected;

    public WindowsSpeechWakeWordEngine(ILogger<WindowsSpeechWakeWordEngine> logger)
    {
        _logger = logger;
    }

    public bool TryInitialize(double confidenceThreshold)
    {
        _confidenceThreshold = Math.Clamp(confidenceThreshold, 0.30, 0.99);

        if (!OperatingSystem.IsWindows())
        {
            _isSupported = false;
            _unsupportedReason = "Windows Speech Recognition hanya didukung di Windows.";
            return false;
        }

        return TryInitializeWindows();
    }

    [SupportedOSPlatform("windows")]
    private bool TryInitializeWindows()
    {
        lock (_syncLock)
        {
            if (_recognizer is not null)
            {
                return _isSupported;
            }

            try
            {
                var installed = SpeechRecognitionEngine.InstalledRecognizers();
                if (installed is null || installed.Count == 0)
                {
                    _isSupported = false;
                    _unsupportedReason = "Tidak ada Windows Speech Recognizer yang terpasang di sistem.";
                    _logger.LogWarning("{Reason}", _unsupportedReason);
                    return false;
                }

                // Prioritaskan id-ID jika ada, lalu en-US, lalu recognizer pertama yang tersedia
                var chosen = installed.FirstOrDefault(r =>
                                 r.Culture.Name.StartsWith("id", StringComparison.OrdinalIgnoreCase))
                             ?? installed.FirstOrDefault(r =>
                                 r.Culture.Name.Equals("en-US", StringComparison.OrdinalIgnoreCase))
                             ?? installed[0];

                _engineName = $"WindowsSpeech ({chosen.Culture.Name})";
                _logger.LogInformation(
                    "Menginisialisasi {Engine} (Recognizer: {Name}, Threshold: {Threshold:F2}).",
                    _engineName, chosen.Name, _confidenceThreshold);

                var engine = new SpeechRecognitionEngine(chosen.Culture);

                // Closed grammar: ringan di CPU dan meminimalkan false positive
                var choices = new Choices(WakePhrases);
                var grammarBuilder = new GrammarBuilder(choices)
                {
                    Culture = chosen.Culture
                };
                var grammar = new Grammar(grammarBuilder)
                {
                    Name = "MayaWakeWordClosedGrammar"
                };

                engine.LoadGrammar(grammar);
                engine.SetInputToDefaultAudioDevice();

                engine.SpeechRecognized += OnSpeechRecognized;
                engine.RecognizeCompleted += OnRecognizeCompleted;

                _recognizer = engine;
                _isSupported = true;
                _unsupportedReason = null;

                return true;
            }
            catch (InvalidOperationException ex)
            {
                _isSupported = false;
                _unsupportedReason = $"Perangkat mikrofon default tidak tersedia: {ex.Message}";
                _logger.LogWarning(ex, "Wake-word engine tidak didukung: {Reason}", _unsupportedReason);
                return false;
            }
            catch (Exception ex)
            {
                _isSupported = false;
                _unsupportedReason = $"Gagal menginisialisasi Windows Speech Recognizer: {ex.Message}";
                _logger.LogWarning(ex, "Wake-word engine gagal inisialisasi: {Reason}", _unsupportedReason);
                return false;
            }
        }
    }

    public void Start()
    {
        if (!OperatingSystem.IsWindows()) return;
        StartWindows();
    }

    [SupportedOSPlatform("windows")]
    private void StartWindows()
    {
        lock (_syncLock)
        {
            if (!_isSupported || _recognizer is null || _isListening)
            {
                return;
            }

            try
            {
                _recognizer.RecognizeAsync(RecognizeMode.Multiple);
                _isListening = true;
                _logger.LogDebug("{Engine} mulai mendengarkan.", _engineName);
            }
            catch (InvalidOperationException ex)
            {
                // Bisa terjadi jika recognizer sedang dalam proses transisi stop; tandai state aman
                _logger.LogDebug(ex, "Start() dilewati karena recognizer sedang transisi state.");
            }
            catch (Exception ex)
            {
                _isListening = false;
                _isSupported = false;
                _unsupportedReason = $"Mikrofon terputus atau gagal mulai mendengarkan: {ex.Message}";
                _logger.LogWarning(ex, "{Reason}", _unsupportedReason);
            }
        }
    }

    public void Pause()
    {
        StopInternal("dijeda");
    }

    public void Stop()
    {
        StopInternal("dihentikan");
    }

    private void StopInternal(string actionLabel)
    {
        if (!OperatingSystem.IsWindows()) return;
        StopWindows(actionLabel);
    }

    [SupportedOSPlatform("windows")]
    private void StopWindows(string actionLabel)
    {
        lock (_syncLock)
        {
            if (_recognizer is null || !_isListening)
            {
                return;
            }

            try
            {
                _recognizer.RecognizeAsyncCancel();
                _isListening = false;
                _logger.LogDebug("{Engine} {Action}.", _engineName, actionLabel);
            }
            catch (Exception ex)
            {
                _isListening = false;
                _logger.LogDebug(ex, "Error minor saat menghentikan recognizer.");
            }
        }
    }

    [SupportedOSPlatform("windows")]
    private void OnSpeechRecognized(object? sender, SpeechRecognizedEventArgs e)
    {
        if (e.Result is null) return;

        var phrase = e.Result.Text?.Trim() ?? string.Empty;
        var confidence = e.Result.Confidence;

        if (string.IsNullOrWhiteSpace(phrase)) return;

        if (confidence < _confidenceThreshold)
        {
            _logger.LogDebug(
                "Frasa '{Phrase}' diabaikan (confidence {Conf:F2} < threshold {Thr:F2}).",
                phrase, confidence, _confidenceThreshold);
            return;
        }

        _logger.LogInformation(
            "Wake-word terdeteksi: '{Phrase}' (confidence={Conf:F2}, engine={Engine}).",
            phrase, confidence, _engineName);

        WakeWordDetected?.Invoke(this, new WakeWordDetectedEventArgs(phrase, confidence, DateTimeOffset.UtcNow));
    }

    [SupportedOSPlatform("windows")]
    private void OnRecognizeCompleted(object? sender, RecognizeCompletedEventArgs e)
    {
        lock (_syncLock)
        {
            _isListening = false;
        }

        if (e.Error is not null)
        {
            _logger.LogWarning(e.Error, "Speech recognition berhenti karena error.");
        }
    }

    public void Dispose()
    {
        if (!OperatingSystem.IsWindows()) return;
        DisposeWindows();
    }

    [SupportedOSPlatform("windows")]
    private void DisposeWindows()
    {
        lock (_syncLock)
        {
            if (_recognizer is not null)
            {
                try
                {
                    _recognizer.SpeechRecognized -= OnSpeechRecognized;
                    _recognizer.RecognizeCompleted -= OnRecognizeCompleted;
                    _recognizer.RecognizeAsyncCancel();
                    _recognizer.Dispose();
                }
                catch
                {
                    // ignore dispose errors
                }

                _recognizer = null;
                _isListening = false;
            }
        }
    }
}
