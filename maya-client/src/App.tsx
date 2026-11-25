import React, { useState, useEffect, useCallback } from 'react';
import {
  Mic,
  MessageSquare,
  LayoutDashboard,
  User,
  Sun,
  Moon,
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
import { useTheme } from './context/ThemeContext';
import { MayaSessionProvider, useMayaSession } from './context/MayaSessionContext';
import type { AppTab, DeviceStatus } from './types';
import { SplashLoader } from './components/SplashLoader';
import { MayaLogo } from './components/ui/MayaLogo';
import { LockScreen } from './components/LockScreen';
import { Sidebar } from './components/Sidebar';
import { HomeView } from './components/HomeView';
import { ChatWorkspace } from './components/ChatWorkspace';
import { LaptopControlView } from './components/LaptopControlView';
import { PersonalView } from './components/PersonalView';
import { ServerSettingsModal } from './components/ServerSettingsModal';
import { FindMyPhoneOverlay } from './components/FindMyPhoneOverlay';
import { VoiceSettingsModal } from './components/voice/VoiceSettingsModal';
import { StepUpModal } from './components/StepUpModal';

interface AuthenticatedShellProps {
  deviceStatus: DeviceStatus | null;
  isSignalRConnected: boolean;
  onLogout: () => void;
  onOpenServerSettings: () => void;
}

const AuthenticatedShell: React.FC<AuthenticatedShellProps> = ({
  deviceStatus,
  isSignalRConnected,
  onLogout,
  onOpenServerSettings,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const {
    showVoiceSettings,
    setShowVoiceSettings,
    voice,
    stepUpTarget,
    closeStepUp,
    handleStepUpSuccess,
  } = useMayaSession();

  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [autoFocusChatInput, setAutoFocusChatInput] = useState<boolean>(false);

  const handleNavigate = useCallback((tab: AppTab, focusInput = false) => {
    setActiveTab(tab);
    if (tab === 'chat' && focusInput) {
      setAutoFocusChatInput(true);
    }
  }, []);

  const isLaptopOnline = deviceStatus?.isOnline ?? false;

  const mobileNavItems: Array<{ id: AppTab; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'home', label: 'Bicara', icon: Mic },
    { id: 'chat', label: 'Obrolan', icon: MessageSquare },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'personal', label: 'Personal', icon: User },
  ];

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-screen overflow-hidden bg-[#F8F9FA] dark:bg-[#0F1014] font-sans text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* Minimal Mobile Top Bar */}
      <div className="md:hidden shrink-0 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-[#F8F9FA]/95 dark:bg-[#0F1014]/95 backdrop-blur-md safe-top z-20">
        <div className="h-12 px-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <MayaLogo size={24} framed />
            <span className="font-semibold text-sm tracking-wide">M.A.Y.A.</span>
          </div>

          <div className="flex items-center space-x-2">
            <span
              title={isLaptopOnline ? 'Laptop Online' : 'Laptop Offline'}
              className={`h-2 w-2 rounded-full ${
                isLaptopOnline ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-600'
              }`}
            />

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Ganti Tema"
              className="p-1.5 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Static Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => handleNavigate(tab)}
        deviceStatus={deviceStatus}
        isSignalRConnected={isSignalRConnected}
        onLogout={onLogout}
        onOpenServerSettings={onOpenServerSettings}
      />

      {/* Main Workspace */}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeTab === 'home' && (
          <HomeView deviceStatus={deviceStatus} onNavigate={handleNavigate} />
        )}
        {activeTab === 'chat' && (
          <ChatWorkspace
            deviceStatus={deviceStatus}
            autoFocusInput={autoFocusChatInput}
            onInputFocused={() => setAutoFocusChatInput(false)}
          />
        )}
        {activeTab === 'dashboard' && (
          <LaptopControlView
            deviceStatus={deviceStatus}
            onActionTriggered={() => handleNavigate('chat')}
          />
        )}
        {activeTab === 'personal' && (
          <PersonalView
            isSignalRConnected={isSignalRConnected}
            onOpenServerSettings={onOpenServerSettings}
            onLogout={onLogout}
          />
        )}
      </main>

      {/* Minimal Mobile Bottom Navigation Bar */}
      <nav className="md:hidden shrink-0 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-[#FFFFFF]/95 dark:bg-[#14151A]/95 backdrop-blur-md safe-bottom z-20">
        <div className="grid grid-cols-4 h-14 px-2">
          {mobileNavItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`flex flex-col items-center justify-center space-y-1 text-[10px] font-medium transition-colors ${
                  active
                    ? 'text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <span
                  className={`px-3 py-1 rounded-full transition-colors ${
                    active ? 'bg-zinc-200/80 dark:bg-zinc-800' : ''
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Voice Settings Modal */}
      {showVoiceSettings && (
        <VoiceSettingsModal
          settings={voice.settings}
          onUpdate={voice.updateSettings}
          onClose={() => setShowVoiceSettings(false)}
        />
      )}

      {/* Global Step-Up Confirmation Modal */}
      {stepUpTarget && (
        <StepUpModal
          title={stepUpTarget.commandName}
          description={stepUpTarget.description}
          targetId={stepUpTarget.commandId}
          onSuccess={handleStepUpSuccess}
          onClose={closeStepUp}
        />
      )}
    </div>
  );
};

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(authStorage.hasToken());
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [splashSubtitle, setSplashSubtitle] = useState<string>('Menyiapkan asisten...');
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [isSignalRConnected, setIsSignalRConnected] = useState<boolean>(false);
  const [showServerSettings, setShowServerSettings] = useState<boolean>(false);
  const [findMyPhoneMessage, setFindMyPhoneMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1150);
    return () => clearTimeout(timer);
  }, []);

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

    refreshStatus();

    const pollInterval = setInterval(refreshStatus, 30000);

    void signalRService.start();

    if (isNativeMobile()) {
      void registerDeviceForPush(false).catch(() => {});
    }

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

  const handleUnlocked = () => {
    setSplashSubtitle('Membuka ruang bicara...');
    setShowSplash(true);
    setIsAuthenticated(true);
    setTimeout(() => {
      setShowSplash(false);
    }, 500);
  };

  const handleLogout = () => {
    authStorage.clearToken();
    setIsAuthenticated(false);
    signalRService.stop();
  };

  const handleServerUrlSaved = () => {
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

  return (
    <>
      {!isAuthenticated ? (
        <LockScreen onUnlocked={handleUnlocked} />
      ) : (
        <MayaSessionProvider>
          <AuthenticatedShell
            deviceStatus={deviceStatus}
            isSignalRConnected={isSignalRConnected}
            onLogout={handleLogout}
            onOpenServerSettings={() => setShowServerSettings(true)}
          />
        </MayaSessionProvider>
      )}

      {showServerSettings && (
        <ServerSettingsModal
          onClose={() => setShowServerSettings(false)}
          onSaved={handleServerUrlSaved}
        />
      )}

      {findMyPhoneMessage && (
        <FindMyPhoneOverlay
          message={findMyPhoneMessage}
          onStop={handleStopFindMyPhoneOverlay}
        />
      )}

      <SplashLoader visible={showSplash} subtitle={splashSubtitle} />
    </>
  );
};

export default App;
