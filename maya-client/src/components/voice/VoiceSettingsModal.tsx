import React, { useState, useEffect } from 'react';
import {
  X,
  Volume2,
  Mic,
  Headphones,
  Sliders,
  Play,
  Square,
} from 'lucide-react';
import type { VoiceSettings } from '../../services/voice/types';
import { ttsService } from '../../services/voice/ttsService';

interface VoiceSettingsModalProps {
  settings: VoiceSettings;
  onUpdate: (updated: Partial<VoiceSettings>) => void;
  onClose: () => void;
}

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({
  settings,
  onUpdate,
  onClose,
}) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPlayingSample, setIsPlayingSample] = useState(false);

  useEffect(() => {
    const list = ttsService.getAvailableVoices();
    setVoices(list);
  }, []);

  const handleTestVoice = () => {
    if (isPlayingSample) {
      ttsService.stop();
      setIsPlayingSample(false);
      return;
    }

    setIsPlayingSample(true);
    ttsService.speak(
      'Halo Maxwell, aku M.A.Y.A. Suaraku sudah siap menemani aktivitas coding dan harimu.',
      settings,
      {
        onStart: () => setIsPlayingSample(true),
        onEnd: () => setIsPlayingSample(false),
        onError: () => setIsPlayingSample(false),
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/95 shadow-2xl p-5 text-zinc-100 flex flex-col space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-950/60 border border-indigo-800/60 text-indigo-400">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Pengaturan Suara</h2>
              <p className="text-[11px] text-zinc-400 font-mono">Phase 6A: Voice In-App</p>
            </div>
          </div>
          <button
            onClick={() => {
              ttsService.stop();
              onClose();
            }}
            className="rounded-lg p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Section 1: Mode Input Suara (STT) */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-300 flex items-center space-x-1.5">
            <Mic className="h-3.5 w-3.5 text-indigo-400" />
            <span>Mode Input Suara</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onUpdate({ voiceMode: 'ptt' })}
              className={`px-3 py-2.5 rounded-xl border text-xs text-left transition-all ${
                settings.voiceMode === 'ptt'
                  ? 'bg-zinc-800 border-indigo-500/80 text-white shadow-sm'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="font-medium">Push-to-Talk</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">
                Klik/tahan tombol Mic untuk bicara
              </div>
            </button>

            <button
              type="button"
              onClick={() => onUpdate({ voiceMode: 'hands_free' })}
              className={`px-3 py-2.5 rounded-xl border text-xs text-left transition-all ${
                settings.voiceMode === 'hands_free'
                  ? 'bg-zinc-800 border-indigo-500/80 text-white shadow-sm'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="font-medium">Hands-Free</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">
                Otomatis kirim saat ada jeda hening
              </div>
            </button>
          </div>
        </div>

        {/* Section 2: Anti-Echo Loop & Barge-in Guard */}
        <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="bargeInToggle"
              className="text-xs font-medium text-zinc-200 flex items-center space-x-1.5 cursor-pointer"
            >
              <Headphones className="h-3.5 w-3.5 text-indigo-400" />
              <span>Headset Auto Barge-in</span>
            </label>
            <input
              id="bargeInToggle"
              type="checkbox"
              checked={settings.headsetBargeIn}
              onChange={(e) => onUpdate({ headsetBargeIn: e.target.checked })}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            {settings.headsetBargeIn
              ? 'Aktif: M.A.Y.A. langsung berhenti berbicara jika suara Anda terdengar (khusus saat memakai earphone).'
              : 'Nonaktif (Anti-Echo): Mic di-pause saat M.A.Y.A. berbicara agar speaker laptop tidak memicu interupsi palsu.'}
          </p>
        </div>

        {/* Section 3: Output Suara (TTS) */}
        <div className="space-y-3 pt-1 border-t border-zinc-800/80">
          <div className="flex items-center justify-between">
            <label
              htmlFor="ttsToggle"
              className="text-xs font-semibold text-zinc-300 flex items-center space-x-1.5 cursor-pointer"
            >
              <Volume2 className="h-3.5 w-3.5 text-indigo-400" />
              <span>Bacakan Balasan (TTS)</span>
            </label>
            <input
              id="ttsToggle"
              type="checkbox"
              checked={settings.ttsEnabled}
              onChange={(e) => onUpdate({ ttsEnabled: e.target.checked })}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
          </div>

          {settings.ttsEnabled && (
            <div className="space-y-3 pl-1">
              {/* Voice Selection */}
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">
                  Pilihan Suara (TTS Voice)
                </label>
                <select
                  value={settings.selectedVoiceUri || ''}
                  onChange={(e) => onUpdate({ selectedVoiceUri: e.target.value || null })}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-indigo-500"
                >
                  <option value="">Default Suara Indonesia (Otomatis)</option>
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang}) {v.lang.startsWith('id') ? '⭐ [ID]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Speed / Rate Slider */}
              <div>
                <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                  <span>Kecepatan Bicara</span>
                  <span className="font-mono text-indigo-400">{settings.ttsRate.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.4"
                  step="0.05"
                  value={settings.ttsRate}
                  onChange={(e) => onUpdate({ ttsRate: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Sample Test Button */}
              <button
                type="button"
                onClick={handleTestVoice}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-xs font-medium text-zinc-200 transition-colors border border-zinc-700/80"
              >
                {isPlayingSample ? (
                  <>
                    <Square className="h-3.5 w-3.5 fill-zinc-200" />
                    <span>Hentikan Uji Coba</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-zinc-200" />
                    <span>Uji Coba Suara M.A.Y.A.</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-zinc-800/80 flex justify-end">
          <button
            onClick={() => {
              ttsService.stop();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
