import React from 'react';
import {
  MessageSquare,
  KeyRound,
  Brain,
  Sliders,
  Laptop,
  Cpu,
  Zap,
  BatteryCharging,
  LogOut,
  Sparkles,
  Settings,
} from 'lucide-react';
import type { DeviceStatus } from '../types';

interface SidebarProps {
  activeTab: 'chat' | 'vault' | 'memories' | 'controls';
  onTabChange: (tab: 'chat' | 'vault' | 'memories' | 'controls') => void;
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
  const isOnline = deviceStatus?.isOnline ?? false;

  return (
    <aside className="w-64 border-r border-zinc-800/80 bg-zinc-950 flex flex-col h-full shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-indigo-400 shadow-inner">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-semibold text-sm tracking-wide text-zinc-100">M.A.Y.A.</h1>
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
              AI Companion
            </p>
          </div>
        </div>
        <div
          title={isSignalRConnected ? 'SignalR Bridge Connected' : 'SignalR Reconnecting...'}
          className={`h-2 w-2 rounded-full ${
            isSignalRConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
          }`}
        />
      </div>

      {/* Navigation Tabs */}
      <nav className="p-3 space-y-1 flex-1">
        <button
          onClick={() => onTabChange('chat')}
          className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'chat'
              ? 'bg-zinc-900 text-indigo-300 border border-zinc-800 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>Chat Workspace</span>
        </button>

        <button
          onClick={() => onTabChange('vault')}
          className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'vault'
              ? 'bg-zinc-900 text-indigo-300 border border-zinc-800 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
          }`}
        >
          <KeyRound className="h-4 w-4" />
          <span>Password Vault</span>
        </button>

        <button
          onClick={() => onTabChange('memories')}
          className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'memories'
              ? 'bg-zinc-900 text-indigo-300 border border-zinc-800 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
          }`}
        >
          <Brain className="h-4 w-4" />
          <span>Memory Engine</span>
        </button>

        <button
          onClick={() => onTabChange('controls')}
          className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'controls'
              ? 'bg-zinc-900 text-indigo-300 border border-zinc-800 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
          }`}
        >
          <Sliders className="h-4 w-4" />
          <span>Laptop Control</span>
        </button>
      </nav>

      {/* Live Laptop Telemetry Card */}
      <div className="p-3 m-3 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 text-xs">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center space-x-2">
            <Laptop className="h-3.5 w-3.5 text-zinc-400" />
            <span className="font-medium text-zinc-300">Maxwell's Laptop</span>
          </div>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono ${
              isOnline
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-900/60'
                : 'bg-zinc-800 text-zinc-500'
            }`}
          >
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        {isOnline ? (
          <div className="space-y-2 pt-1 font-mono text-[11px]">
            {/* CPU */}
            <div>
              <div className="flex justify-between text-zinc-400 mb-1">
                <span className="flex items-center space-x-1">
                  <Cpu className="h-3 w-3 text-zinc-500" />
                  <span>CPU</span>
                </span>
                <span className="text-zinc-300">
                  {deviceStatus?.cpuUsagePercent?.toFixed(1) ?? '—'}%
                </span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden">
                <div
                  className="bg-indigo-500 h-1 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, deviceStatus?.cpuUsagePercent || 0)}%` }}
                />
              </div>
            </div>

            {/* RAM */}
            <div>
              <div className="flex justify-between text-zinc-400 mb-1">
                <span className="flex items-center space-x-1">
                  <Zap className="h-3 w-3 text-zinc-500" />
                  <span>RAM</span>
                </span>
                <span className="text-zinc-300">
                  {deviceStatus?.ramUsagePercent?.toFixed(1) ?? '—'}%
                </span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden">
                <div
                  className="bg-purple-500 h-1 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, deviceStatus?.ramUsagePercent || 0)}%` }}
                />
              </div>
            </div>

            {/* Battery */}
            <div>
              <div className="flex justify-between text-zinc-400 mb-1">
                <span className="flex items-center space-x-1">
                  <BatteryCharging className="h-3 w-3 text-zinc-500" />
                  <span>Battery</span>
                </span>
                <span className="text-zinc-300">
                  {deviceStatus?.batteryPercent ?? '—'}%
                </span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden">
                <div
                  className={`h-1 rounded-full transition-all duration-500 ${
                    (deviceStatus?.batteryPercent || 100) > 20 ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(100, deviceStatus?.batteryPercent || 0)}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-zinc-500 py-1">Daemon belum terhubung.</p>
        )}
      </div>

      {/* User Footer & Logout */}
      <div className="p-3 border-t border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="h-7 w-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-300">
            M
          </div>
          <div className="truncate">
            <p className="text-xs font-medium text-zinc-200">Maxwell</p>
            <p className="text-[10px] text-zinc-500 truncate">Owner</p>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          {onOpenServerSettings && (
            <button
              onClick={onOpenServerSettings}
              title="Pengaturan Server URL"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onLogout}
            title="Kunci / Logout"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
