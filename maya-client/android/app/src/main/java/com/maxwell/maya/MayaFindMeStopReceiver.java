package com.maxwell.maya;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationManagerCompat;

/**
 * Phase 8: Tombol STOP di notifikasi Find My Phone (alarm dimulai oleh FCM saat app tertutup).
 */
public class MayaFindMeStopReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        final Context appContext = context.getApplicationContext();
        new Thread(() -> {
            MayaFindMeController.stop();
            try {
                NotificationManagerCompat.from(appContext).cancel(MayaFindMeController.FIND_ME_NOTIFICATION_ID);
            } catch (Exception ignored) {}
        }, "MayaFindMeStop").start();
    }
}
