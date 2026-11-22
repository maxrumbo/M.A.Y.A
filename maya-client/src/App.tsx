import React, { useState, useEffect } from 'react';
import { authStorage, api } from './api/client';
import { signalRService } from './services/signalr';
import type { DeviceStatus } from './types';
import { LockScreen } from './components/LockScreen';
import { Sidebar } from './components/Sidebar';
import { ChatWorkspace } from './components/ChatWorkspace';
import { VaultView } from './components/VaultView';
import { MemoryView } from './components/MemoryView';
import { LaptopControlView } from './components/LaptopControlView';

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(authStorage.hasToken());
  const [activeTab, setActiveTab] = useState<'chat' | 'vault' | 'memories' | 'controls'>('chat');
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [isSignalRConnected, setIsSignalRConnected] = useState<boolean>(false);

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

    // Start SignalR
    signalRService.start();

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

    return () => {
      unsubStatus();
      unsubConn();
      signalRService.stop();
    };
  }, [isAuthenticated]);

  const handleLogout = () => {
    authStorage.clearToken();
    setIsAuthenticated(false);
    signalRService.stop();
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
    </div>
  );
};

export default App;
