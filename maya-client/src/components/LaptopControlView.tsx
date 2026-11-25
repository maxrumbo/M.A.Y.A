import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Laptop,
  Code2,
  Globe,
  Terminal,
  FileText,
  Music,
  Folder,
  Lock,
  Moon,
  RotateCcw,
  Power,
  Volume2,
  VolumeX,
  Volume1,
  Play,
  Loader2,
  Radio,
  Square,
  Ear,
  BatteryCharging,
  ShieldCheck,
  Smartphone,
  Shield,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { api } from '../api/client';
import { signalRService } from '../services/signalr';
import { IntegrationsPanel } from './IntegrationsPanel';
import { CircularGauge } from './ui/CircularGauge';
import {
  isNativeMobile,
  getKeepAliveStatus,
  startKeepAliveService,
  stopKeepAliveService,
  openBatteryOptimizationSettings,
  onKeepAliveStateChanged,
  type KeepAliveStatus,
} from '../services/mobileNative';
import type { DeviceStatus, AgentSettings, WakeWordStatus, MobileStatus } from '../types';

interface LaptopControlViewProps {
  deviceStatus: DeviceStatus | null;
  onActionTriggered: () => void;
}

export const LaptopControlView: React.FC<LaptopControlViewProps> = ({
  deviceStatus,
  onActionTriggered,
}) => {
  const [executing, setExecuting] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [findMeActive, setFindMeActive] = useState<boolean>(false);
  const [findMeFeedback, setFindMeFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [wakeSettings, setWakeSettings] = useState<AgentSettings>({
    wakeWordEnabled: false,
    batterySaverEnabled: true,
    batteryThresholdPercent: 20,
  });
  const [wakeStatus, setWakeStatus] = useState<WakeWordStatus>({
    state: 'Disabled',
    engine: 'WindowsSpeech',
    reason: 'Dimatikan oleh pengguna (opt-in).',
    updatedAt: new Date().toISOString(),
  });
  const [savingWake, setSavingWake] = useState<boolean>(false);
  const [mobileStatus, setMobileStatus] = useState<MobileStatus>({
    onlineDevices: 0,
    isFindMeActive: false,
  });
  const [phoneFeedback, setPhoneFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [keepAlive, setKeepAlive] = useState<KeepAliveStatus | null>(null);
  const [keepAliveBatterySaver, setKeepAliveBatterySaver] = useState<boolean>(true);
  const [togglingKeepAlive, setTogglingKeepAlive] = useState<boolean>(false);

  const findMeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOnline = deviceStatus?.isOnline ?? false;
  const isPhoneOnline = mobileStatus.onlineDevices > 0;
  const nativeMobile = isNativeMobile();

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setActionFeedback({ type, text });
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      setActionFeedback(null);
    }, 4500);
  };

  useEffect(() => {
    api
      .getWakeWordState()
      .then((res) => {
        setWakeSettings(res.settings);
        setWakeStatus(res.status);
        setFindMeActive(res.isFindMeActive);
      })
      .catch(() => {});

    api
      .getMobileStatus()
      .then(setMobileStatus)
      .catch(() => {});

    const unsubMobileStatus = signalRService.onMobileStatusChange(setMobileStatus);

    let unsubKeepAlive: (() => void) | null = null;
    if (isNativeMobile()) {
      void getKeepAliveStatus().then((st) => {
        if (st) {
          setKeepAlive(st);
          setKeepAliveBatterySaver(st.batterySaverEnabled);
        }
      });
      void onKeepAliveStateChanged((ev) => {
        setKeepAlive((prev) =>
          prev
            ? { ...prev, running: ev.running, reason: ev.reason }
            : {
                running: ev.running,
                batterySaverEnabled: true,
                reason: ev.reason,
                batteryPercent: 100,
                isCharging: false,
                ignoringBatteryOptimizations: false,
              }
        );
      }).then((fn) => {
        unsubKeepAlive = fn;
      });
    }

    const unsubWakeStatus = signalRService.onWakeWordStatus((status) => {
      setWakeStatus((prev) => ({
        ...prev,
        ...status,
        lastHeardPhrase: status.lastHeardPhrase ?? prev.lastHeardPhrase,
        lastHeardAt: status.lastHeardAt ?? prev.lastHeardAt,
      }));
    });

    const unsubWakeHeard = signalRService.onWakeWordHeard((ev) => {
      setWakeStatus((prev) => ({
        ...prev,
        lastHeardPhrase: ev.phrase,
        lastHeardAt: ev.timestamp,
      }));
    });

    return () => {
      unsubWakeStatus();
      unsubWakeHeard();
      unsubMobileStatus();
      unsubKeepAlive?.();
      if (findMeTimerRef.current) clearTimeout(findMeTimerRef.current);
      if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const handleToggleKeepAlive = async (enable: boolean, batterySaverOverride?: boolean) => {
    const saver = batterySaverOverride ?? keepAliveBatterySaver;
    setTogglingKeepAlive(true);
    try {
      if (enable) {
        await startKeepAliveService(saver, 20);
      } else {
        await stopKeepAliveService();
      }
      const fresh = await getKeepAliveStatus();
      if (fresh) setKeepAlive(fresh);
    } catch (err: any) {
      setPhoneFeedback({
        type: 'error',
        text: err?.message || 'Gagal mengubah Mode Stand-By.',
      });
    } finally {
      setTogglingKeepAlive(false);
    }
  };

  const handleFindMyPhone = async () => {
    if (!isPhoneOnline) {
      setPhoneFeedback({
        type: 'error',
        text: 'HP belum terhubung. Buka aplikasi M.A.Y.A. di HP terlebih dahulu.',
      });
      return;
    }

    setExecuting('Find My Phone');
    setPhoneFeedback(null);
    try {
      const res = await api.findMyPhone(10);
      setMobileStatus((prev) => ({ ...prev, isFindMeActive: true }));
      setPhoneFeedback({
        type: 'success',
        text: res.message || 'Ping Find-Me terkirim ke HP.',
      });

      if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current);
      phoneTimerRef.current = setTimeout(() => {
        setMobileStatus((prev) => ({ ...prev, isFindMeActive: false }));
      }, 10500);
    } catch (err: any) {
      setPhoneFeedback({
        type: 'error',
        text: err.message || 'Gagal mengirim ping ke HP.',
      });
    } finally {
      setExecuting(null);
    }
  };

  const handleStopFindMyPhone = async () => {
    setExecuting('Stop Find My Phone');
    try {
      const status = await api.stopFindMyPhone();
      setMobileStatus(status);
      if (phoneTimerRef.current) {
        clearTimeout(phoneTimerRef.current);
        phoneTimerRef.current = null;
      }
      setPhoneFeedback({
        type: 'info',
        text: 'Perintah hentikan alarm dikirim ke HP.',
      });
    } catch (err: any) {
      setPhoneFeedback({
        type: 'error',
        text: err.message || 'Gagal menghentikan alarm HP.',
      });
    } finally {
      setExecuting(null);
    }
  };

  const handleFindMyLaptop = async () => {
    if (!isOnline) {
      setFindMeFeedback({ type: 'error', text: 'Laptop sedang offline.' });
      return;
    }

    setExecuting('Find My Laptop');
    setFindMeFeedback(null);
    try {
      const res = await api.findMyLaptop(10);
      setFindMeActive(true);
      setFindMeFeedback({
        type: 'success',
        text: res.output || 'Laptop sedang berbunyi selama 10 detik.',
      });

      if (findMeTimerRef.current) clearTimeout(findMeTimerRef.current);
      findMeTimerRef.current = setTimeout(() => {
        setFindMeActive(false);
      }, 10500);
    } catch (err: any) {
      setFindMeFeedback({
        type: 'error',
        text: err.message || 'Gagal membunyikan laptop.',
      });
    } finally {
      setExecuting(null);
    }
  };

  const handleStopFindMe = async () => {
    setExecuting('Stop Find-Me');
    try {
      const res = await api.stopFindMe();
      setFindMeActive(false);
      if (findMeTimerRef.current) {
        clearTimeout(findMeTimerRef.current);
        findMeTimerRef.current = null;
      }
      setFindMeFeedback({
        type: 'info',
        text: res.output || 'Alarm Find-Me dihentikan.',
      });
    } catch (err: any) {
      setFindMeFeedback({
        type: 'error',
        text: err.message || 'Gagal menghentikan alarm.',
      });
    } finally {
      setExecuting(null);
    }
  };

  const handleUpdateWakeSettings = async (patch: Partial<AgentSettings>) => {
    const next: AgentSettings = { ...wakeSettings, ...patch };
    setWakeSettings(next);
    setSavingWake(true);
    try {
      const res = await api.updateWakeWordSettings(next);
      setWakeSettings(res.settings);
      setWakeStatus(res.status);
    } catch (err: any) {
      setFindMeFeedback({
        type: 'error',
        text: `Gagal menyimpan pengaturan wake-word: ${err.message}`,
      });
    } finally {
      setSavingWake(false);
    }
  };

  const getWakeStatusBadge = () => {
    switch (wakeStatus.state) {
      case 'Active':
        return {
          label: 'Aktif',
          cls: 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/80',
        };
      case 'PausedBattery':
        return {
          label: 'Dijeda (Baterai)',
          cls: 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/80',
        };
      case 'Unsupported':
        return {
          label: 'Tidak Didukung',
          cls: 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/80',
        };
      default:
        return {
          label: 'Nonaktif',
          cls: 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800',
        };
    }
  };

  const wakeBadge = getWakeStatusBadge();

  const triggerApp = async (appName: string, label: string) => {
    if (!isOnline) {
      showToast('error', 'Laptop Maxwell sedang offline.');
      return;
    }

    setExecuting(label);
    try {
      await api.sendMessage(`Maya, buka aplikasi ${appName}`);
      showToast('success', `Permintaan membuka ${label} telah dikirim ke laptop.`);
    } catch (err: any) {
      showToast('error', `Gagal membuka ${label}: ${err.message}`);
    } finally {
      setExecuting(null);
    }
  };

  const triggerMedia = async (action: string, label: string) => {
    if (!isOnline) {
      showToast('error', 'Laptop Maxwell sedang offline.');
      return;
    }

    setExecuting(label);
    try {
      await api.sendMessage(`Maya, kontrol media: ${action}`);
      showToast('success', `Kontrol media '${label}' berhasil dikirim.`);
    } catch (err: any) {
      showToast('error', `Gagal mengirim kontrol media: ${err.message}`);
    } finally {
      setExecuting(null);
    }
  };

  const triggerPower = async (action: string, label: string) => {
    if (!isOnline) {
      showToast('error', 'Laptop Maxwell sedang offline.');
      return;
    }

    if (action !== 'lock_screen') {
      if (!confirm(`Aksi '${label}' berisiko tinggi. Lanjutkan ke Obrolan untuk konfirmasi?`)) {
        return;
      }
    }

    setExecuting(label);
    try {
      await api.sendMessage(`Maya, lakukan kontrol daya: ${action}`);
      showToast('info', `Permintaan '${label}' dikirim ke Obrolan.`);
      if (action !== 'lock_screen') {
        onActionTriggered();
      }
    } catch (err: any) {
      showToast('error', `Gagal: ${err.message}`);
    } finally {
      setExecuting(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8F9FA] dark:bg-[#0F1014] overflow-hidden transition-colors">
      {/* Clean Header */}
      <header className="h-12 sm:h-14 border-b border-zinc-200/80 dark:border-zinc-800/80 px-4 sm:px-6 flex items-center justify-between shrink-0 bg-white/80 dark:bg-[#14151A]/90 backdrop-blur-md">
        <div className="flex items-center space-x-2.5">
          <LayoutDashboard className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
          <h2 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Dashboard</h2>
        </div>

        <span
          className={`text-[11px] font-mono ${
            isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'
          }`}
        >
          {isOnline ? 'Laptop Online' : 'Laptop Offline'}
        </span>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 max-w-4xl mx-auto w-full">
        {actionFeedback && (
          <div
            className={`px-4 py-3 rounded-2xl border text-xs flex items-center space-x-2.5 ${
              actionFeedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-300'
                : actionFeedback.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-300'
                : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            {actionFeedback.type === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            )}
            <span className="font-medium">{actionFeedback.text}</span>
          </div>
        )}

        {/* Section 1: 3 Solid Circular Telemetry Rings */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Telemetri Perangkat
            </h3>
            {executing && (
              <span className="inline-flex items-center space-x-1.5 text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{executing}...</span>
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <CircularGauge
              label="CPU"
              value={deviceStatus?.cpuUsagePercent}
              strokeColor="stroke-zinc-900 dark:stroke-zinc-100"
              subtitle={isOnline ? 'Prosesor' : 'Offline'}
              offline={!isOnline}
            />
            <CircularGauge
              label="RAM"
              value={deviceStatus?.ramUsagePercent}
              strokeColor="stroke-indigo-600 dark:stroke-indigo-400"
              subtitle={isOnline ? 'Memori' : 'Offline'}
              offline={!isOnline}
            />
            <CircularGauge
              label="Baterai"
              value={deviceStatus?.batteryPercent}
              strokeColor={
                (deviceStatus?.batteryPercent ?? 100) > 20
                  ? 'stroke-emerald-600 dark:stroke-emerald-500'
                  : 'stroke-rose-600 dark:stroke-rose-500'
              }
              subtitle={isOnline ? 'Daya PC' : 'Offline'}
              offline={!isOnline}
            />
          </div>
        </div>

        {/* Section 2: Compact Kontrol Cepat Card */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#17191F] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Kontrol Cepat
            </h3>
            <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
              {isPhoneOnline ? `${mobileStatus.onlineDevices} HP terhubung` : 'HP offline'}
            </span>
          </div>

          {/* 4-Button Media Icon Row */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'play_pause', name: 'Play / Pause', icon: Play },
              { id: 'volume_down', name: 'Vol -', icon: Volume1 },
              { id: 'volume_up', name: 'Vol +', icon: Volume2 },
              { id: 'mute', name: 'Mute', icon: VolumeX },
            ].map((med) => (
              <button
                key={med.id}
                type="button"
                onClick={() => void triggerMedia(med.id, med.name)}
                disabled={!isOnline || !!executing}
                className="flex flex-col items-center justify-center py-2.5 px-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/70 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 transition-colors disabled:opacity-40 cursor-pointer"
              >
                <med.icon className="h-4 w-4 mb-1" />
                <span className="text-[10px] font-medium truncate max-w-full">{med.name}</span>
              </button>
            ))}
          </div>

          {/* 2 Clean Find-Device Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => void handleFindMyLaptop()}
                disabled={!isOnline || !!executing}
                className="flex-1 flex items-center justify-center space-x-2 px-3.5 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-medium transition-colors disabled:opacity-40 cursor-pointer"
              >
                <Radio className={`h-3.5 w-3.5 ${findMeActive ? 'animate-ping' : ''}`} />
                <span>{findMeActive ? 'Laptop Berbunyi...' : 'Find Laptop'}</span>
              </button>
              {findMeActive && (
                <button
                  type="button"
                  onClick={() => void handleStopFindMe()}
                  disabled={!isOnline || !!executing}
                  className="px-3 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-medium cursor-pointer"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => void handleFindMyPhone()}
                disabled={!isPhoneOnline || !!executing}
                className="flex-1 flex items-center justify-center space-x-2 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-medium transition-colors disabled:opacity-40 cursor-pointer"
              >
                <Smartphone
                  className={`h-3.5 w-3.5 ${mobileStatus.isFindMeActive ? 'animate-bounce' : ''}`}
                />
                <span>{mobileStatus.isFindMeActive ? 'Ping Terkirim...' : 'Find Phone'}</span>
              </button>
              {mobileStatus.isFindMeActive && (
                <button
                  type="button"
                  onClick={() => void handleStopFindMyPhone()}
                  disabled={!!executing}
                  className="px-3 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-medium cursor-pointer"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </button>
              )}
            </div>
          </div>

          {(findMeFeedback || phoneFeedback) && (
            <div className="text-[11px] text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2">
              {findMeFeedback?.text || phoneFeedback?.text}
            </div>
          )}
        </div>

        {/* Section 3: Integrations */}
        <IntegrationsPanel />

        {/* Section 4: Collapsible Kontrol Lanjutan (Collapsed by Default) */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#17191F] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors cursor-pointer"
          >
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Kontrol Lanjutan
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Wake-Word, Mode Stand-By, Peluncur Aplikasi, dan Kontrol Daya
              </p>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${
                showAdvanced ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showAdvanced && (
            <div className="p-4 pt-2 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-5">
              {/* Wake-Word & Stand-By */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Ear className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        Wake-Word Listener
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full border text-[10px] font-mono ${wakeBadge.cls}`}
                    >
                      {wakeBadge.label}
                    </span>
                  </div>

                  <label className="flex items-center justify-between text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <span className="flex items-center space-x-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-zinc-400" />
                      <span>Aktifkan &ldquo;Hey Maya&rdquo;</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={wakeSettings.wakeWordEnabled}
                      disabled={savingWake}
                      onChange={(e) =>
                        void handleUpdateWakeSettings({ wakeWordEnabled: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <span className="flex items-center space-x-1.5">
                      <BatteryCharging className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Hemat Baterai (&lt;{wakeSettings.batteryThresholdPercent}%)</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={wakeSettings.batterySaverEnabled}
                      disabled={savingWake}
                      onChange={(e) =>
                        void handleUpdateWakeSettings({ batterySaverEnabled: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                  </label>
                </div>

                {nativeMobile && (
                  <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Shield className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          Mode Stand-By Layar Mati
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {keepAlive?.running ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>

                    <label className="flex items-center justify-between text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                      <span>Aktifkan Mode Stand-By</span>
                      <input
                        type="checkbox"
                        checked={keepAlive?.running ?? false}
                        disabled={togglingKeepAlive}
                        onChange={(e) => void handleToggleKeepAlive(e.target.checked)}
                        className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                      <span>Auto-stop &lt; 20%</span>
                      <input
                        type="checkbox"
                        checked={keepAliveBatterySaver}
                        disabled={togglingKeepAlive}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setKeepAliveBatterySaver(checked);
                          if (keepAlive?.running) {
                            void handleToggleKeepAlive(true, checked);
                          }
                        }}
                        className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => void openBatteryOptimizationSettings()}
                      className="inline-flex items-center space-x-1.5 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>Atur Optimasi Baterai OS</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Allowlist Apps */}
              <div>
                <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                  Aplikasi Laptop
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'vscode', name: 'VS Code', icon: Code2 },
                    { id: 'antigravity', name: 'Antigravity', icon: Laptop },
                    { id: 'brave', name: 'Brave', icon: Globe },
                    { id: 'chrome', name: 'Chrome', icon: Globe },
                    { id: 'terminal', name: 'Terminal', icon: Terminal },
                    { id: 'notepad', name: 'Notepad', icon: FileText },
                    { id: 'spotify', name: 'Spotify', icon: Music },
                    { id: 'explorer', name: 'Explorer', icon: Folder },
                  ].map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => void triggerApp(app.id, app.name)}
                      disabled={!isOnline || !!executing}
                      className="flex items-center space-x-2.5 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left disabled:opacity-40 cursor-pointer"
                    >
                      <app.icon className="h-4 w-4 text-zinc-600 dark:text-zinc-400 shrink-0" />
                      <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
                        {app.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Power Controls */}
              <div>
                <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                  Kontrol Daya Laptop (Step-Up)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <button
                    type="button"
                    onClick={() => void triggerPower('lock_screen', 'Lock Workstation')}
                    disabled={!isOnline || !!executing}
                    className="flex items-center space-x-2 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 disabled:opacity-40 cursor-pointer"
                  >
                    <Lock className="h-4 w-4 text-zinc-500" />
                    <span>Kunci Layar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void triggerPower('sleep', 'Sleep Mode')}
                    disabled={!isOnline || !!executing}
                    className="flex items-center space-x-2 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 disabled:opacity-40 cursor-pointer"
                  >
                    <Moon className="h-4 w-4 text-indigo-500" />
                    <span>Sleep</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void triggerPower('restart', 'Restart Laptop')}
                    disabled={!isOnline || !!executing}
                    className="flex items-center space-x-2 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20 text-xs font-medium text-amber-800 dark:text-amber-300 disabled:opacity-40 cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Restart</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void triggerPower('shutdown', 'Shutdown Laptop')}
                    disabled={!isOnline || !!executing}
                    className="flex items-center space-x-2 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-950/20 text-xs font-medium text-rose-700 dark:text-rose-300 disabled:opacity-40 cursor-pointer"
                  >
                    <Power className="h-4 w-4" />
                    <span>Shutdown</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
