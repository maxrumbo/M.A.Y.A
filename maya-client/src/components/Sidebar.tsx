import React from 'react';
import {
  Mic,
  MessageSquare,
  LayoutDashboard,
  User,
  Laptop,
  LogOut,
  Settings,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import type { AppTab, DeviceStatus } from '../types';
import { MayaLogo } from './ui/MayaLogo';

interface SidebarProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  deviceStatus: DeviceStatus | null;
  isSignalRConnected: boolean;
  onLogout: () => void;
  onOpenServerSettings?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  deviceStatus,
  isSignalRConnected,
  onLogout,
  onOpenServerSettings,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const isOnline = deviceStatus?.isOnline ?? false;

  const navItems: Array<{ id: AppTab; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'home', label: 'Bicara', icon: Mic },
    { id: 'chat', label: 'Obrolan', icon: MessageSquare },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'personal', label: 'Personal', icon: User },
  ];

  return (
    <aside className="hidden md:flex w-56 border-r border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#14151A] flex-col h-full shrink-0 select-none safe-top safe-bottom transition-colors">
      {/* Brand Header */}
      <div className="p-4 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <MayaLogo size={28} framed />
          <div>
            <h1 className="font-semibold text-sm tracking-wide text-zinc-900 dark:text-zinc-100">
              M.A.Y.A.
            </h1>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Personal Assistant</p>
          </div>
        </div>
        <div
          title={isSignalRConnected ? 'SignalR Terhubung' : 'Menghubungkan SignalR...'}
          className={`h-2 w-2 rounded-full ${
            isSignalRConnected ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
        />
      </div>

      {/* Navigation Tabs */}
      <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                active
                  ? 'bg-zinc-900 text-white dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900/60'
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Minimal Laptop Status Strip */}
      <div className="px-3.5 py-2.5 mx-3 mb-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800/80 text-xs">
        <div className="flex items-center justify-between">
          <span className="flex items-center space-x-1.5 text-zinc-700 dark:text-zinc-300 font-medium">
            <Laptop className="h-3.5 w-3.5 text-zinc-400" />
            <span>Laptop</span>
          </span>
          <span
            className={`inline-flex items-center space-x-1 text-[10px] font-mono ${
              isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isOnline ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-600'
              }`}
            />
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </span>
        </div>

        {isOnline && (
          <p className="mt-1.5 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
            CPU {deviceStatus?.cpuUsagePercent?.toFixed(0) ?? '--'}% • BAT{' '}
            {deviceStatus?.batteryPercent ?? '--'}%
          </p>
        )}
      </div>

      {/* Footer Controls */}
      <div className="p-3 border-t border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="h-7 w-7 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center text-xs font-semibold shrink-0">
            M
          </div>
          <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
            Maxwell
          </span>
        </div>

        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'Ganti ke Light Mode' : 'Ganti ke Dark Mode'}
            className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {onOpenServerSettings && (
            <button
              type="button"
              onClick={onOpenServerSettings}
              title="Pengaturan Server"
              className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onLogout}
            title="Kunci / Keluar"
            className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
