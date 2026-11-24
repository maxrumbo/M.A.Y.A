package com.maxwell.maya;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.speech.tts.TextToSpeech;
import android.speech.tts.Voice;
import android.util.Log;

import androidx.core.app.NotificationManagerCompat;

import java.util.Locale;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Phase 8: Mesin "Find My Phone" mandiri (tanpa bergantung pada Activity/Plugin WebView).
 *
 * Dipakai dari dua jalur:
 *  1. MayaNativePlugin  — saat HP menerima ping lewat SignalR (app sedang terbuka).
 *  2. MayaFirebaseMessagingService — saat menerima FCM data message type="find_me" (app tertutup total).
 *
 * Perilaku: simpan volume STREAM_ALARM → naikkan ke maksimum → ringtone alarm (USAGE_ALARM, looping)
 * + getar berpola + TTS suara perempuan Indonesia → SELALU kembalikan volume di blok finally.
 */
public final class MayaFindMeController {
    private static final String TAG = "MayaFindMeController";
    public static final int FIND_ME_NOTIFICATION_ID = 7001;

    public interface StopListener {
        void onStopped();
    }

    private static final Object LOCK = new Object();
    private static final AtomicBoolean stopRequested = new AtomicBoolean(false);
    private static Thread activeThread;
    private static volatile Ringtone activeRingtone;
    private static volatile Vibrator activeVibrator;
    private static volatile TextToSpeech activeTts;
    private static volatile StopListener stopListener;

    private MayaFindMeController() {}

    public static void setStopListener(StopListener listener) {
        stopListener = listener;
    }

    public static boolean isActive() {
        synchronized (LOCK) {
            return activeThread != null && activeThread.isAlive();
        }
    }

    public static void start(Context context, int durationSeconds, String message) {
        final Context appContext = context.getApplicationContext();
        final int duration = Math.max(1, Math.min(30, durationSeconds));
        final String text = (message == null || message.trim().isEmpty())
                ? "Aku di sini, Max!"
                : message.trim();

        stop();

        stopRequested.set(false);
        Thread worker = new Thread(() -> run(appContext, duration, text), "MayaFindMeWorker");
        synchronized (LOCK) {
            activeThread = worker;
        }
        worker.start();
    }

    public static void stop() {
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
        synchronized (LOCK) {
            prev = activeThread;
        }
        if (prev != null && prev != Thread.currentThread()) {
            prev.interrupt();
            try { prev.join(1500); } catch (InterruptedException ignored) {}
        }
    }

    private static void run(Context context, int durationSeconds, String message) {
        AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        Integer originalAlarmVolume = null;
        Ringtone ringtone = null;
        Vibrator vibrator = null;
        TextToSpeech tts = null;
        PowerManager.WakeLock wakeLock = null;

        try {
            // Jaga CPU tetap hidup selama alarm berbunyi (penting saat dibangunkan oleh FCM).
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "maya:findme");
                wakeLock.acquire((durationSeconds + 5) * 1000L);
            }

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

            try {
                Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (alarmUri == null) alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                if (alarmUri == null) alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

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

            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                    if (vm != null) vibrator = vm.getDefaultVibrator();
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
                        Runnable legacyVib = () -> vibrate(pattern);
                        legacyVib.run();
                    }
                }
            } catch (Exception ex) {
                Log.w(TAG, "Gagal mengaktifkan getar: " + ex.getMessage());
            }

            CountDownLatch ttsLatch = new CountDownLatch(1);
            final AtomicBoolean ttsReady = new AtomicBoolean(false);
            tts = new TextToSpeech(context, status -> {
                if (status == TextToSpeech.SUCCESS) ttsReady.set(true);
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

            if (wakeLock != null && wakeLock.isHeld()) {
                try { wakeLock.release(); } catch (Exception ignored) {}
            }

            try {
                NotificationManagerCompat.from(context).cancel(FIND_ME_NOTIFICATION_ID);
            } catch (Exception ignored) {}

            synchronized (LOCK) {
                if (activeThread == Thread.currentThread()) {
                    activeThread = null;
                }
            }

            StopListener listener = stopListener;
            if (listener != null) {
                try { listener.onStopped(); } catch (Exception ignored) {}
            }
        }
    }

    @SuppressWarnings("deprecation")
    private static void vibrate(long[] pattern) {
        Vibrator v = activeVibrator;
        if (v != null) v.vibrate(pattern, 0);
    }

    private static void configureIndonesianFemaleVoice(TextToSpeech tts) {
        Locale idLocale = new Locale("id", "ID");
        try {
            tts.setLanguage(idLocale);
            tts.setSpeechRate(1.05f);
            tts.setPitch(1.05f);

            Set<Voice> voices = tts.getVoices();
            if (voices == null || voices.isEmpty()) return;

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
