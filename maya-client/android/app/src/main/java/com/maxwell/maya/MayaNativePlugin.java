package com.maxwell.maya;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.Settings;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.speech.tts.TextToSpeech;
import android.speech.tts.Voice;
import android.util.Base64;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Phase 7 & 7B: Native Capacitor plugin M.A.Y.A. untuk Android:
 * 1. Mode "Find My Phone" (STREAM_ALARM + getar + TTS perempuan Indonesia + restore volume di finally)
 * 2. Native Biometric Auth (AndroidX BiometricPrompt + Android Keystore AES-256-GCM PIN Vault)
 * 3. Foreground Keep-Alive Service (MayaKeepAliveService) + shortcut Optimasi Baterai
 */
@CapacitorPlugin(
        name = "MayaNative",
        permissions = {
                @Permission(
                        alias = "notifications",
                        strings = { Manifest.permission.POST_NOTIFICATIONS }
                )
        }
)
public class MayaNativePlugin extends Plugin {
    private static final String TAG = "MayaNativePlugin";
    private static final String PREFS_NAME = "maya_biometric_vault";
    private static final String KEY_PIN_CIPHER = "pin_cipher_b64";
    private static final String KEY_PIN_IV = "pin_iv_b64";
    private static final String KEYSTORE_ALIAS = "maya_biometric_pin_aes_key";

    private final Object lock = new Object();
    private final AtomicBoolean stopRequested = new AtomicBoolean(false);
    private Thread activeThread;
    private volatile Ringtone activeRingtone;
    private volatile Vibrator activeVibrator;
    private volatile TextToSpeech activeTts;

    @Override
    public void load() {
        super.load();
        MayaKeepAliveService.setStateListener((isRunning, reason) -> {
            JSObject payload = new JSObject();
            payload.put("running", isRunning);
            payload.put("reason", reason);
            notifyListeners("keepAliveStateChanged", payload);
        });
    }

    // ─── 1. Mode "Find My Phone" (Phase 7) ────────────────────────────────────

    @PluginMethod
    public void startFindMe(PluginCall call) {
        int rawDuration = call.getInt("durationSeconds", 10);
        int durationSeconds = Math.max(1, Math.min(30, rawDuration));
        String rawMessage = call.getString("message", "Aku di sini, Max!");
        String message = (rawMessage == null || rawMessage.trim().isEmpty())
                ? "Aku di sini, Max!"
                : rawMessage.trim();

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

    // ─── 2. Native Android Biometric Auth & Keystore (Phase 7B) ───────────────

    @PluginMethod
    public void checkBiometricAvailability(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context tidak tersedia.");
            return;
        }

        BiometricManager bm = BiometricManager.from(context);
        int authTypes = BiometricManager.Authenticators.BIOMETRIC_STRONG
                | BiometricManager.Authenticators.BIOMETRIC_WEAK;
        int canAuth = bm.canAuthenticate(authTypes);

        boolean available = (canAuth == BiometricManager.BIOMETRIC_SUCCESS);
        String statusText;
        switch (canAuth) {
            case BiometricManager.BIOMETRIC_SUCCESS:
                statusText = "ready";
                break;
            case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED:
                statusText = "none_enrolled";
                break;
            case BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE:
                statusText = "no_hardware";
                break;
            case BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE:
                statusText = "hw_unavailable";
                break;
            default:
                statusText = "unavailable";
                break;
        }

        JSObject ret = new JSObject();
        ret.put("available", available);
        ret.put("hasSavedPin", hasEncryptedPin(context));
        ret.put("status", statusText);
        call.resolve(ret);
    }

    @PluginMethod
    public void saveBiometricPin(PluginCall call) {
        String pin = call.getString("pin", "");
        if (pin == null || pin.trim().length() < 4) {
            call.reject("PIN tidak valid untuk disimpan.");
            return;
        }

        Context context = getContext();
        if (context == null) {
            call.reject("Context tidak tersedia.");
            return;
        }

        try {
            SecretKey key = getOrCreateKeystoreKey();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key);
            byte[] iv = cipher.getIV();
            byte[] encrypted = cipher.doFinal(pin.trim().getBytes(StandardCharsets.UTF_8));

            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit()
                    .putString(KEY_PIN_CIPHER, Base64.encodeToString(encrypted, Base64.NO_WRAP))
                    .putString(KEY_PIN_IV, Base64.encodeToString(iv, Base64.NO_WRAP))
                    .apply();

            JSObject ret = new JSObject();
            ret.put("saved", true);
            call.resolve(ret);
        } catch (Exception ex) {
            Log.e(TAG, "Gagal menyimpan PIN ke Android Keystore: " + ex.getMessage());
            call.reject("Gagal mengenkripsi PIN ke Android Keystore.");
        }
    }

    @PluginMethod
    public void clearBiometricPin(PluginCall call) {
        Context context = getContext();
        if (context != null) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().clear().apply();
        }
        JSObject ret = new JSObject();
        ret.put("cleared", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void authenticateBiometric(PluginCall call) {
        String title = call.getString("title", "Verifikasi M.A.Y.A.");
        String subtitle = call.getString("subtitle", "Gunakan Sidik Jari atau Face Unlock");
        String negativeText = call.getString("negativeText", "Gunakan PIN");

        FragmentActivity activity = getActivity();
        if (activity == null) {
            call.reject("Activity tidak tersedia.");
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                        .setTitle(title != null ? title : "Verifikasi M.A.Y.A.")
                        .setSubtitle(subtitle != null ? subtitle : "Gunakan Sidik Jari atau Face Unlock")
                        .setNegativeButtonText(negativeText != null ? negativeText : "Gunakan PIN")
                        .setAllowedAuthenticators(
                                BiometricManager.Authenticators.BIOMETRIC_STRONG
                                        | BiometricManager.Authenticators.BIOMETRIC_WEAK
                        )
                        .build();

                BiometricPrompt biometricPrompt = new BiometricPrompt(
                        activity,
                        ContextCompat.getMainExecutor(activity),
                        new BiometricPrompt.AuthenticationCallback() {
                            @Override
                            public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                                JSObject ret = new JSObject();
                                ret.put("authenticated", true);
                                String decryptedPin = decryptStoredPin(activity);
                                if (decryptedPin != null) {
                                    ret.put("pin", decryptedPin);
                                }
                                call.resolve(ret);
                            }

                            @Override
                            public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                                call.reject(errString.toString(), String.valueOf(errorCode));
                            }

                            @Override
                            public void onAuthenticationFailed() {
                                // Biarkan pengguna mencoba jari lagi pada prompt sistem
                            }
                        }
                );

                biometricPrompt.authenticate(promptInfo);
            } catch (Exception ex) {
                call.reject("Gagal menampilkan BiometricPrompt: " + ex.getMessage());
            }
        });
    }

    // ─── 3. Foreground Keep-Alive Service & Battery Optimization (Phase 7B) ───

    @PluginMethod
    public void getKeepAliveStatus(PluginCall call) {
        Context context = getContext();
        int batteryPercent = 100;
        boolean isCharging = false;
        boolean ignoringBatteryOpt = false;

        if (context != null) {
            Intent batIntent = context.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            if (batIntent != null) {
                int level = batIntent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                int scale = batIntent.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
                int status = batIntent.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
                if (level >= 0 && scale > 0) {
                    batteryPercent = (level * 100) / scale;
                }
                isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING
                        || status == BatteryManager.BATTERY_STATUS_FULL;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    ignoringBatteryOpt = pm.isIgnoringBatteryOptimizations(context.getPackageName());
                }
            } else {
                ignoringBatteryOpt = true;
            }
        }

        JSObject ret = new JSObject();
        ret.put("running", MayaKeepAliveService.isRunning());
        ret.put("batterySaverEnabled", MayaKeepAliveService.isBatterySaverActive());
        ret.put("reason", MayaKeepAliveService.getLastReason());
        ret.put("batteryPercent", batteryPercent);
        ret.put("isCharging", isCharging);
        ret.put("ignoringBatteryOptimizations", ignoringBatteryOpt);
        call.resolve(ret);
    }

    @PluginMethod
    public void startKeepAliveService(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationsPermissionCallback");
            return;
        }
        launchKeepAliveInternal(call);
    }

    @PermissionCallback
    private void notificationsPermissionCallback(PluginCall call) {
        // Tetap jalankan Foreground Service meski izin notifikasi ditolak (Android mengizinkan startForeground;
        // notifikasi hanya disembunyikan di shade jika ditolak).
        launchKeepAliveInternal(call);
    }

    private void launchKeepAliveInternal(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context tidak tersedia.");
            return;
        }

        boolean batterySaver = Boolean.TRUE.equals(call.getBoolean("batterySaverEnabled", true));
        int threshold = call.getInt("batteryThreshold", 20);

        try {
            Intent intent = new Intent(context, MayaKeepAliveService.class);
            intent.setAction(MayaKeepAliveService.ACTION_START);
            intent.putExtra(MayaKeepAliveService.EXTRA_BATTERY_SAVER, batterySaver);
            intent.putExtra(MayaKeepAliveService.EXTRA_BATTERY_THRESHOLD, threshold);
            ContextCompat.startForegroundService(context, intent);

            JSObject ret = new JSObject();
            ret.put("started", true);
            ret.put("running", true);
            call.resolve(ret);
        } catch (Exception ex) {
            Log.e(TAG, "Gagal start MayaKeepAliveService: " + ex.getMessage());
            call.reject("Gagal mengaktifkan Mode Stand-By: " + ex.getMessage());
        }
    }

    @PluginMethod
    public void stopKeepAliveService(PluginCall call) {
        Context context = getContext();
        if (context != null) {
            Intent intent = new Intent(context, MayaKeepAliveService.class);
            intent.setAction(MayaKeepAliveService.ACTION_STOP);
            context.stopService(intent);
        }
        JSObject ret = new JSObject();
        ret.put("stopped", true);
        ret.put("running", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void openBatteryOptimizationSettings(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context tidak tersedia.");
            return;
        }

        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            } else {
                intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + context.getPackageName()));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            call.resolve(new JSObject().put("opened", true));
        } catch (Exception ex) {
            try {
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                fallback.setData(Uri.parse("package:" + context.getPackageName()));
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(fallback);
                call.resolve(new JSObject().put("opened", true));
            } catch (Exception ex2) {
                call.reject("Tidak dapat membuka pengaturan baterai: " + ex2.getMessage());
            }
        }
    }

    // ─── Keystore Helpers ─────────────────────────────────────────────────────

    private boolean hasEncryptedPin(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.contains(KEY_PIN_CIPHER) && prefs.contains(KEY_PIN_IV);
    }

    private SecretKey getOrCreateKeystoreKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(KEYSTORE_ALIAS)) {
            KeyStore.SecretKeyEntry entry = (KeyStore.SecretKeyEntry) keyStore.getEntry(KEYSTORE_ALIAS, null);
            if (entry != null) {
                return entry.getSecretKey();
            }
        }

        KeyGenerator keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
                KEYSTORE_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build();
        keyGenerator.init(spec);
        return keyGenerator.generateKey();
    }

    private String decryptStoredPin(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String cipherB64 = prefs.getString(KEY_PIN_CIPHER, null);
            String ivB64 = prefs.getString(KEY_PIN_IV, null);
            if (cipherB64 == null || ivB64 == null) return null;

            SecretKey key = getOrCreateKeystoreKey();
            byte[] iv = Base64.decode(ivB64, Base64.NO_WRAP);
            byte[] cipherBytes = Base64.decode(cipherB64, Base64.NO_WRAP);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, iv));
            byte[] plain = cipher.doFinal(cipherBytes);
            return new String(plain, StandardCharsets.UTF_8);
        } catch (Exception ex) {
            Log.w(TAG, "Gagal mendekripsi PIN dari Keystore: " + ex.getMessage());
            return null;
        }
    }

    // ─── Find My Phone Loop Helpers (Phase 7) ─────────────────────────────────

    @Override
    protected void handleOnDestroy() {
        MayaKeepAliveService.setStateListener(null);
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
                        Runnable legacyVib = () -> {
                            if (activeVibrator != null) activeVibrator.vibrate(pattern, 0);
                        };
                        legacyVib.run();
                    }
                }
            } catch (Exception ex) {
                Log.w(TAG, "Gagal mengaktifkan getar: " + ex.getMessage());
            }

            CountDownLatch ttsLatch = new CountDownLatch(1);
            final AtomicBoolean ttsReady = new AtomicBoolean(false);
            tts = new TextToSpeech(context.getApplicationContext(), status -> {
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
