import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface BiometricAvailability {
  available: boolean;
  hasSavedPin: boolean;
  status: string;
}

export interface BiometricAuthResult {
  authenticated: boolean;
  pin?: string;
}

export interface KeepAliveStatus {
  running: boolean;
  batterySaverEnabled: boolean;
  reason: string;
  batteryPercent: number;
  isCharging: boolean;
  ignoringBatteryOptimizations: boolean;
}

export interface FcmTokenResult {
  available: boolean;
  token?: string;
  notificationsGranted: boolean;
  reason?: string;
}

interface MayaNativePluginInterface {
  startFindMe(options: { durationSeconds: number; message?: string }): Promise<{
    started: boolean;
    durationSeconds: number;
  }>;
  stopFindMe(): Promise<{ stopped: boolean }>;

  // Phase 8: Firebase Cloud Messaging
  getFcmToken(): Promise<FcmTokenResult>;
  requestPushPermission(): Promise<{ granted: boolean }>;

  // Phase 7B: Biometric + Android Keystore
  checkBiometricAvailability(): Promise<BiometricAvailability>;
  saveBiometricPin(options: { pin: string }): Promise<{ saved: boolean }>;
  clearBiometricPin(): Promise<{ cleared: boolean }>;
  authenticateBiometric(options?: {
    title?: string;
    subtitle?: string;
    negativeText?: string;
  }): Promise<BiometricAuthResult>;

  // Phase 7B: Keep-Alive Foreground Service & Battery Optimization
  getKeepAliveStatus(): Promise<KeepAliveStatus>;
  startKeepAliveService(options?: {
    batterySaverEnabled?: boolean;
    batteryThreshold?: number;
  }): Promise<{ started: boolean; running: boolean }>;
  stopKeepAliveService(): Promise<{ stopped: boolean; running: boolean }>;
  openBatteryOptimizationSettings(): Promise<{ opened: boolean }>;

  addListener(
    eventName: 'findMeStopped',
    listenerFunc: () => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'keepAliveStateChanged',
    listenerFunc: (data: { running: boolean; reason: string }) => void
  ): Promise<PluginListenerHandle>;
}

const MayaNative = registerPlugin<MayaNativePluginInterface>('MayaNative');
const MOBILE_DEVICE_ID_KEY = 'maya_mobile_device_id';

export function isNativeMobile(): boolean {
  return Capacitor.isNativePlatform();
}

export function getOrCreateMobileDeviceId(): string {
  try {
    const existing = localStorage.getItem(MOBILE_DEVICE_ID_KEY);
    if (existing && existing.trim()) {
      return existing.trim();
    }
    const suffix = Math.random().toString(36).slice(2, 8);
    const id = `maxwell-phone-${suffix}`;
    localStorage.setItem(MOBILE_DEVICE_ID_KEY, id);
    return id;
  } catch {
    return 'maxwell-phone';
  }
}

export async function startNativeFindMe(
  durationSeconds = 10,
  message?: string | null
): Promise<void> {
  if (!isNativeMobile()) return;
  await MayaNative.startFindMe({
    durationSeconds,
    message: message || 'Aku di sini, Max!',
  });
}

export async function stopNativeFindMe(): Promise<void> {
  if (!isNativeMobile()) return;
  await MayaNative.stopFindMe();
}

export async function onNativeFindMeStopped(
  callback: () => void
): Promise<() => void> {
  if (!isNativeMobile()) return () => {};
  const handle = await MayaNative.addListener('findMeStopped', callback);
  return () => {
    void handle.remove();
  };
}

// ─── Phase 8: Firebase Cloud Messaging Helpers ───────────────────────────────

export async function requestPushPermission(): Promise<boolean> {
  if (!isNativeMobile()) return false;
  try {
    const res = await MayaNative.requestPushPermission();
    return !!res.granted;
  } catch {
    return false;
  }
}

export async function getFcmToken(): Promise<FcmTokenResult> {
  if (!isNativeMobile()) {
    return { available: false, notificationsGranted: false, reason: 'web' };
  }
  try {
    return await MayaNative.getFcmToken();
  } catch (err: any) {
    return {
      available: false,
      notificationsGranted: false,
      reason: err?.message || 'error',
    };
  }
}

// ─── Phase 7B: Biometric Auth Helpers ────────────────────────────────────────

export async function checkBiometricAvailability(): Promise<BiometricAvailability> {
  if (!isNativeMobile()) {
    return { available: false, hasSavedPin: false, status: 'web' };
  }
  try {
    return await MayaNative.checkBiometricAvailability();
  } catch {
    return { available: false, hasSavedPin: false, status: 'error' };
  }
}

export async function saveBiometricPin(pin: string): Promise<void> {
  if (!isNativeMobile()) return;
  await MayaNative.saveBiometricPin({ pin });
}

export async function clearBiometricPin(): Promise<void> {
  if (!isNativeMobile()) return;
  await MayaNative.clearBiometricPin();
}

export async function authenticateBiometric(
  title = 'Verifikasi M.A.Y.A.',
  subtitle = 'Gunakan Sidik Jari atau Face Unlock'
): Promise<BiometricAuthResult> {
  if (!isNativeMobile()) {
    throw new Error('Biometrik native hanya tersedia di aplikasi Android.');
  }
  return await MayaNative.authenticateBiometric({
    title,
    subtitle,
    negativeText: 'Gunakan PIN',
  });
}

// ─── Phase 7B: Keep-Alive Foreground Service Helpers ─────────────────────────

export async function getKeepAliveStatus(): Promise<KeepAliveStatus | null> {
  if (!isNativeMobile()) return null;
  try {
    return await MayaNative.getKeepAliveStatus();
  } catch {
    return null;
  }
}

export async function startKeepAliveService(
  batterySaverEnabled = true,
  batteryThreshold = 20
): Promise<void> {
  if (!isNativeMobile()) return;
  await MayaNative.startKeepAliveService({ batterySaverEnabled, batteryThreshold });
}

export async function stopKeepAliveService(): Promise<void> {
  if (!isNativeMobile()) return;
  await MayaNative.stopKeepAliveService();
}

export async function openBatteryOptimizationSettings(): Promise<void> {
  if (!isNativeMobile()) return;
  await MayaNative.openBatteryOptimizationSettings();
}

export async function onKeepAliveStateChanged(
  callback: (data: { running: boolean; reason: string }) => void
): Promise<() => void> {
  if (!isNativeMobile()) return () => {};
  const handle = await MayaNative.addListener('keepAliveStateChanged', callback);
  return () => {
    void handle.remove();
  };
}
