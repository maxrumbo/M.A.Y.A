package com.maxwell.maya;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.speech.tts.TextToSpeech;
import android.speech.tts.Voice;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Phase 7: Native Capacitor plugin untuk Mode "Find My Phone" di Android.
 * - Menyimpan volume STREAM_ALARM awal -> naikkan ke maks -> putar alarm + getar + TTS perempuan Indonesia
 * - Selalu mengembalikan volume STREAM_ALARM awal di blok finally (saat selesai, di-stop, atau error)
 */
@CapacitorPlugin(name = "MayaNative")
public class MayaNativePlugin extends Plugin {
    private static final String TAG = "MayaNativePlugin";

    private final Object lock = new Object();
    private final AtomicBoolean stopRequested = new AtomicBoolean(false);
    private Thread activeThread;
    private volatile Ringtone activeRingtone;
    private volatile Vibrator activeVibrator;
    private volatile TextToSpeech activeTts;

    @PluginMethod
    public void startFindMe(PluginCall call) {
        int rawDuration = call.getInt("durationSeconds", 10);
        int durationSeconds = Math.max(1, Math.min(30, rawDuration));
        String rawMessage = call.getString("message", "Aku di sini, Max!");
        String message = (rawMessage == null || rawMessage.trim().isEmpty())
                ? "Aku di sini, Max!"
                : rawMessage.trim();

        // Hentikan alarm sebelumnya jika masih berjalan
        stopInternal();

        stopRequested.set(false);
        Thread worker = new Thread(() -> runFindMeLoop(durationSeconds, message), "MayaFindMeWorker");
        synchronized (lock) {
            activeThread = worker;
        }
        worker.start();

        JSObject ret = new JSObject();
        ret.put("started", true);
        ret.put("durationSeconds", durationSeconds);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopFindMe(PluginCall call) {
        stopInternal();
        JSObject ret = new JSObject();
        ret.put("stopped", true);
        call.resolve(ret);
    }

    @Override
    protected void handleOnDestroy() {
        stopInternal();
        super.handleOnDestroy();
    }

    private void stopInternal() {
        stopRequested.set(true);

        Ringtone r = activeRingtone;
        if (r != null) {
            try { r.stop(); } catch (Exception ignored) {}
        }

        Vibrator v = activeVibrator;
        if (v != null) {
            try { v.cancel(); } catch (Exception ignored) {}
        }

        TextToSpeech t = activeTts;
        if (t != null) {
            try { t.stop(); } catch (Exception ignored) {}
        }

        Thread prev;
        synchronized (lock) {
            prev = activeThread;
        }
        if (prev != null && prev != Thread.currentThread()) {
            prev.interrupt();
            try { prev.join(1500); } catch (InterruptedException ignored) {}
        }
    }

    private void runFindMeLoop(int durationSeconds, String message) {
        Context context = getContext();
        if (context == null) {
            return;
        }

        AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        Integer originalAlarmVolume = null;
        Ringtone ringtone = null;
        Vibrator vibrator = null;
        TextToSpeech tts = null;

        try {
            // 1. Simpan volume STREAM_ALARM awal lalu naikkan ke maksimum
            if (audioManager != null) {
                try {
                    originalAlarmVolume = audioManager.getStreamVolume(AudioManager.STREAM_ALARM);
                    int maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
                    audioManager.setStreamVolume(AudioManager.STREAM_ALARM, maxVol, 0);
                } catch (SecurityException se) {
                    Log.w(TAG, "Tidak dapat mengubah STREAM_ALARM (kemungkinan DND aktif): " + se.getMessage());
                } catch (Exception ex) {
                    Log.w(TAG, "Gagal mengatur volume alarm: " + ex.getMessage());
                }
            }

            // 2. Putar nada alarm pada stream USAGE_ALARM
            try {
                Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (alarmUri == null) {
                    alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                }
                if (alarmUri == null) {
                    alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                }

                if (alarmUri != null) {
                    ringtone = RingtoneManager.getRingtone(context, alarmUri);
                    if (ringtone != null) {
                        ringtone.setAudioAttributes(
                                new AudioAttributes.Builder()
                                        .setUsage(AudioAttributes.USAGE_ALARM)
                                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                        .build()
                        );
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                            ringtone.setLooping(true);
                        }
                        activeRingtone = ringtone;
                        ringtone.play();
                    }
                }
            } catch (Exception ex) {
                Log.w(TAG, "Gagal memulai ringtone alarm: " + ex.getMessage());
            }

            // 3. Getar berpola berulang
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                    if (vm != null) {
                        vibrator = vm.getDefaultVibrator();
                    }
                } else {
                    @SuppressWarnings("deprecation")
                    Vibrator legacy = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                    vibrator = legacy;
                }

                if (vibrator != null && vibrator.hasVibrator()) {
                    activeVibrator = vibrator;
                    long[] pattern = new long[]{0, 450, 250, 450, 500};
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                    } else {
                        @SuppressWarnings("deprecation")
                        Runnable legacyVib = () -> {
                            if (activeVibrator != null) {
                                activeVibrator.vibrate(pattern, 0);
                            }
                        };
                        legacyVib.run();
                    }
                }
            } catch (Exception ex) {
                Log.w(TAG, "Gagal mengaktifkan getar: " + ex.getMessage());
            }

            // 4. Inisialisasi TTS lokal dengan prioritas suara perempuan Indonesia
            CountDownLatch ttsLatch = new CountDownLatch(1);
            final AtomicBoolean ttsReady = new AtomicBoolean(false);
            tts = new TextToSpeech(context.getApplicationContext(), status -> {
                if (status == TextToSpeech.SUCCESS) {
                    ttsReady.set(true);
                }
                ttsLatch.countDown();
            });
            activeTts = tts;

            try {
                ttsLatch.await(1500, TimeUnit.MILLISECONDS);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }

            if (ttsReady.get() && !stopRequested.get()) {
                configureIndonesianFemaleVoice(tts);
                tts.setAudioAttributes(
                        new AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_ALARM)
                                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                                .build()
                );
            }

            // 5. Loop sampai durasi habis atau user menekan STOP
            long endTime = System.currentTimeMillis() + (durationSeconds * 1000L);
            long nextSpeakAt = 0;

            while (!stopRequested.get() && System.currentTimeMillis() < endTime) {
                long now = System.currentTimeMillis();

                if (ringtone != null && !ringtone.isPlaying() && !stopRequested.get()) {
                    try { ringtone.play(); } catch (Exception ignored) {}
                }

                if (ttsReady.get() && now >= nextSpeakAt && !stopRequested.get()) {
                    try {
                        tts.speak(message, TextToSpeech.QUEUE_FLUSH, null, "maya_find_me_" + now);
                    } catch (Exception ex) {
                        Log.w(TAG, "Gagal memutar TTS Find-Me: " + ex.getMessage());
                    }
                    nextSpeakAt = now + 3500L;
                }

                try {
                    Thread.sleep(200);
                } catch (InterruptedException ie) {
                    break;
                }
            }
        } finally {
            // WAJIB: Hentikan semua audio/getar dan kembalikan volume alarm ke nilai awal
            if (ringtone != null) {
                try { ringtone.stop(); } catch (Exception ignored) {}
            }
            activeRingtone = null;

            if (vibrator != null) {
                try { vibrator.cancel(); } catch (Exception ignored) {}
            }
            activeVibrator = null;

            if (tts != null) {
                try {
                    tts.stop();
                    tts.shutdown();
                } catch (Exception ignored) {}
            }
            activeTts = null;

            if (audioManager != null && originalAlarmVolume != null) {
                try {
                    audioManager.setStreamVolume(AudioManager.STREAM_ALARM, originalAlarmVolume, 0);
                } catch (Exception ex) {
                    Log.w(TAG, "Gagal mengembalikan volume alarm awal: " + ex.getMessage());
                }
            }

            synchronized (lock) {
                if (activeThread == Thread.currentThread()) {
                    activeThread = null;
                }
            }

            notifyListeners("findMeStopped", new JSObject());
        }
    }

    private void configureIndonesianFemaleVoice(TextToSpeech tts) {
        Locale idLocale = new Locale("id", "ID");
        try {
            tts.setLanguage(idLocale);
            tts.setSpeechRate(1.05f);
            tts.setPitch(1.05f);

            Set<Voice> voices = tts.getVoices();
            if (voices == null || voices.isEmpty()) {
                return;
            }

            Voice best = null;
            int bestScore = -1;

            for (Voice v : voices) {
                if (v == null || v.getLocale() == null) continue;
                String lang = v.getLocale().getLanguage();
                if (!"id".equalsIgnoreCase(lang) && !"in".equalsIgnoreCase(lang)) continue;

                String name = v.getName() != null ? v.getName().toLowerCase(Locale.ROOT) : "";
                boolean looksMale = name.contains("ardi")
                        || name.contains("male")
                        || name.contains("id-id-x-dfz")
                        || name.contains("id-id-x-idd");
                boolean looksFemale = name.contains("gadis")
                        || name.contains("female")
                        || name.contains("id-id-x-idc")
                        || name.contains("id-id-x-ide");

                int score = 10;
                if (looksFemale && !looksMale) score += 50;
                else if (!looksMale) score += 25;
                if (!v.isNetworkConnectionRequired()) score += 5;

                if (score > bestScore) {
                    bestScore = score;
                    best = v;
                }
            }

            if (best != null) {
                tts.setVoice(best);
            }
        } catch (Exception ex) {
            Log.w(TAG, "Fallback ke voice TTS default: " + ex.getMessage());
        }
    }
}
