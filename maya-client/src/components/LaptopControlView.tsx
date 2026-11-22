import React, { useState } from 'react';
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
} from 'lucide-react';
import { api } from '../api/client';
import type { DeviceStatus } from '../types';

interface LaptopControlViewProps {
  deviceStatus: DeviceStatus | null;
  onActionTriggered: () => void;
}

export const LaptopControlView: React.FC<LaptopControlViewProps> = ({
  deviceStatus,
}) => {
  const [executing, setExecuting] = useState<string | null>(null);
  const isOnline = deviceStatus?.isOnline ?? false;

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
      <header className="h-14 border-b border-zinc-800/80 px-6 flex items-center justify-between shrink-0 bg-zinc-950/80 backdrop-blur-md">
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
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-5xl mx-auto w-full">
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
