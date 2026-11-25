import React, { useCallback, useEffect, useState } from 'react';
import {
  Plug,
  Mail,
  CalendarDays,
  BellRing,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Link2,
  Unlink,
  Send,
  Smartphone,
} from 'lucide-react';
import { api } from '../api/client';
import type { GoogleIntegrationStatus, FcmIntegrationStatus } from '../api/client';
import { isNativeMobile } from '../services/mobileNative';
import { registerDeviceForPush } from '../services/pushNotifications';

type Feedback = { type: 'success' | 'error' | 'info'; text: string } | null;

const feedbackClass: Record<'success' | 'error' | 'info', string> = {
  success:
    'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50',
  error:
    'text-rose-700 dark:text-red-400 bg-rose-50 dark:bg-red-950/40 border-rose-200 dark:border-red-900/50',
  info: 'text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800',
};

const StatusBadge: React.FC<{ ok: boolean; okText: string; offText: string }> = ({
  ok,
  okText,
  offText,
}) => (
  <span
    className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full border text-[10px] font-mono ${
      ok
        ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-400'
        : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500'
    }`}
  >
    {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
    <span>{ok ? okText : offText}</span>
  </span>
);

export const IntegrationsPanel: React.FC = () => {
  const [google, setGoogle] = useState<GoogleIntegrationStatus | null>(null);
  const [fcm, setFcm] = useState<FcmIntegrationStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [googleFeedback, setGoogleFeedback] = useState<Feedback>(null);
  const [fcmFeedback, setFcmFeedback] = useState<Feedback>(null);
  const nativeMobile = isNativeMobile();

  const refresh = useCallback(async () => {
    setLoading(true);
    const [g, f] = await Promise.allSettled([api.getGoogleStatus(), api.getFcmStatus()]);
    if (g.status === 'fulfilled') setGoogle(g.value);
    if (f.status === 'fulfilled') setFcm(f.value);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const handleConnectGoogle = async () => {
    setBusy('google-connect');
    setGoogleFeedback(null);
    try {
      const { authorizeUrl } = await api.getGoogleAuthorizeUrl();
      window.open(authorizeUrl, '_blank');
      setGoogleFeedback({
        type: 'info',
        text: 'Selesaikan persetujuan di tab/browser Google, lalu kembali ke sini — status akan diperbarui otomatis.',
      });
    } catch (err: any) {
      setGoogleFeedback({
        type: 'error',
        text: err?.message || 'Gagal memulai koneksi Google.',
      });
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!window.confirm('Putuskan koneksi Google? M.A.Y.A. tidak bisa lagi membaca Gmail/Calendar.')) {
      return;
    }
    setBusy('google-disconnect');
    setGoogleFeedback(null);
    try {
      await api.disconnectGoogle();
      setGoogleFeedback({ type: 'success', text: 'Koneksi Google diputus.' });
      await refresh();
    } catch (err: any) {
      setGoogleFeedback({ type: 'error', text: err?.message || 'Gagal memutus koneksi.' });
    } finally {
      setBusy(null);
    }
  };

  const handleRegisterPush = async () => {
    setBusy('fcm-register');
    setFcmFeedback(null);
    try {
      const res = await registerDeviceForPush(true);
      if (res.ok) {
        setFcmFeedback({
          type: 'success',
          text:
            res.notificationsGranted === false
              ? 'HP terdaftar, tetapi izin notifikasi Android belum diberikan — aktifkan di Pengaturan app.'
              : 'HP ini berhasil didaftarkan untuk Push Notification.',
        });
      } else if (res.reason === 'firebase_not_configured') {
        setFcmFeedback({
          type: 'info',
          text: 'APK ini dibuild tanpa google-services.json, jadi Firebase belum aktif. Pasang file itu lalu build ulang APK.',
        });
      } else {
        setFcmFeedback({ type: 'error', text: `Gagal mendaftar push: ${res.reason ?? 'unknown'}` });
      }
      await refresh();
    } catch (err: any) {
      setFcmFeedback({ type: 'error', text: err?.message || 'Gagal mendaftarkan HP.' });
    } finally {
      setBusy(null);
    }
  };

  const handleTestPush = async () => {
    setBusy('fcm-test');
    setFcmFeedback(null);
    try {
      const res = await api.sendFcmTest();
      setFcmFeedback({ type: res.sent ? 'success' : 'info', text: res.message });
    } catch (err: any) {
      setFcmFeedback({ type: 'error', text: err?.message || 'Gagal mengirim notifikasi uji.' });
    } finally {
      setBusy(null);
    }
  };

  const googleConnected = !!google?.connected;
  const googleConfigured = !!google?.configured;
  const fcmConfigured = !!fcm?.configured;

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#17191F] p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Plug className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Integrasi</h3>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          aria-label="Segarkan status integrasi"
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 p-3.5 space-y-3 flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start space-x-2.5">
                <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-indigo-600 dark:text-indigo-400">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 flex items-center space-x-1.5">
                    <span>Google Gmail &amp; Calendar</span>
                    <CalendarDays className="h-3 w-3 text-zinc-400" />
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Baca jadwal &amp; email, kirim email (dengan konfirmasi biometrik), dan Morning Briefing.
                  </p>
                </div>
              </div>
              <StatusBadge
                ok={googleConnected}
                okText="Terhubung"
                offText={googleConfigured ? 'Belum terhubung' : 'Belum dikonfigurasi'}
              />
            </div>

            {!googleConfigured && google && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400/90">
                Server belum memiliki <span className="font-mono">Google__ClientId</span> /{' '}
                <span className="font-mono">Google__ClientSecret</span>.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {!googleConnected && (
                <button
                  type="button"
                  onClick={() => void handleConnectGoogle()}
                  disabled={!googleConfigured || busy !== null}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-medium disabled:opacity-40 transition-colors cursor-pointer"
                >
                  {busy === 'google-connect' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5" />
                  )}
                  <span>Hubungkan Google</span>
                </button>
              )}
              {googleConnected && (
                <button
                  type="button"
                  onClick={() => void handleDisconnectGoogle()}
                  disabled={busy !== null}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-red-900/50 bg-rose-50 dark:bg-red-950/30 hover:bg-rose-100 dark:hover:bg-red-950/60 text-rose-700 dark:text-red-300 text-xs font-medium disabled:opacity-40 transition-colors cursor-pointer"
                >
                  {busy === 'google-disconnect' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Unlink className="h-3.5 w-3.5" />
                  )}
                  <span>Putuskan</span>
                </button>
              )}
            </div>

            {googleFeedback && (
              <p className={`text-[11px] px-2.5 py-1.5 rounded-lg border ${feedbackClass[googleFeedback.type]}`}>
                {googleFeedback.text}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 p-3.5 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start space-x-2.5">
                <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-indigo-600 dark:text-indigo-400">
                  <BellRing className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                    Push Notification (Firebase)
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Morning Briefing, check-in, dan <em>Find My Phone</em> tetap berbunyi meski app tertutup.
                  </p>
                </div>
              </div>
              <StatusBadge ok={fcmConfigured} okText="Server siap" offText="Belum dikonfigurasi" />
            </div>

            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center space-x-1.5">
              <Smartphone className="h-3 w-3" />
              <span>{fcm ? `${fcm.registeredDevices} HP terdaftar` : 'Memuat status...'}</span>
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {nativeMobile && (
                <button
                  type="button"
                  onClick={() => void handleRegisterPush()}
                  disabled={busy !== null}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-100 text-xs font-medium disabled:opacity-40 transition-colors cursor-pointer"
                >
                  {busy === 'fcm-register' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Smartphone className="h-3.5 w-3.5" />
                  )}
                  <span>Daftarkan HP ini</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleTestPush()}
                disabled={busy !== null}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-medium disabled:opacity-40 transition-colors cursor-pointer"
              >
                {busy === 'fcm-test' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>Tes Push Notification</span>
              </button>
            </div>

            {fcmFeedback && (
              <p className={`text-[11px] px-2.5 py-1.5 rounded-lg border ${feedbackClass[fcmFeedback.type]}`}>
                {fcmFeedback.text}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
