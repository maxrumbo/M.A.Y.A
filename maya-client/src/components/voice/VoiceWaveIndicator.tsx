import React from 'react';
import { Mic, Volume2, Square, Sparkles, AlertCircle } from 'lucide-react';
import type { VoiceState } from '../../services/voice/types';

interface VoiceWaveIndicatorProps {
  state: VoiceState;
  transcript?: string;
  errorMessage?: string | null;
  onStop?: () => void;
  voiceMode?: 'ptt' | 'hands_free';
}

export const VoiceWaveIndicator: React.FC<VoiceWaveIndicatorProps> = ({
  state,
  transcript,
  errorMessage,
  onStop,
  voiceMode = 'ptt',
}) => {
  if (state === 'idle' && !errorMessage) {
    return null;
  }

  return (
    <div className="w-full max-w-2xl mx-auto mb-3 px-4 py-2.5 rounded-2xl bg-zinc-900/95 border border-zinc-800 shadow-xl backdrop-blur-md flex items-center justify-between space-x-3 transition-all animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        {/* Animated Visual Wave / Icon */}
        <div className="flex items-center justify-center shrink-0">
          {state === 'listening' && (
            <div className="flex items-center space-x-1 h-5 px-1.5 py-1 bg-emerald-950/60 border border-emerald-800/60 rounded-full">
              <span className="w-1 bg-emerald-400 rounded-full animate-[bounce_1s_infinite_100ms] h-3" />
              <span className="w-1 bg-emerald-400 rounded-full animate-[bounce_1s_infinite_200ms] h-4" />
              <span className="w-1 bg-emerald-400 rounded-full animate-[bounce_1s_infinite_300ms] h-2" />
              <span className="w-1 bg-emerald-400 rounded-full animate-[bounce_1s_infinite_150ms] h-5" />
            </div>
          )}

          {state === 'thinking' && (
            <div className="flex items-center justify-center h-7 w-7 rounded-full bg-amber-950/60 border border-amber-800/60 text-amber-400">
              <Sparkles className="h-3.5 w-3.5 animate-spin" />
            </div>
          )}

          {state === 'speaking' && (
            <div className="flex items-center space-x-1 h-5 px-1.5 py-1 bg-indigo-950/60 border border-indigo-800/60 rounded-full">
              <span className="w-1 bg-indigo-400 rounded-full animate-[pulse_0.8s_infinite_100ms] h-4" />
              <span className="w-1 bg-indigo-400 rounded-full animate-[pulse_0.8s_infinite_250ms] h-2" />
              <span className="w-1 bg-indigo-400 rounded-full animate-[pulse_0.8s_infinite_150ms] h-5" />
              <span className="w-1 bg-indigo-400 rounded-full animate-[pulse_0.8s_infinite_300ms] h-3" />
            </div>
          )}

          {errorMessage && state === 'idle' && (
            <div className="flex items-center justify-center h-7 w-7 rounded-full bg-red-950/60 border border-red-800/60 text-red-400">
              <AlertCircle className="h-4 w-4" />
            </div>
          )}
        </div>

        {/* Text Transcript / Status */}
        <div className="min-w-0 flex-1 text-xs">
          {errorMessage ? (
            <p className="text-red-400 font-medium truncate">{errorMessage}</p>
          ) : state === 'listening' ? (
            <div>
              <p className="text-emerald-400 font-medium text-[11px] flex items-center space-x-1.5">
                <Mic className="h-3 w-3 inline" />
                <span>
                  {voiceMode === 'hands_free'
                    ? 'Hands-Free (Bicara sekarang, otomatis kirim saat jeda)...'
                    : 'Mendengarkan...'}
                </span>
              </p>
              <p className="text-zinc-200 italic truncate text-xs mt-0.5">
                {transcript ? `"${transcript}"` : 'Menunggu suara Anda...'}
              </p>
            </div>
          ) : state === 'thinking' ? (
            <p className="text-amber-300 font-medium text-xs">
              M.A.Y.A. sedang memproses jawaban...
            </p>
          ) : state === 'speaking' ? (
            <p className="text-indigo-300 font-medium text-xs flex items-center space-x-1.5">
              <Volume2 className="h-3.5 w-3.5 inline animate-pulse" />
              <span>M.A.Y.A. sedang berbicara...</span>
            </p>
          ) : null}
        </div>
      </div>

      {/* Stop / Barge-in Button */}
      {onStop && (state === 'listening' || state === 'speaking') && (
        <button
          onClick={onStop}
          title="Hentikan Suara (Barge-in)"
          className="shrink-0 flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[11px] font-medium border border-zinc-700/80 transition-colors"
        >
          <Square className="h-3 w-3 fill-zinc-300" />
          <span>Stop</span>
        </button>
      )}
    </div>
  );
};
