import React, { useState, useEffect, useRef } from 'react';
import {
  Sliders,
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
} from 'lucide-react';
import { api } from '../api/client';
import { signalRService } from '../services/signalr';
import { IntegrationsPanel } from './IntegrationsPanel';
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
}) => {
  const [executing, setExecuting] = useState<string | null>(null);
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
  const isOnline = deviceStatus?.isOnline ?? false;
  const isPhoneOnline = mobileStatus.onlineDevices > 0;
  const nativeMobile = isNativeMobile();

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
      if (findMeTimerRef.current) {
        clearTimeout(findMeTimerRef.current);
      }
      if (phoneTimerRef.current) {
        clearTimeout(phoneTimerRef.current);
      }
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
          cls: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80',
          dot: 'bg-emerald-400 animate-pulse',
        };
      case 'PausedBattery':
        return {
          label: 'Dijeda (Baterai)',
          cls: 'bg-amber-950/80 text-amber-300 border-amber-800/80',
          dot: 'bg-amber-400',
        };
      case 'Unsupported':
        return {
          label: 'Tidak Didukung',
          cls: 'bg-red-950/80 text-red-400 border-red-800/80',
          dot: 'bg-red-400',
        };
      default:
        return {
          label: 'Nonaktif',
          cls: 'bg-zinc-900 text-zinc-400 border-zinc-800',
          dot: 'bg-zinc-500',
        };
    }
  };

  const formatShortTime = (iso?: string | null) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const wakeBadge = getWakeStatusBadge();

  const triggerApp = async (appName: string, label: string) => {
    if (!isOnline) {
      alert('Laptop Maxwell sedang offline.');
      return;
    }

    setExecuting(label);
    try {
      await api.sendMessage(`Maya, buka aplikasi ${appName}`);
      alert(`Permintaan membuka ${label} telah dikirim ke laptop.`);
    } catch (err: any) {
      alert(`Gagal: ${err.message}`);
    } finally {
      setExecuting(null);
    }
  };

  const triggerMedia = async (action: string, label: string) => {
    if (!isOnline) {
      alert('Laptop Maxwell sedang offline.');
      return;
    }

    setExecuting(label);
    try {
      await api.sendMessage(`Maya, kontrol media: ${action}`);
    } catch (err: any) {
      alert(`Gagal: ${err.message}`);
    } finally {
      setExecuting(null);
    }
  };

  const triggerPower = async (action: string, label: string) => {
    if (!isOnline) {
      alert('Laptop Maxwell sedang offline.');
      return;
    }

    if (action !== 'lock_screen') {
      if (!confirm(`Aksi '${label}' berisiko tinggi. Buka chat untuk melakukan konfirmasi Step-Up?`))
        return;
    }

    setExecuting(label);
    try {
      await api.sendMessage(`Maya, lakukan kontrol daya: ${action}`);
      alert(`Permintaan '${label}' dikirim ke chat untuk konfirmasi.`);
    } catch (err: any) {
      alert(`Gagal: ${err.message}`);
    } finally {
      setExecuting(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Header */}
      <header className="h-12 sm:h-14 border-b border-zinc-800/80 px-4 sm:px-6 flex items-center justify-between shrink-0 bg-zinc-950/80 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <Sliders className="h-5 w-5 text-indigo-400" />
          <h2 className="font-semibold text-sm text-zinc-100">Laptop Control Hub</h2>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
              isOnline
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-900'
                : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
            }`}
          >
            {isOnline ? 'Daemon Online' : 'Daemon Offline'}
          </span>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-5xl mx-auto w-full">
        {/* Phase 6B: Find-Me & On-Device Wake-Word */}
        <div>
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Mode &ldquo;Find-Me&rdquo; &amp; Wake-Word Listener
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Find My Laptop */}
            <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between space-x-3">
                <div className="flex items-start space-x-3">
                  <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-indigo-400 shrink-0">
                    <Radio className={`h-4 w-4 ${findMeActive ? 'animate-ping' : ''}`} />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-zinc-100">Find My Laptop</h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                      Bunyikan ping 3 nada &amp; suara &ldquo;Aku di sini, Max!&rdquo; selama 10 detik.
                      Otomatis unmute sementara lalu mengembalikan volume semula.
                    </p>
                  </div>
                </div>
              </div>

              {findMeFeedback && (
                <div
                  className={`px-3 py-2 rounded-xl border text-[11px] ${
                    findMeFeedback.type === 'success'
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                      : findMeFeedback.type === 'error'
                      ? 'bg-red-950/40 border-red-800/60 text-red-300'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                  }`}
                >
                  {findMeFeedback.text}
                </div>
              )}

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleFindMyLaptop}
                  disabled={!isOnline || !!executing}
                  title={!isOnline ? 'Laptop sedang offline' : 'Bunyikan alarm Find-Me di laptop'}
                  className="flex-1 flex items-center justify-center space-x-2 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Radio className="h-3.5 w-3.5" />
                  <span>{findMeActive ? 'Sedang Berbunyi...' : 'Find My Laptop (Ping)'}</span>
                </button>

                {findMeActive && (
                  <button
                    onClick={handleStopFindMe}
                    disabled={!isOnline || !!executing}
                    title="Hentikan alarm Find-Me sekarang"
                    className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-red-600/80 hover:bg-red-500 text-white text-xs font-medium transition-colors disabled:opacity-40"
                  >
                    <Square className="h-3.5 w-3.5 fill-white" />
                    <span>Stop</span>
                  </button>
                )}
              </div>
            </div>

            {/* Card 2: Wake-Word Listener & Battery Saver */}
            <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 flex flex-col justify-between space-y-3.5">
              <div className="flex items-start justify-between space-x-2">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-indigo-400">
                    <Ear className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-zinc-100">Wake-Word Listener</h4>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {wakeStatus.engine || 'WindowsSpeech'}
                    </span>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono shrink-0 ${wakeBadge.cls}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${wakeBadge.dot}`} />
                  <span>{wakeBadge.label}</span>
                </span>
              </div>

              {/* Toggles */}
              <div className="space-y-2.5">
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 cursor-pointer">
                  <div className="pr-3">
                    <div className="text-xs font-medium text-zinc-200">
                      Aktifkan Wake-Word (&ldquo;Hey Maya&rdquo;)
                    </div>
                    <div className="text-[10px] text-zinc-500 flex items-center space-x-1 mt-0.5">
                      <ShieldCheck className="h-3 w-3 text-zinc-500 shrink-0" />
                      <span>Diproses 100% lokal di Windows, tidak direkam ke server.</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={wakeSettings.wakeWordEnabled}
                    disabled={savingWake}
                    onChange={(e) =>
                      handleUpdateWakeSettings({ wakeWordEnabled: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-indigo-600 focus:ring-0 cursor-pointer shrink-0"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 cursor-pointer">
                  <div className="pr-3">
                    <div className="text-xs font-medium text-zinc-200 flex items-center space-x-1.5">
                      <BatteryCharging className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Mode Hemat Baterai</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      Auto-pause bila baterai &lt; {wakeSettings.batteryThresholdPercent}% &amp; tidak di-charge.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={wakeSettings.batterySaverEnabled}
                    disabled={savingWake}
                    onChange={(e) =>
                      handleUpdateWakeSettings({ batterySaverEnabled: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-indigo-600 focus:ring-0 cursor-pointer shrink-0"
                  />
                </label>
              </div>

              {/* Status Reason & Last Heard */}
              <div className="text-[11px] text-zinc-400 flex flex-col space-y-1 pt-1 border-t border-zinc-800/70">
                {wakeStatus.reason && wakeStatus.state !== 'Active' && (
                  <p className="text-zinc-500 truncate" title={wakeStatus.reason}>
                    {wakeStatus.reason}
                  </p>
                )}
                {wakeStatus.lastHeardPhrase && (
                  <p className="text-zinc-300 font-mono text-[10px]">
                    Terakhir terdengar: &ldquo;{wakeStatus.lastHeardPhrase}&rdquo;
                    {wakeStatus.lastHeardAt ? ` • ${formatShortTime(wakeStatus.lastHeardAt)}` : ''}
                  </p>
                )}
              </div>
            </div>

            {/* Card 3 (Phase 7): Find My Phone */}
            <div className="md:col-span-2 p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between space-x-3">
                <div className="flex items-start space-x-3">
                  <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-indigo-400 shrink-0">
                    <Smartphone
                      className={`h-4 w-4 ${mobileStatus.isFindMeActive ? 'animate-bounce' : ''}`}
                    />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-zinc-100">Find My Phone (HP Android)</h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                      Kirim ping alarm, getar, dan suara &ldquo;Aku di sini, Max!&rdquo; ke HP yang sedang membuka aplikasi M.A.Y.A.
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono shrink-0 ${
                    isPhoneOnline
                      ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80'
                      : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isPhoneOnline ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
                    }`}
                  />
                  <span>
                    {isPhoneOnline ? `${mobileStatus.onlineDevices} HP Online` : 'HP Offline'}
                  </span>
                </span>
              </div>

              {phoneFeedback && (
                <div
                  className={`px-3 py-2 rounded-xl border text-[11px] ${
                    phoneFeedback.type === 'success'
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                      : phoneFeedback.type === 'error'
                      ? 'bg-red-950/40 border-red-800/60 text-red-300'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                  }`}
                >
                  {phoneFeedback.text}
                </div>
              )}

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleFindMyPhone}
                  disabled={!isPhoneOnline || !!executing}
                  title={
                    !isPhoneOnline
                      ? 'HP belum terhubung. Buka aplikasi M.A.Y.A. di HP.'
                      : 'Bunyikan alarm Find My Phone di HP'
                  }
                  className="flex-1 flex items-center justify-center space-x-2 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  <span>
                    {mobileStatus.isFindMeActive ? 'Ping HP Terkirim...' : 'Find My Phone (Ping)'}
                  </span>
                </button>

                {mobileStatus.isFindMeActive && (
                  <button
                    onClick={handleStopFindMyPhone}
                    disabled={!!executing}
                    title="Hentikan alarm Find My Phone"
                    className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-red-600/80 hover:bg-red-500 text-white text-xs font-medium transition-colors disabled:opacity-40"
                  >
                    <Square className="h-3.5 w-3.5 fill-white" />
                    <span>Stop</span>
                  </button>
                )}
              </div>
            </div>

            {/* Card 5 (Phase 8): Integrasi Google OAuth & Push Notification FCM */}
        <IntegrationsPanel />

        {/* Card 4 (Phase 7B — Khusus APK Android): Mode Stand-By Layar Mati */}
            {nativeMobile && (
              <div className="md:col-span-2 p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between space-x-3">
                  <div className="flex items-start space-x-3">
                    <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-indigo-400 shrink-0">
                      <Shield className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-zinc-100">
                        Mode Stand-By Layar Mati (Android Foreground Service)
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                        Menjaga koneksi SignalR &amp; Find My Phone tetap aktif saat layar HP mati dengan notifikasi persisten ringan.
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono shrink-0 ${
                      keepAlive?.running
                        ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        keepAlive?.running ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
                      }`}
                    />
                    <span>{keepAlive?.running ? 'Aktif' : 'Nonaktif'}</span>
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 cursor-pointer">
                    <div className="pr-3">
                      <div className="text-xs font-medium text-zinc-200">
                        Aktifkan Mode Stand-By (Opt-in)
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        {keepAlive?.reason || 'Nonaktif (opt-in).'}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={keepAlive?.running ?? false}
                      disabled={togglingKeepAlive}
                      onChange={(e) => void handleToggleKeepAlive(e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-indigo-600 focus:ring-0 cursor-pointer shrink-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 cursor-pointer">
                    <div className="pr-3">
                      <div className="text-xs font-medium text-zinc-200 flex items-center space-x-1.5">
                        <BatteryCharging className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Hemat Baterai HP (Auto-stop &lt; 20%)</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        Baterai HP saat ini: {keepAlive?.batteryPercent ?? '—'}%
                        {keepAlive?.isCharging ? ' (Charging)' : ''}
                      </div>
                    </div>
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
                      className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-indigo-600 focus:ring-0 cursor-pointer shrink-0"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-zinc-800/70 gap-2">
                  <span className="text-[10px] text-zinc-500">
                    Optimasi Baterai:{' '}
                    <span
                      className={
                        keepAlive?.ignoringBatteryOptimizations
                          ? 'text-emerald-400 font-mono'
                          : 'text-amber-400 font-mono'
                      }
                    >
                      {keepAlive?.ignoringBatteryOptimizations ? 'Unrestricted' : 'Dibatasi OS'}
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={() => void openBatteryOptimizationSettings()}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-950 hover:bg-zinc-800 text-[11px] text-zinc-300 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3 text-indigo-400" />
                    <span>Atur Optimasi Baterai</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 1: Allowlist Workspace Apps */}
        <div>
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Aplikasi Kerja & Ngoding (Allowlist)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: 'vscode', name: 'VS Code', icon: Code2, desc: 'Editor utama' },
              { id: 'antigravity', name: 'Antigravity', icon: Laptop, desc: 'AI Coding Environment' },
              { id: 'brave', name: 'Brave Browser', icon: Globe, desc: 'Web Browser' },
              { id: 'chrome', name: 'Google Chrome', icon: Globe, desc: 'Web Browser' },
              { id: 'terminal', name: 'Terminal / PowerShell', icon: Terminal, desc: 'Windows Terminal' },
              { id: 'notepad', name: 'Notepad', icon: FileText, desc: 'Quick Notes' },
              { id: 'spotify', name: 'Spotify', icon: Music, desc: 'Audio & Music' },
              { id: 'explorer', name: 'File Explorer', icon: Folder, desc: 'Windows Explorer' },
            ].map((app) => (
              <button
                key={app.id}
                onClick={() => triggerApp(app.id, app.name)}
                disabled={!isOnline || !!executing}
                className="flex flex-col items-start p-3.5 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-800/70 hover:border-zinc-700 transition-all text-left group disabled:opacity-40"
              >
                <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-indigo-400 group-hover:text-indigo-300 transition-colors mb-2">
                  <app.icon className="h-4 w-4" />
                </div>
                <span className="font-medium text-xs text-zinc-200">{app.name}</span>
                <span className="text-[10px] text-zinc-500 mt-0.5">{app.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Audio & Media Controls */}
        <div>
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Kontrol Audio & Media
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: 'play_pause', name: 'Play / Pause', icon: Play, desc: 'Toggle Pemutaran' },
              { id: 'volume_up', name: 'Volume +', icon: Volume2, desc: 'Naikkan Suara' },
              { id: 'volume_down', name: 'Volume -', icon: Volume1, desc: 'Turunkan Suara' },
              { id: 'mute', name: 'Mute Audio', icon: VolumeX, desc: 'Senyapkan Suara' },
            ].map((med) => (
              <button
                key={med.id}
                onClick={() => triggerMedia(med.id, med.name)}
                disabled={!isOnline || !!executing}
                className="flex items-center space-x-3 p-3.5 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-800/70 hover:border-zinc-700 transition-all text-left disabled:opacity-40"
              >
                <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-purple-400">
                  <med.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-xs text-zinc-200">{med.name}</p>
                  <p className="text-[10px] text-zinc-500">{med.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Section 3: Power Controls (High Risk) */}
        <div>
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
            <span>Kontrol Daya Laptop</span>
            <span className="text-[10px] text-amber-500/80 font-normal">
              (Memerlukan Konfirmasi Step-Up)
            </span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => triggerPower('lock_screen', 'Lock Workstation')}
              disabled={!isOnline || !!executing}
              className="flex items-center space-x-3 p-3.5 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-800/70 hover:border-zinc-700 transition-all text-left disabled:opacity-40"
            >
              <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-xs text-zinc-200">Kunci Layar</p>
                <p className="text-[10px] text-zinc-500">Lock Workstation</p>
              </div>
            </button>

            <button
              onClick={() => triggerPower('sleep', 'Sleep Mode')}
              disabled={!isOnline || !!executing}
              className="flex items-center space-x-3 p-3.5 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-800/70 hover:border-zinc-700 transition-all text-left disabled:opacity-40"
            >
              <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-blue-400">
                <Moon className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-xs text-zinc-200">Mode Tidur</p>
                <p className="text-[10px] text-zinc-500">Suspend State</p>
              </div>
            </button>

            <button
              onClick={() => triggerPower('restart', 'Restart Laptop')}
              disabled={!isOnline || !!executing}
              className="flex items-center space-x-3 p-3.5 rounded-2xl border border-amber-900/30 bg-amber-950/20 hover:bg-amber-950/40 hover:border-amber-700/60 transition-all text-left disabled:opacity-40"
            >
              <div className="p-2 rounded-xl bg-zinc-950 border border-amber-800/50 text-amber-400">
                <RotateCcw className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-xs text-amber-300">Restart</p>
                <p className="text-[10px] text-amber-500/70">Reboot Sistem</p>
              </div>
            </button>

            <button
              onClick={() => triggerPower('shutdown', 'Shutdown Laptop')}
              disabled={!isOnline || !!executing}
              className="flex items-center space-x-3 p-3.5 rounded-2xl border border-red-900/30 bg-red-950/20 hover:bg-red-950/40 hover:border-red-700/60 transition-all text-left disabled:opacity-40"
            >
              <div className="p-2 rounded-xl bg-zinc-950 border border-red-800/50 text-red-400">
                <Power className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-xs text-red-300">Shutdown</p>
                <p className="text-[10px] text-red-500/70">Matikan Daya</p>
              </div>
            </button>
          </div>
        </div>

        {executing && (
          <div className="flex items-center space-x-2 text-xs text-indigo-400 pt-2 font-mono">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Memproses perintah {executing}...</span>
          </div>
        )}
      </div>
    </div>
  );
};
