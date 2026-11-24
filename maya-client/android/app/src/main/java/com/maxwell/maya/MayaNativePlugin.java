package com.maxwell.maya;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
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
import com.google.firebase.messaging.FirebaseMessaging;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

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

    @Override
    public void load() {
        super.load();
        MayaKeepAliveService.setStateListener((isRunning, reason) -> {
            JSObject payload = new JSObject();
            payload.put("running", isRunning);
            payload.put("reason", reason);
            notifyListeners("keepAliveStateChanged", payload);
        });

        // Phase 8: Find-Me kini dijalankan MayaFindMeController (dipakai juga oleh jalur FCM saat app tertutup)
        MayaFindMeController.setStopListener(() -> notifyListeners("findMeStopped", new JSObject()));
        Context ctx = getContext();
        if (ctx != null) {
            MayaFirebaseMessagingService.ensureChannels(ctx);
        }
    }

    // ─── 1. Mode "Find My Phone" (Phase 7, mesin dipindah ke MayaFindMeController di Phase 8) ───

    @PluginMethod
    public void startFindMe(PluginCall call) {
        int rawDuration = call.getInt("durationSeconds", 10);
        int durationSeconds = Math.max(1, Math.min(30, rawDuration));
        String rawMessage = call.getString("message", "Aku di sini, Max!");
        String message = (rawMessage == null || rawMessage.trim().isEmpty())
                ? "Aku di sini, Max!"
                : rawMessage.trim();

        MayaFindMeController.start(getContext(), durationSeconds, message);

        JSObject ret = new JSObject();
        ret.put("started", true);
        ret.put("durationSeconds", durationSeconds);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopFindMe(PluginCall call) {
        MayaFindMeController.stop();
        JSObject ret = new JSObject();
        ret.put("stopped", true);
        call.resolve(ret);
    }

    // ─── 1b. Firebase Cloud Messaging (Phase 8) ───────────────────────────────

    private boolean notificationsGranted() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                || getPermissionState("notifications") == PermissionState.GRANTED;
    }

    @PluginMethod
    public void requestPushPermission(PluginCall call) {
        if (!notificationsGranted()) {
            requestPermissionForAlias("notifications", call, "pushPermissionCallback");
            return;
        }
        resolvePushPermission(call);
    }

    @PermissionCallback
    private void pushPermissionCallback(PluginCall call) {
        resolvePushPermission(call);
    }

    private void resolvePushPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", notificationsGranted());
        call.resolve(ret);
    }

    /**
     * Mengambil FCM registration token. Jika google-services.json belum dipasang saat build,
     * Firebase tidak terinisialisasi → resolve {available:false} (BUKAN error) agar app tetap normal.
     */
    @PluginMethod
    public void getFcmToken(PluginCall call) {
        try {
            FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                JSObject ret = new JSObject();
                ret.put("notificationsGranted", notificationsGranted());
                if (task.isSuccessful() && task.getResult() != null) {
                    ret.put("available", true);
                    ret.put("token", task.getResult());
                } else {
                    ret.put("available", false);
                    Exception ex = task.getException();
                    ret.put("reason", ex != null && ex.getMessage() != null ? ex.getMessage() : "token_unavailable");
                }
                call.resolve(ret);
            });
        } catch (Exception ex) {
            JSObject ret = new JSObject();
            ret.put("available", false);
            ret.put("notificationsGranted", notificationsGranted());
            ret.put("reason", "firebase_not_configured");
            call.resolve(ret);
        }
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

    @Override
    protected void handleOnDestroy() {
        MayaKeepAliveService.setStateListener(null);
        MayaFindMeController.setStopListener(null);
        super.handleOnDestroy();
    }
}
