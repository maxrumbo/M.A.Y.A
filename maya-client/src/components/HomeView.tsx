import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Keyboard,
  Volume2,
  VolumeX,
  Send,
  ShieldAlert,
  AlertCircle,
  ArrowUpRight,
} from 'lucide-react';
import { useMayaSession } from '../context/MayaSessionContext';
import { cleanTextForSpeech } from '../services/voice/ttsService';
import type { AppTab, DeviceStatus } from '../types';
import { VoiceSvgVisualizer } from './voice/VoiceSvgVisualizer';

interface HomeViewProps {
  deviceStatus: DeviceStatus | null;
  onNavigate: (tab: AppTab, focusInput?: boolean) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigate }) => {
  const {
    messages,
    loading,
    voice,
    actionError,
    sendMessage,
    stopGeneration,
    openStepUpForAction,
    cancelAction,
    clearActionError,
  } = useMayaSession();

  const [showQuickInput, setShowQuickInput] = useState(false);
  const [quickText, setQuickText] = useState('');
  const quickInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showQuickInput) {
      setTimeout(() => quickInputRef.current?.focus(), 60);
    }
  }, [showQuickInput]);

  const effectiveState =
    loading && voice.voiceState === 'idle' ? 'thinking' : voice.voiceState;

  const statusText =
    effectiveState === 'listening'
      ? 'Mendengarkan...'
      : effectiveState === 'thinking'
      ? 'Memproses...'
      : effectiveState === 'speaking'
      ? 'Berbicara'
      : 'Siap mendengarkan';

  const lastModelMsg = [...messages].reverse().find((m) => m.role === 'model');
  const waitingActions =
    lastModelMsg?.pendingActions?.filter((pa) => !pa.status || pa.status === 'Waiting') || [];

  const cleanReplyPreview = lastModelMsg ? cleanTextForSpeech(lastModelMsg.content) : '';
  const isLongOrCodeReply =
    !!lastModelMsg && (lastModelMsg.content.includes('```') || cleanReplyPreview.length > 210);

  const handleMainAction = () => {
    clearActionError();
    if (voice.voiceState === 'listening') {
      voice.stopListening();
      return;
    }
    if (loading || voice.voiceState === 'thinking') {
      stopGeneration();
      return;
    }
    if (voice.voiceState === 'speaking') {
      voice.stopSpeaking();
      return;
    }
    if (voice.isSttSupported) {
      voice.startListening();
    }
  };

  const handleQuickSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = quickText.trim();
    if (!text || loading) return;
    setQuickText('');
    setShowQuickInput(false);
    await sendMessage(text);
  };

  return (
    <div className="flex-1 flex flex-col justify-between h-full bg-[#F8F9FA] dark:bg-[#0F1014] text-zinc-900 dark:text-zinc-100 overflow-hidden transition-colors select-none">
      {/* Subtle Top Strip: Live Status + Single Quiet PTT / Hands-Free Toggle */}
      <div className="pt-4 sm:pt-6 px-4 flex flex-col items-center space-y-2.5 shrink-0">
        <div className="inline-flex items-center space-x-2">
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              effectiveState === 'listening'
                ? 'bg-indigo-600 dark:bg-indigo-400 animate-pulse'
                : effectiveState === 'thinking'
                ? 'bg-zinc-500 animate-pulse'
                : effectiveState === 'speaking'
                ? 'bg-indigo-500'
                : 'bg-zinc-400 dark:bg-zinc-600'
            }`}
          />
          <span className="text-xs font-medium tracking-wide text-zinc-600 dark:text-zinc-400">
            {statusText}
          </span>
        </div>

        <div className="inline-flex items-center p-0.5 rounded-full bg-zinc-200/75 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px]">
          <button
            type="button"
            onClick={() => voice.updateSettings({ voiceMode: 'ptt' })}
            className={`px-3 py-1 rounded-full font-medium transition-colors cursor-pointer ${
              voice.settings.voiceMode === 'ptt'
                ? 'bg-white dark:bg-[#17191F] text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            PTT
          </button>
          <button
            type="button"
            onClick={() => voice.updateSettings({ voiceMode: 'hands_free' })}
            className={`px-3 py-1 rounded-full font-medium transition-colors cursor-pointer ${
              voice.settings.voiceMode === 'hands_free'
                ? 'bg-white dark:bg-[#17191F] text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            Hands-Free
          </button>
        </div>
      </div>

      {/* Center Stage: Generative SVG Acoustic Visualizer + Caption Area */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-4 text-center max-w-lg mx-auto w-full">
        <VoiceSvgVisualizer
          state={effectiveState}
          onClick={handleMainAction}
          label="Ketuk untuk berbicara dengan M.A.Y.A."
        />

        <div className="mt-6 w-full max-h-40 overflow-y-auto flex flex-col items-center justify-start space-y-3 select-text">
          {(voice.errorMessage || actionError) && (
            <div className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{voice.errorMessage || actionError}</span>
            </div>
          )}

          {effectiveState === 'listening' ? (
            <p className="text-base sm:text-lg font-medium text-zinc-900 dark:text-zinc-100 leading-snug">
              {voice.transcript ? `"${voice.transcript}"` : 'Silakan bicara...'}
            </p>
          ) : effectiveState === 'thinking' ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Sebentar...</p>
          ) : cleanReplyPreview ? (
            <div className="space-y-2.5 w-full">
              <p className="text-sm sm:text-base text-zinc-700 dark:text-zinc-200 leading-relaxed line-clamp-4">
                {cleanReplyPreview}
              </p>

              {isLongOrCodeReply && (
                <button
                  type="button"
                  onClick={() => onNavigate('chat')}
                  className="inline-flex items-center space-x-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  <span>Lihat detail</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}

              {waitingActions.length > 0 && (
                <div className="mt-2 space-y-2 text-left">
                  {waitingActions.map((action) => (
                    <div
                      key={action.commandId}
                      className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#17191F] p-3 text-xs space-y-2"
                    >
                      <div className="flex items-center space-x-2 font-medium text-zinc-900 dark:text-zinc-100">
                        <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
                        <span>{action.commandName}</span>
                      </div>
                      <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        {action.description}
                      </p>
                      <div className="flex items-center space-x-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => openStepUpForAction(action)}
                          className="px-3 py-1.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-medium cursor-pointer"
                        >
                          Konfirmasi
                        </button>
                        <button
                          type="button"
                          onClick={() => void cancelAction(action.commandId)}
                          className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400">
              Halo Max, langsung bicara saja.
            </p>
          )}
        </div>
      </div>

      {/* Minimalist Bottom Control Dock */}
      <footer className="px-4 pb-6 sm:pb-8 pt-2 shrink-0 w-full max-w-md mx-auto">
        {showQuickInput ? (
          <form
            onSubmit={handleQuickSend}
            className="flex items-center space-x-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#17191F] p-1.5 shadow-sm"
          >
            <button
              type="button"
              onClick={() => setShowQuickInput(false)}
              title="Kembali ke suara"
              className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <Mic className="h-4 w-4" />
            </button>
            <input
              ref={quickInputRef}
              type="text"
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              placeholder="Ketik pesan..."
              className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none px-2"
            />
            <button
              type="submit"
              disabled={!quickText.trim() || loading}
              title="Kirim"
              className="h-9 w-9 shrink-0 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center disabled:opacity-35 transition-colors cursor-pointer"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-center space-x-8">
            <button
              type="button"
              onClick={() => setShowQuickInput(true)}
              title="Ketik pesan"
              className="h-11 w-11 rounded-full flex items-center justify-center bg-white dark:bg-[#17191F] border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all cursor-pointer"
            >
              <Keyboard className="h-4 w-4" />
            </button>

            <button
              type="button"
              disabled={!voice.isSttSupported && effectiveState === 'idle'}
              onClick={handleMainAction}
              aria-label={effectiveState === 'idle' ? 'Mulai Bicara' : 'Hentikan'}
              className={`h-16 w-16 rounded-full flex items-center justify-center shadow-md active:scale-95 transition-all disabled:opacity-40 cursor-pointer ${
                effectiveState === 'listening'
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  : effectiveState === 'thinking' || effectiveState === 'speaking'
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950'
              }`}
            >
              {effectiveState === 'idle' ? (
                <Mic className="h-6 w-6" />
              ) : (
                <Square className="h-5 w-5 fill-current" />
              )}
            </button>

            <button
              type="button"
              onClick={voice.toggleTts}
              title={voice.settings.ttsEnabled ? 'Bisukan suara balasan' : 'Aktifkan suara balasan'}
              className="h-11 w-11 rounded-full flex items-center justify-center bg-white dark:bg-[#17191F] border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all cursor-pointer"
            >
              {voice.settings.ttsEnabled ? (
                <Volume2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <VolumeX className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
              )}
            </button>
          </div>
        )}
      </footer>
    </div>
  );
};
