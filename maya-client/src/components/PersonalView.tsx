import React, { useState } from 'react';
import {
  KeyRound,
  Brain,
  Settings,
  Sun,
  Moon,
  Volume2,
  Server,
  LogOut,
  Check,
  Sliders,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useMayaSession } from '../context/MayaSessionContext';
import { getApiBaseUrl } from '../services/serverConfig';
import { VaultView } from './VaultView';
import { MemoryView } from './MemoryView';

type PersonalSubTab = 'vault' | 'memory' | 'settings';

interface PersonalViewProps {
  isSignalRConnected: boolean;
  onOpenServerSettings: () => void;
  onLogout: () => void;
}

export const PersonalView: React.FC<PersonalViewProps> = ({
  isSignalRConnected,
  onOpenServerSettings,
  onLogout,
}) => {
  const [subTab, setSubTab] = useState<PersonalSubTab>('vault');
  const { theme, setTheme } = useTheme();
  const { voice, setShowVoiceSettings } = useMayaSession();

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8F9FA] dark:bg-[#0F1014] overflow-hidden transition-colors">
      {/* Segmented Top Header */}
      <header className="border-b border-zinc-200/80 dark:border-zinc-800/80 px-4 sm:px-6 py-3 bg-white/80 dark:bg-[#14151A]/90 backdrop-blur-md shrink-0">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
              Ruang Personal
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Password Vault, Memori Jangka Panjang, dan Preferensi
            </p>
          </div>

          <div className="inline-flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 self-start sm:self-auto">
            {[
              { id: 'vault' as const, label: 'Vault', icon: KeyRound },
              { id: 'memory' as const, label: 'Memory', icon: Brain },
              { id: 'settings' as const, label: 'Setelan', icon: Settings },
            ].map((item) => {
              const active = subTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSubTab(item.id)}
                  className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-[#17191F] text-zinc-900 dark:text-zinc-100 shadow-xs'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {subTab === 'vault' && <VaultView embedded />}
      {subTab === 'memory' && <MemoryView embedded />}
      {subTab === 'settings' && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Theme Selector Card */}
            <div className="rounded-2xl bg-white dark:bg-[#17191F] border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Tema Tampilan
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Pilih tampilan terang atau gelap sesuai kenyamanan mata
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    theme === 'dark'
                      ? 'border-indigo-500 bg-zinc-50 dark:bg-zinc-900 ring-1 ring-indigo-500/40'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-9 w-9 rounded-xl bg-zinc-900 text-zinc-100 flex items-center justify-center border border-zinc-700">
                      <Moon className="h-4 w-4" />
                    </div>
                    {theme === 'dark' && (
                      <span className="h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Dark Mode
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Nyaman malam hari &amp; hemat baterai
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    theme === 'light'
                      ? 'border-indigo-500 bg-zinc-50 dark:bg-zinc-900 ring-1 ring-indigo-500/40'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-9 w-9 rounded-xl bg-white text-zinc-900 flex items-center justify-center border border-zinc-200">
                      <Sun className="h-4 w-4" />
                    </div>
                    {theme === 'light' && (
                      <span className="h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Light Mode
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Bersih, cerah, dan mudah dibaca siang hari
                  </p>
                </button>
              </div>
            </div>

            {/* Voice Preferences */}
            <div className="rounded-2xl bg-white dark:bg-[#17191F] border border-zinc-200 dark:border-zinc-800 p-5 flex items-center justify-between gap-4">
              <div className="flex items-start space-x-3">
                <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Volume2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Preferensi Suara
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Mode: {voice.settings.voiceMode === 'hands_free' ? 'Hands-Free' : 'Push-to-Talk'} •{' '}
                    TTS: {voice.settings.ttsEnabled ? 'Aktif' : 'Nonaktif'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowVoiceSettings(true)}
                className="shrink-0 inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>Atur Suara</span>
              </button>
            </div>

            {/* Server Endpoint */}
            <div className="rounded-2xl bg-white dark:bg-[#17191F] border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start space-x-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Server className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Koneksi Server
                    </h3>
                    <span
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-mono ${
                        isSignalRConnected
                          ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400'
                          : 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      <span>{isSignalRConnected ? 'SignalR Aktif' : 'Menghubungkan'}</span>
                    </span>
                  </div>
                  <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                    {getApiBaseUrl()}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenServerSettings}
                className="shrink-0 px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
              >
                Ubah Alamat Server
              </button>
            </div>

            {/* Account / Lock */}
            <div className="rounded-2xl bg-white dark:bg-[#17191F] border border-zinc-200 dark:border-zinc-800 p-5 flex items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold text-sm flex items-center justify-center">
                  M
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Maxwell</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Pemilik Sistem</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-300 text-xs font-medium transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Kunci / Keluar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
