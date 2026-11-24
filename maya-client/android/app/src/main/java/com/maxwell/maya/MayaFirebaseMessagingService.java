package com.maxwell.maya;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Phase 8: Penerima Firebase Cloud Messaging.
 *
 *  - data type="find_me"      → bunyikan alarm Find-My-Phone SEKARANG meski app tertutup total
 *  - data type="find_me_stop" → hentikan alarm
 *  - notification message     → ditampilkan sistem saat app background; saat foreground ditampilkan di sini.
 *
 * Server mengirim find_me sebagai DATA-ONLY high priority message sehingga onMessageReceived
 * selalu dipanggil (tidak diintersep sistem).
 */
public class MayaFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "MayaFcmService";

    public static final String CHANNEL_GENERAL = "maya_general";
    public static final String CHANNEL_FIND_ME = "maya_find_me";
    private static final int GENERAL_NOTIFICATION_ID = 7002;

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        Map<String, String> data = message.getData();
        String type = data.get("type");
        Context context = getApplicationContext();

        if ("find_me".equals(type)) {
            int duration = 10;
            try {
                String raw = data.get("durationSeconds");
                if (raw != null) duration = Integer.parseInt(raw.trim());
            } catch (NumberFormatException ignored) {}

            String text = data.get("message");
            showFindMeNotification(context);
            MayaFindMeController.start(context, duration, text);
            return;
        }

        if ("find_me_stop".equals(type)) {
            MayaFindMeController.stop();
            try {
                NotificationManagerCompat.from(context).cancel(MayaFindMeController.FIND_ME_NOTIFICATION_ID);
            } catch (Exception ignored) {}
            return;
        }

        // Pesan notifikasi biasa (Morning Briefing / Check-in) saat app di foreground.
        RemoteMessage.Notification n = message.getNotification();
        if (n != null) {
            showGeneralNotification(context, n.getTitle(), n.getBody());
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        // Token dikirim ulang ke server oleh aplikasi saat dibuka (registerDeviceForPush di maya-client).
        Log.i(TAG, "FCM token diperbarui.");
    }

    // ─── Notifikasi ───────────────────────────────────────────────────────────

    static void ensureChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        NotificationChannel general = new NotificationChannel(
                CHANNEL_GENERAL, "Notifikasi M.A.Y.A.", NotificationManager.IMPORTANCE_HIGH);
        general.setDescription("Morning briefing, check-in, dan pesan proaktif dari M.A.Y.A.");
        nm.createNotificationChannel(general);

        NotificationChannel findMe = new NotificationChannel(
                CHANNEL_FIND_ME, "Find My Phone", NotificationManager.IMPORTANCE_HIGH);
        findMe.setDescription("Muncul saat HP sedang dibunyikan dari jarak jauh.");
        nm.createNotificationChannel(findMe);
    }

    private PendingIntent openAppIntent(Context context) {
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(
                context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void showGeneralNotification(Context context, String title, String body) {
        ensureChannels(context);
        try {
            NotificationCompat.Builder b = new NotificationCompat.Builder(context, CHANNEL_GENERAL)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(title != null ? title : "M.A.Y.A.")
                    .setContentText(body != null ? body : "")
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(body != null ? body : ""))
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setContentIntent(openAppIntent(context));
            NotificationManagerCompat.from(context).notify(GENERAL_NOTIFICATION_ID, b.build());
        } catch (SecurityException se) {
            Log.w(TAG, "Izin notifikasi belum diberikan: " + se.getMessage());
        }
    }

    private void showFindMeNotification(Context context) {
        ensureChannels(context);
        try {
            Intent stop = new Intent(context, MayaFindMeStopReceiver.class);
            PendingIntent stopPending = PendingIntent.getBroadcast(
                    context, 1, stop, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            NotificationCompat.Builder b = new NotificationCompat.Builder(context, CHANNEL_FIND_ME)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle("M.A.Y.A. — Find My Phone")
                    .setContentText("HP sedang dibunyikan. Ketuk STOP untuk mematikan alarm.")
                    .setOngoing(true)
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setContentIntent(openAppIntent(context))
                    .addAction(0, "STOP", stopPending);
            NotificationManagerCompat.from(context).notify(MayaFindMeController.FIND_ME_NOTIFICATION_ID, b.build());
        } catch (SecurityException se) {
            Log.w(TAG, "Izin notifikasi belum diberikan: " + se.getMessage());
        }
    }
}
