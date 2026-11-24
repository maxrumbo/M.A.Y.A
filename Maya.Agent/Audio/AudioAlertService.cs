using System.Runtime.Versioning;
using System.Speech.Synthesis;
using NAudio.CoreAudioApi;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;

namespace Maya.Agent.Audio;

/// <summary>
/// Layanan audio lokal untuk Mode "Find-Me" dan respons singkat wake-word di Windows:
/// - Mengontrol master volume via NAudio Core Audio (simpan → unmute & naikkan → selalu restore di finally)
/// - Memutar nada ping menggunakan NAudio SignalGenerator (tanpa file audio eksternal)
/// - Memutar respons TTS lokal menggunakan System.Speech.Synthesis (pilih voice id-ID jika tersedia)
/// - Memancarkan event PlaybackStateChanged sebagai guard Anti-Echo untuk WakeWordListenerService
/// </summary>
public class AudioAlertService : IDisposable
{
    private readonly IConfiguration _config;
    private readonly ILogger<AudioAlertService> _logger;
    private readonly object _syncLock = new();

    private CancellationTokenSource? _findMeCts;
    private volatile bool _isFindMeActive;
    private int _activePlaybackCount;

    public bool IsFindMeActive => _isFindMeActive;
    public bool IsSpeakingOrAlerting => Volatile.Read(ref _activePlaybackCount) > 0;

    /// <summary>
    /// Dipancarkan saat Agent mulai (true) atau selesai (false) mengeluarkan suara/alarm.
    /// Digunakan oleh WakeWordListenerService untuk menjeda recognizer (Anti-Echo).
    /// </summary>
    public event Action<bool>? PlaybackStateChanged;

    /// <summary>
    /// Dipancarkan saat status alarm Find-Me berubah (mulai / berhenti).
    /// </summary>
    public event Action<bool>? FindMeStateChanged;

    public AudioAlertService(IConfiguration config, ILogger<AudioAlertService> logger)
    {
        _config = config;
        _logger = logger;
    }

    /// <summary>
    /// Memulai alarm Find-Me (ping 3 nada + TTS "Aku di sini, Max!") di background
    /// dengan durasi terbatasi (default 10 detik, maks 30 detik).
    /// </summary>
    public Task<(bool Started, int EffectiveDurationSeconds, string EffectiveMessage)> StartFindMeAsync(
        int? durationSeconds = null,
        string? customMessage = null)
    {
        var defaultDuration = _config.GetValue<int?>("FindMe:DefaultDurationSeconds") ?? 10;
        var maxDuration = _config.GetValue<int?>("FindMe:MaxDurationSeconds") ?? 30;
        var minVolumePercent = _config.GetValue<int?>("FindMe:MinVolumePercent") ?? 80;
        var defaultMessage = _config["FindMe:DefaultMessage"] ?? "Aku di sini, Max!";

        var effectiveDuration = Math.Clamp(durationSeconds ?? defaultDuration, 1, Math.Clamp(maxDuration, 5, 60));
        var effectiveMinVolume = Math.Clamp(minVolumePercent / 100f, 0.2f, 1.0f);
        var effectiveMessage = string.IsNullOrWhiteSpace(customMessage) ? defaultMessage : customMessage.Trim();

        CancellationTokenSource cts;
        lock (_syncLock)
        {
            // Hentikan alarm sebelumnya jika masih berjalan
            if (_findMeCts is not null)
            {
                try { _findMeCts.Cancel(); } catch { }
                _findMeCts.Dispose();
            }

            cts = new CancellationTokenSource(TimeSpan.FromSeconds(effectiveDuration));
            _findMeCts = cts;
            _isFindMeActive = true;
        }

        FindMeStateChanged?.Invoke(true);
        _logger.LogInformation(
            "Memulai Mode Find-Me selama {Duration} detik (minVol={Vol}%, pesan='{Msg}').",
            effectiveDuration, Math.Round(effectiveMinVolume * 100), effectiveMessage);

        _ = Task.Run(() => RunFindMeLoopAsync(effectiveMinVolume, effectiveMessage, cts), CancellationToken.None);

        return Task.FromResult((true, effectiveDuration, effectiveMessage));
    }

    /// <summary>
    /// Menghentikan alarm Find-Me yang sedang berjalan secara instan.
    /// Volume akan langsung dikembalikan oleh blok finally pada loop.
    /// </summary>
    public bool StopFindMe()
    {
        CancellationTokenSource? ctsToCancel;
        bool wasActive;

        lock (_syncLock)
        {
            wasActive = _isFindMeActive;
            ctsToCancel = _findMeCts;
        }

        if (ctsToCancel is not null)
        {
            try
            {
                ctsToCancel.Cancel();
            }
            catch (ObjectDisposedException)
            {
                // Already disposed
            }
        }

        if (wasActive)
        {
            _logger.LogInformation("Mode Find-Me dihentikan oleh permintaan Stop.");
        }

        return wasActive;
    }

    /// <summary>
    /// Memutar ding singkat + balasan suara ringan (tanpa mengubah master volume)
    /// saat wake-word umum ("Hey Maya" / "Maya") terdeteksi.
    /// </summary>
    public async Task PlayAcknowledgeAsync(string text = "Ya, Max?", CancellationToken ct = default)
    {
        if (!OperatingSystem.IsWindows())
        {
            _logger.LogWarning("PlayAcknowledgeAsync dilewati: hanya didukung di Windows.");
            return;
        }

        BeginPlayback();
        try
        {
            await PlayToneAsync(880, 110, 0.25, ct);
            await Task.Delay(40, ct);
            await PlayToneAsync(1174.66, 140, 0.25, ct);

            if (!string.IsNullOrWhiteSpace(text))
            {
                await SpeakLocalAsync(text, ct);
            }
        }
        catch (OperationCanceledException)
        {
            // Normal cancellation
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Gagal memutar respons acknowledge wake-word.");
        }
        finally
        {
            EndPlayback();
        }
    }

    private async Task RunFindMeLoopAsync(float minVolumeScalar, string message, CancellationTokenSource cts)
    {
        var ct = cts.Token;

        if (!OperatingSystem.IsWindows())
        {
            _logger.LogWarning("RunFindMeLoopAsync: audio Windows tidak tersedia di OS ini.");
            FinishFindMe(cts);
            return;
        }

        BeginPlayback();

        MMDeviceEnumerator? enumerator = null;
        MMDevice? renderDevice = null;
        float? originalVolume = null;
        bool? originalMute = null;

        try
        {
            // 1. Simpan volume & mute awal, lalu unmute & naikkan minimal ke 80%
            try
            {
                enumerator = new MMDeviceEnumerator();
                renderDevice = enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia);

                originalVolume = renderDevice.AudioEndpointVolume.MasterVolumeLevelScalar;
                originalMute = renderDevice.AudioEndpointVolume.Mute;

                if (originalMute == true)
                {
                    renderDevice.AudioEndpointVolume.Mute = false;
                }

                if (originalVolume < minVolumeScalar)
                {
                    renderDevice.AudioEndpointVolume.MasterVolumeLevelScalar = minVolumeScalar;
                }

                _logger.LogInformation(
                    "Volume Find-Me diatur: awal={OrigVol}% (mute={OrigMute}) → aktif={CurVol}% (mute=false)",
                    Math.Round((originalVolume ?? 0f) * 100),
                    originalMute,
                    Math.Round(renderDevice.AudioEndpointVolume.MasterVolumeLevelScalar * 100));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Tidak dapat membaca/mengubah master volume Core Audio. Melanjutkan playback dengan volume saat ini.");
            }

            // 2. Ulangi pola ping 3 nada + TTS sampai durasi habis atau dihentikan
            while (!ct.IsCancellationRequested)
            {
                await PlayThreeTonePingAsync(ct);

                if (ct.IsCancellationRequested) break;

                await SpeakLocalAsync(message, ct);

                if (ct.IsCancellationRequested) break;

                await Task.Delay(750, ct);
            }
        }
        catch (OperationCanceledException)
        {
            // Normal: durasi habis atau user menekan Stop
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error selama loop audio Find-Me.");
        }
        finally
        {
            // 3. WAJIB: Selalu kembalikan volume & status mute ke kondisi semula
            try
            {
                if (renderDevice is not null && originalVolume.HasValue && originalMute.HasValue)
                {
                    renderDevice.AudioEndpointVolume.MasterVolumeLevelScalar = originalVolume.Value;
                    renderDevice.AudioEndpointVolume.Mute = originalMute.Value;
                    _logger.LogInformation(
                        "Volume & status mute berhasil dikembalikan ke awal ({Vol}%, mute={Mute}).",
                        Math.Round(originalVolume.Value * 100),
                        originalMute.Value);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Gagal mengembalikan volume awal setelah Find-Me.");
            }

            renderDevice?.Dispose();
            enumerator?.Dispose();
            EndPlayback();
            FinishFindMe(cts);
        }
    }

    private void FinishFindMe(CancellationTokenSource completedCts)
    {
        bool shouldNotify = false;
        lock (_syncLock)
        {
            if (ReferenceEquals(_findMeCts, completedCts))
            {
                _findMeCts = null;
                _isFindMeActive = false;
                shouldNotify = true;
            }
        }

        try { completedCts.Dispose(); } catch { }

        if (shouldNotify)
        {
            FindMeStateChanged?.Invoke(false);
        }
    }

    private void BeginPlayback()
    {
        if (Interlocked.Increment(ref _activePlaybackCount) == 1)
        {
            PlaybackStateChanged?.Invoke(true);
        }
    }

    private void EndPlayback()
    {
        if (Interlocked.Decrement(ref _activePlaybackCount) == 0)
        {
            PlaybackStateChanged?.Invoke(false);
        }
    }

    [SupportedOSPlatform("windows")]
    private async Task PlayThreeTonePingAsync(CancellationToken ct)
    {
        // Pola 3 nada naik (A5 → D6 → G6) yang mudah terdengar di ruangan
        await PlayToneAsync(880.0, 160, 0.35, ct);
        await Task.Delay(70, ct);
        await PlayToneAsync(1174.66, 160, 0.35, ct);
        await Task.Delay(70, ct);
        await PlayToneAsync(1567.98, 240, 0.40, ct);
        await Task.Delay(120, ct);
    }

    [SupportedOSPlatform("windows")]
    private async Task PlayToneAsync(double frequencyHz, int durationMs, double gain, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        var signal = new SignalGenerator(44100, 1)
        {
            Gain = gain,
            Frequency = frequencyHz,
            Type = SignalGeneratorType.Sin
        }.Take(TimeSpan.FromMilliseconds(durationMs));

        using var waveOut = new WaveOut();
        var tcs = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

        waveOut.PlaybackStopped += (_, _) => tcs.TrySetResult();
        waveOut.Init(signal);
        waveOut.Play();

        using var reg = ct.Register(() =>
        {
            try { waveOut.Stop(); } catch { }
            tcs.TrySetCanceled(ct);
        });

        await tcs.Task;
    }

    [SupportedOSPlatform("windows")]
    private Task SpeakLocalAsync(string text, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        var tcs = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

        var thread = new Thread(() =>
        {
            try
            {
                using var synth = new SpeechSynthesizer();
                synth.SetOutputToDefaultAudioDevice();
                synth.Rate = 1; // Sedikit sigap

                // Prioritaskan suara PEREMPUAN bahasa Indonesia (Gadis / Female / id-ID),
                // fallback ke suara perempuan lain jika voice id-ID belum terpasang di Windows
                var installedVoices = synth.GetInstalledVoices()
                    .Where(v => v.Enabled && v.VoiceInfo is not null && !string.IsNullOrWhiteSpace(v.VoiceInfo.Name))
                    .Select(v => v.VoiceInfo!)
                    .ToList();

                var preferredVoice =
                    installedVoices.FirstOrDefault(v =>
                        (v.Name ?? string.Empty).Contains("Gadis", StringComparison.OrdinalIgnoreCase))
                    ?? installedVoices.FirstOrDefault(v =>
                        v.Culture?.Name?.StartsWith("id", StringComparison.OrdinalIgnoreCase) == true &&
                        (v.Gender == VoiceGender.Female || (v.Name ?? string.Empty).Contains("Female", StringComparison.OrdinalIgnoreCase)))
                    ?? installedVoices.FirstOrDefault(v =>
                        v.Culture?.Name?.StartsWith("id", StringComparison.OrdinalIgnoreCase) == true &&
                        !(v.Name ?? string.Empty).Contains("Ardi", StringComparison.OrdinalIgnoreCase) &&
                        v.Gender != VoiceGender.Male)
                    ?? installedVoices.FirstOrDefault(v =>
                        v.Culture?.Name?.StartsWith("id", StringComparison.OrdinalIgnoreCase) == true)
                    ?? installedVoices.FirstOrDefault(v =>
                        v.Gender == VoiceGender.Female || (v.Name ?? string.Empty).Contains("Zira", StringComparison.OrdinalIgnoreCase));

                if (preferredVoice is not null && !string.IsNullOrWhiteSpace(preferredVoice.Name))
                {
                    synth.SelectVoice(preferredVoice.Name);
                }

                using var reg = ct.Register(() =>
                {
                    try { synth.SpeakAsyncCancelAll(); } catch { }
                });

                var prompt = synth.SpeakAsync(text);
                while (!prompt.IsCompleted && !ct.IsCancellationRequested)
                {
                    Thread.Sleep(50);
                }

                if (ct.IsCancellationRequested)
                {
                    try { synth.SpeakAsyncCancelAll(); } catch { }
                    tcs.TrySetCanceled(ct);
                }
                else
                {
                    tcs.TrySetResult();
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Gagal memutar TTS lokal via System.Speech.Synthesis.");
                tcs.TrySetResult();
            }
        })
        {
            IsBackground = true,
            Name = "MayaLocalTtsThread"
        };

        thread.Start();
        return tcs.Task;
    }

    public void Dispose()
    {
        StopFindMe();
    }
}
