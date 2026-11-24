import React, { useState, useEffect } from 'react';
import { authStorage, api } from './api/client';
import { signalRService } from './services/signalr';
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

    // Fetch initial device status
    api
      .getDeviceStatus()
      .then(setDeviceStatus)
      .catch(() => {});

    // Periodic polling every 5s to guarantee fresh telemetry & online status
    const pollInterval = setInterval(() => {
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
    }, 5000);

    // Start SignalR
    void signalRService.start();

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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 font-sans text-zinc-100">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        deviceStatus={deviceStatus}
        isSignalRConnected={isSignalRConnected}
        onLogout={handleLogout}
        onOpenServerSettings={() => setShowServerSettings(true)}
      />

      {/* Main Workspace Views */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950">
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
