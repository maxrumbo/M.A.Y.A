import React, { useState, useEffect } from 'react';
import {
  Menu,
  MessageSquare,
  KeyRound,
  Brain,
  Sliders,
  Settings,
  Sparkles,
} from 'lucide-react';
import { authStorage, api } from './api/client';
import { signalRService } from './services/signalr';
import { registerDeviceForPush } from './services/pushNotifications';
import {
  isNativeMobile,
  startNativeFindMe,
  stopNativeFindMe,
  onNativeFindMeStopped,
} from './services/mobileNative';
import type { DeviceStatus } from './types';
import { LockScreen } from './components/LockScreen';
import { Sidebar } from './components/Sidebar';
import { ChatWorkspace } from './components/ChatWorkspace';
import { VaultView } from './components/VaultView';
import { MemoryView } from './components/MemoryView';
import { LaptopControlView } from './components/LaptopControlView';
import { ServerSettingsModal } from './components/ServerSettingsModal';
import { FindMyPhoneOverlay } from './components/FindMyPhoneOverlay';

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(authStorage.hasToken());
  const [activeTab, setActiveTab] = useState<'chat' | 'vault' | 'memories' | 'controls'>('chat');
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [isSignalRConnected, setIsSignalRConnected] = useState<boolean>(false);
  const [showServerSettings, setShowServerSettings] = useState<boolean>(false);
  const [findMyPhoneMessage, setFindMyPhoneMessage] = useState<string | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleUnauthorized = () => {
      setIsAuthenticated(false);
      signalRService.stop();
    };

    window.addEventListener('maya_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('maya_unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const refreshStatus = () => {
      api
        .getDeviceStatus()
        .then((fresh) => {
          setDeviceStatus((prev) => ({
            ...prev,
            ...fresh,
            cpuUsagePercent: fresh.cpuUsagePercent ?? prev?.cpuUsagePercent ?? null,
            ramUsagePercent: fresh.ramUsagePercent ?? prev?.ramUsagePercent ?? null,
            batteryPercent: fresh.batteryPercent ?? prev?.batteryPercent ?? null,
          }));
        })
        .catch(() => {});
    };

    // Fetch initial device status
    refreshStatus();

    // Periodic polling every 5s to guarantee fresh telemetry & online status
    const pollInterval = setInterval(refreshStatus, 5000);

    // Start SignalR
    void signalRService.start();

    // Phase 8: Daftarkan HP ke FCM (APK saja; no-op di web / bila Firebase belum dipasang)
    if (isNativeMobile()) {
      void registerDeviceForPush(false).catch(() => {});
    }

    // Phase 7B: Auto-reconnect SignalR segera saat layar HP menyala / app kembali aktif
    const handleResume = () => {
      if (document.visibilityState === 'visible') {
        void signalRService.ensureConnected();
        refreshStatus();
        if (isNativeMobile()) {
          void registerDeviceForPush(false).catch(() => {});
        }
      }
    };
    const handleOnline = () => {
      void signalRService.ensureConnected();
      refreshStatus();
    };

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('focus', handleOnline);
    window.addEventListener('online', handleOnline);

    const unsubStatus = signalRService.onStatusChange((status) => {
      setDeviceStatus((prev) => ({
        ...prev,
        ...status,
        cpuUsagePercent: status.cpuUsagePercent ?? prev?.cpuUsagePercent ?? null,
        ramUsagePercent: status.ramUsagePercent ?? prev?.ramUsagePercent ?? null,
        batteryPercent: status.batteryPercent ?? prev?.batteryPercent ?? null,
      }));
    });

    const unsubConn = signalRService.onConnectionChange(setIsSignalRConnected);

    // Phase 7: Mobile "Find My Phone" listener (aktif hanya di dalam APK Capacitor)
    const unsubFindPhone = signalRService.onFindMyPhoneRequested((req) => {
      if (!isNativeMobile()) return;
      const duration = req.durationSeconds ?? 10;
      const message = req.message || 'Aku di sini, Max!';
      setFindMyPhoneMessage(message);
      void startNativeFindMe(duration, message).catch(() => {});
    });

    const unsubStopPhone = signalRService.onStopFindMyPhone(() => {
      if (!isNativeMobile()) return;
      setFindMyPhoneMessage(null);
      void stopNativeFindMe().catch(() => {});
    });

    let cleanupNativeListener: (() => void) | null = null;
    if (isNativeMobile()) {
      void onNativeFindMeStopped(() => {
        setFindMyPhoneMessage(null);
      }).then((fn) => {
        cleanupNativeListener = fn;
      });
    }

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('focus', handleOnline);
      window.removeEventListener('online', handleOnline);
      unsubStatus();
      unsubConn();
      unsubFindPhone();
      unsubStopPhone();
      cleanupNativeListener?.();
      signalRService.stop();
    };
  }, [isAuthenticated]);

  const handleLogout = () => {
    authStorage.clearToken();
    setIsAuthenticated(false);
    setMobileDrawerOpen(false);
    signalRService.stop();
  };

  const handleServerUrlSaved = () => {
    // Saat server URL berubah: hentikan SignalR lama dan bersihkan token karena JWT server lain tidak valid
    signalRService.stop();
    authStorage.clearToken();
    setDeviceStatus(null);
    setIsSignalRConnected(false);
    setIsAuthenticated(false);
  };

  const handleStopFindMyPhoneOverlay = () => {
    setFindMyPhoneMessage(null);
    void stopNativeFindMe().catch(() => {});
    void api.stopFindMyPhone().catch(() => {});
  };

  if (!isAuthenticated) {
    return <LockScreen onUnlocked={() => setIsAuthenticated(true)} />;
  }

  const isLaptopOnline = deviceStatus?.isOnline ?? false;

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-screen overflow-hidden bg-zinc-950 font-sans text-zinc-100">
      {/* Phase 7B: Mobile Top Bar (safe-area notch aware) */}
      <div className="md:hidden shrink-0 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md safe-top z-20">
        <div className="h-12 px-3 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Buka Menu"
              className="p-2 rounded-xl text-zinc-300 hover:bg-zinc-900 active:scale-95 transition-all"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center space-x-1.5">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <span className="font-semibold text-sm tracking-wide">M.A.Y.A.</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono ${
                isLaptopOnline
                  ? 'bg-emerald-950/70 border-emerald-800/70 text-emerald-400'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isLaptopOnline ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
                }`}
              />
              <span>
                {isLaptopOnline
                  ? `PC ${deviceStatus?.batteryPercent ?? '—'}%`
                  : 'PC Offline'}
              </span>
            </span>

            <button
              type="button"
              onClick={() => setShowServerSettings(true)}
              aria-label="Pengaturan Server"
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar Navigation (Desktop Static + Mobile Drawer) */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        deviceStatus={deviceStatus}
        isSignalRConnected={isSignalRConnected}
        onLogout={handleLogout}
        onOpenServerSettings={() => setShowServerSettings(true)}
        mobileOpen={mobileDrawerOpen}
        onCloseMobile={() => setMobileDrawerOpen(false)}
      />

      {/* Main Workspace Views */}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden bg-zinc-950">
        {activeTab === 'chat' && <ChatWorkspace deviceStatus={deviceStatus} />}
        {activeTab === 'vault' && <VaultView />}
        {activeTab === 'memories' && <MemoryView />}
        {activeTab === 'controls' && (
          <LaptopControlView
            deviceStatus={deviceStatus}
            onActionTriggered={() => setActiveTab('chat')}
          />
        )}
      </main>

      {/* Phase 7B: Mobile Bottom Navigation Bar (safe-area gesture bar aware) */}
      <nav className="md:hidden shrink-0 border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md safe-bottom z-20">
        <div className="grid grid-cols-4 h-14 px-1">
          {[
            { id: 'chat' as const, label: 'Chat', icon: MessageSquare },
            { id: 'vault' as const, label: 'Vault', icon: KeyRound },
            { id: 'memories' as const, label: 'Memory', icon: Brain },
            { id: 'controls' as const, label: 'Control', icon: Sliders },
          ].map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center space-y-1 text-[10px] font-medium transition-colors ${
                  active ? 'text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <item.icon className={`h-4 w-4 ${active ? 'text-indigo-400' : ''}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Phase 7: Modal Ganti Server URL Dinamis */}
      {showServerSettings && (
        <ServerSettingsModal
          onClose={() => setShowServerSettings(false)}
          onSaved={handleServerUrlSaved}
        />
      )}

      {/* Phase 7: Overlay Layar Penuh saat Find My Phone Aktif di HP */}
      {findMyPhoneMessage && (
        <FindMyPhoneOverlay
          message={findMyPhoneMessage}
          onStop={handleStopFindMyPhoneOverlay}
        />
      )}
    </div>
  );
};

export default App;
