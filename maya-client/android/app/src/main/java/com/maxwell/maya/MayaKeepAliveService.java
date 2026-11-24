package com.maxwell.maya;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.os.BatteryManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/**
 * Phase 7B: Android Foreground Service ringan untuk menjaga proses aplikasi & koneksi SignalR
 * tetap aktif saat layar mati (Mode Stand-By), dengan guard Mode Hemat Baterai (< 20% tanpa charger).
 */
public class MayaKeepAliveService extends Service {
    private static final String TAG = "MayaKeepAliveService";
    private static final String CHANNEL_ID = "maya_keep_alive_channel";
    private static final int NOTIFICATION_ID = 7001;

    public static final String ACTION_START = "com.maxwell.maya.KEEP_ALIVE_START";
    public static final String ACTION_STOP = "com.maxwell.maya.KEEP_ALIVE_STOP";
    public static final String EXTRA_BATTERY_SAVER = "batterySaverEnabled";
    public static final String EXTRA_BATTERY_THRESHOLD = "batteryThreshold";

    private static volatile boolean running = false;
    private static volatile boolean batterySaverActive = true;
    private static volatile int batteryThreshold = 20;
    private static volatile String lastReason = "Nonaktif (opt-in).";
    private static volatile StateListener stateListener;

    private PowerManager.WakeLock wakeLock;
    private BroadcastReceiver batteryReceiver;

    public interface StateListener {
        void onKeepAliveStateChanged(boolean isRunning, String reason);
    }

    public static void setStateListener(@Nullable StateListener listener) {
        stateListener = listener;
    }

    public static boolean isRunning() {
        return running;
    }

    public static boolean isBatterySaverActive() {
        return batterySaverActive;
    }

    public static String getLastReason() {
        return lastReason;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            lastReason = "Dimatikan oleh pengguna.";
            stopSelf();
            return START_NOT_STICKY;
        }

        if (intent != null) {
            batterySaverActive = intent.getBooleanExtra(EXTRA_BATTERY_SAVER, true);
            batteryThreshold = Math.max(5, Math.min(50, intent.getIntExtra(EXTRA_BATTERY_THRESHOLD, 20)));
        }

        Notification notification = buildNotification();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ServiceCompat.startForeground(
                        this,
                        NOTIFICATION_ID,
                        notification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                );
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception ex) {
            Log.e(TAG, "Gagal memulai Foreground Service: " + ex.getMessage());
            running = false;
            lastReason = "Gagal memulai service: " + ex.getMessage();
            notifyState();
            stopSelf();
            return START_NOT_STICKY;
        }

        // Cek kondisi baterai segera setelah start
        if (shouldStopForLowBattery()) {
            lastReason = "Dijeda otomatis: baterai HP di bawah " + batteryThreshold + "% dan tidak di-charge.";
            Log.i(TAG, lastReason);
            stopSelf();
            return START_NOT_STICKY;
        }

        acquireWakeLock();
        registerBatteryMonitor();

        running = true;
        lastReason = "Aktif menjaga koneksi di latar belakang.";
        notifyState();
        Log.i(TAG, "MayaKeepAliveService aktif (batterySaver=" + batterySaverActive + ").");

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        unregisterBatteryMonitor();
        releaseWakeLock();

        boolean wasRunning = running;
        running = false;
        if (wasRunning && (lastReason == null || lastReason.startsWith("Aktif"))) {
            lastReason = "Service dihentikan.";
        }
        notifyState();
        Log.i(TAG, "MayaKeepAliveService dihentikan (" + lastReason + ").");
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void notifyState() {
        StateListener listener = stateListener;
        if (listener != null) {
            listener.onKeepAliveStateChanged(running, lastReason);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "M.A.Y.A. Background Connection",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Notifikasi persisten untuk menjaga koneksi real-time M.A.Y.A. saat layar mati.");
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent openPending = PendingIntent.getActivity(this, 0, openIntent, piFlags);

        Intent stopIntent = new Intent(this, MayaKeepAliveService.class);
        stopIntent.setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(this, 1, stopIntent, piFlags);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("M.A.Y.A. aktif di latar belakang")
                .setContentText("Menjaga koneksi real-time & Mode Find My Phone")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setOngoing(true)
                .setSilent(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(openPending)
                .addAction(0, "Matikan", stopPending)
                .build();
    }

    private void acquireWakeLock() {
        try {
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Maya::KeepAliveWakeLock");
                    wakeLock.setReferenceCounted(false);
                }
            }
            if (wakeLock != null && !wakeLock.isHeld()) {
                // Batasi durasi akuisisi maksimum 6 jam untuk keamanan daya baterai
                wakeLock.acquire(6 * 60 * 60 * 1000L);
            }
        } catch (Exception ex) {
            Log.w(TAG, "Gagal acquire partial wake lock: " + ex.getMessage());
        }
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception ignored) {
        }
        wakeLock = null;
    }

    private void registerBatteryMonitor() {
        if (batteryReceiver != null) return;
        batteryReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (!batterySaverActive) return;
                if (isLowBatteryFromIntent(intent)) {
                    lastReason = "Dijeda otomatis: baterai HP < " + batteryThreshold + "% dan tidak di-charge.";
                    Log.i(TAG, lastReason);
                    stopSelf();
                }
            }
        };
        IntentFilter filter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
        registerReceiver(batteryReceiver, filter);
    }

    private void unregisterBatteryMonitor() {
        if (batteryReceiver != null) {
            try {
                unregisterReceiver(batteryReceiver);
            } catch (Exception ignored) {
            }
            batteryReceiver = null;
        }
    }

    private boolean shouldStopForLowBattery() {
        if (!batterySaverActive) return false;
        Intent batteryStatus = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        return batteryStatus != null && isLowBatteryFromIntent(batteryStatus);
    }

    private boolean isLowBatteryFromIntent(Intent intent) {
        int level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
        int scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
        int status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
        boolean isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING
                || status == BatteryManager.BATTERY_STATUS_FULL;

        if (level < 0 || scale <= 0) return false;
        int pct = (level * 100) / scale;
        return !isCharging && pct < batteryThreshold;
    }
}
