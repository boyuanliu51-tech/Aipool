package com.aipool.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/** App 在后台时，在通知栏显示协同进度（进度条、当前阶段、正在工作的 AI、Token 用量）。 */
final class StatusNotifier {
    private static final String CHANNEL = "progress";
    private static final int ID = 1001;
    private static boolean foreground = true;
    private static String last = null;

    private StatusNotifier() {
    }

    static void setForeground(Context c, boolean fg) {
        foreground = fg;
        if (fg) manager(c).cancel(ID);
        else if (last != null) show(c, last);
    }

    static void update(Context c, String json) {
        last = json;
        if (!foreground) show(c, json);
    }

    private static NotificationManager manager(Context c) {
        return (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
    }

    private static String fmt(long n) {
        if (n >= 1_000_000) return String.format(java.util.Locale.US, "%.2fM", n / 1e6);
        if (n >= 10_000) return String.format(java.util.Locale.US, "%.1fk", n / 1e3);
        return String.valueOf(n);
    }

    private static void show(Context c, String json) {
        try {
            JSONObject s = new JSONObject(json);
            boolean busy = s.optBoolean("busy");
            String stage = s.optString("stage", "idle");
            NotificationManager m = manager(c);
            if (!busy && "idle".equals(stage)) {
                m.cancel(ID);
                return;
            }
            if (Build.VERSION.SDK_INT >= 26 && m.getNotificationChannel(CHANNEL) == null) {
                NotificationChannel ch = new NotificationChannel(CHANNEL, "协同进度", NotificationManager.IMPORTANCE_LOW);
                ch.setShowBadge(false);
                m.createNotificationChannel(ch);
            }

            int pct = s.optInt("pct");
            int total = s.optInt("total");
            int done = s.optInt("done");
            int fail = s.optInt("fail");
            long tokens = s.optLong("tokens");
            long budget = s.optLong("budget");
            JSONArray running = s.optJSONArray("running");
            StringBuilder who = new StringBuilder();
            if (running != null) {
                for (int i = 0; i < running.length(); i++) {
                    if (i > 0) who.append("、");
                    who.append(running.optString(i));
                }
            }

            String title = "AI协同台 · " + s.optString("stageName", "") + (busy ? " " + pct + "%" : "");
            String line = (total > 0 ? "任务 " + done + "/" + total + (fail > 0 ? "（失败 " + fail + "）" : "") + " · " : "")
                    + "Token " + fmt(tokens) + (budget > 0 ? " / " + fmt(budget) : "");
            String big = line
                    + (who.length() > 0 ? "\n正在工作：" + who : (busy ? "\n主控处理中…" : ""))
                    + (s.optString("goal").isEmpty() ? "" : "\n目标：" + s.optString("goal"));

            Intent open = new Intent(c, MainActivity.class)
                    .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            PendingIntent pi = PendingIntent.getActivity(c, 0, open,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            Notification.Builder b = Build.VERSION.SDK_INT >= 26
                    ? new Notification.Builder(c, CHANNEL)
                    : new Notification.Builder(c);
            b.setSmallIcon(busy ? android.R.drawable.stat_notify_sync : android.R.drawable.stat_sys_download_done)
                    .setContentTitle(title)
                    .setContentText(line)
                    .setStyle(new Notification.BigTextStyle().bigText(big))
                    .setContentIntent(pi)
                    .setOnlyAlertOnce(true)
                    .setShowWhen(false)
                    .setOngoing(busy)
                    .setAutoCancel(!busy);
            if (busy) b.setProgress(100, pct, false);
            m.notify(ID, b.build());
        } catch (Exception ignored) {
        }
    }
}
