import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

interface MayaNativePluginInterface {
  startFindMe(options: { durationSeconds: number; message?: string }): Promise<{
    started: boolean;
    durationSeconds: number;
  }>;
  stopFindMe(): Promise<{ stopped: boolean }>;
  addListener(
    eventName: 'findMeStopped',
    listenerFunc: () => void
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
