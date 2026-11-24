import { api } from '../api/client';
import {
  isNativeMobile,
  getFcmToken,
  requestPushPermission,
  getOrCreateMobileDeviceId,
} from './mobileNative';

const LAST_TOKEN_KEY = 'maya_fcm_last_registered';
const PERMISSION_ASKED_KEY = 'maya_push_permission_asked';
const REREGISTER_AFTER_MS = 6 * 60 * 60 * 1000; // 6 jam

export interface PushRegistrationResult {
  ok: boolean;
  reason?: string;
  notificationsGranted?: boolean;
}

/**
 * Phase 8: Mendaftarkan HP ke server untuk Push Notification (FCM).
 * - Hanya aktif di APK native; di web langsung return.
 * - Jika google-services.json belum dipasang saat build APK → { ok:false, reason:'firebase_not_configured' }
 *   tanpa error (aplikasi tetap normal).
 * - `force` mengabaikan dedupe 6 jam dan selalu meminta izin notifikasi bila belum diberikan.
 */
export async function registerDeviceForPush(force = false): Promise<PushRegistrationResult> {
  if (!isNativeMobile()) return { ok: false, reason: 'web' };

  let askedBefore = false;
  try {
    askedBefore = localStorage.getItem(PERMISSION_ASKED_KEY) === '1';
  } catch {
    // ignore
  }

  // Minta izin notifikasi sekali otomatis (Android 13+), atau setiap kali jika dipicu manual.
  if (force || !askedBefore) {
    await requestPushPermission();
    try {
      localStorage.setItem(PERMISSION_ASKED_KEY, '1');
    } catch {
      // ignore
    }
  }

  const result = await getFcmToken();
  if (!result.available || !result.token) {
    return {
      ok: false,
      reason: result.reason || 'token_unavailable',
      notificationsGranted: result.notificationsGranted,
    };
  }

  const deviceId = getOrCreateMobileDeviceId();
  const fingerprint = `${deviceId}|${result.token}`;

  if (!force) {
    try {
      const raw = localStorage.getItem(LAST_TOKEN_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { fp: string; at: number };
        if (saved.fp === fingerprint && Date.now() - saved.at < REREGISTER_AFTER_MS) {
          return { ok: true, notificationsGranted: result.notificationsGranted };
        }
      }
    } catch {
      // ignore
    }
  }

  await api.registerFcmToken(deviceId, result.token);

  try {
    localStorage.setItem(LAST_TOKEN_KEY, JSON.stringify({ fp: fingerprint, at: Date.now() }));
  } catch {
    // ignore
  }

  return { ok: true, notificationsGranted: result.notificationsGranted };
}
