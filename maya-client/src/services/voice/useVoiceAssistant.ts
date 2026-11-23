import { useState, useEffect, useRef, useCallback } from 'react';
import type { VoiceState, VoiceSettings, ISttProvider } from './types';
import { defaultSttProvider } from './sttService';
import { ttsService } from './ttsService';

const SETTINGS_KEY = 'maya_voice_settings';

const DEFAULT_SETTINGS: VoiceSettings = {
  ttsEnabled: true,
  voiceMode: 'ptt',
  ttsRate: 1.05,
  ttsPitch: 1.0,
  selectedVoiceUri: null,
  headsetBargeIn: false, // Default Anti-Echo Guard AKTIF (auto-pause STT saat M.A.Y.A. bicara)
  autoSendDelayMs: 1800,
};

function loadSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // ignore parse error
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: VoiceSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

interface UseVoiceAssistantProps {
  onSendMessage: (message: string) => Promise<void>;
  isGenerating?: boolean;
}

export function useVoiceAssistant({
  onSendMessage,
  isGenerating = false,
}: UseVoiceAssistantProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<VoiceSettings>(loadSettings);

  const sttRef = useRef<ISttProvider>(defaultSttProvider);
  const silenceTimerRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');
  const settingsRef = useRef<VoiceSettings>(settings);
  const voiceStateRef = useRef<VoiceState>(voiceState);
  const isGeneratingRef = useRef<boolean>(isGenerating);
  const onSendMessageRef = useRef(onSendMessage);

  // Keep refs up-to-date
  useEffect(() => {
    onSendMessageRef.current = onSendMessage;
  }, [onSendMessage]);

  useEffect(() => {
    settingsRef.current = settings;
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    isGeneratingRef.current = isGenerating;
    if (isGenerating && voiceStateRef.current !== 'thinking') {
      setVoiceState('thinking');
    }
  }, [isGenerating]);

  // Hentikan TTS dan STT seketika (Barge-in manual / Stop)
  const stopAll = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    ttsService.stop();
    sttRef.current.abort();
    setTranscript('');
    transcriptRef.current = '';
    setVoiceState('idle');
  }, []);

  // Kirim transcript yang terkumpul ke AI
  const submitTranscript = useCallback(async () => {
    const textToSend = transcriptRef.current.trim();
    if (!textToSend) {
      sttRef.current.stop();
      if (voiceStateRef.current === 'listening') {
        setVoiceState('idle');
      }
      return;
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // Stop STT & kosongkan buffer sebelum mengirim agar tidak terkirim ganda
    sttRef.current.stop();
    setTranscript('');
    transcriptRef.current = '';
    setVoiceState('thinking');

    try {
      await onSendMessageRef.current(textToSend);
    } catch {
      setVoiceState('idle');
    }
  }, []);

  // Setup listener STT
  useEffect(() => {
    const stt = sttRef.current;

    stt.onResult((text: string, _isFinal: boolean) => {
      // Barge-in: Jika M.A.Y.A. sedang berbicara dan headset barge-in aktif
      if (voiceStateRef.current === 'speaking') {
        if (settingsRef.current.headsetBargeIn) {
          ttsService.stop();
          setVoiceState('listening');
        } else {
          // Abaikan suara agar speaker laptop tidak ter-transkrip
          return;
        }
      }

      setErrorMessage(null);
      setTranscript(text);
      transcriptRef.current = text;
      setVoiceState('listening');

      // VAD Hands-Free Auto-Send: Deteksi jeda bicara
      if (settingsRef.current.voiceMode === 'hands_free') {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        silenceTimerRef.current = setTimeout(() => {
          if (transcriptRef.current.trim()) {
            submitTranscript();
          }
        }, settingsRef.current.autoSendDelayMs);
      }
    });

    stt.onError((msg: string, code?: string) => {
      // no-speech bukan error fatal, jangan ganggu user
      if (code === 'no-speech') return;

      setErrorMessage(msg);
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      // Pastikan state tidak nyangkut di listening
      if (voiceStateRef.current === 'listening') {
        setVoiceState('idle');
      }
    });

    stt.onEnd(() => {
      // Jika STT berhenti (baik PTT maupun Hands-Free) dan ada transkrip yang belum dikirim:
      if (transcriptRef.current.trim()) {
        submitTranscript();
      } else if (voiceStateRef.current === 'listening') {
        setVoiceState('idle');
      }
    });

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      stt.abort();
      ttsService.stop();
    };
  }, [submitTranscript]);

  // Mulai mendengarkan (STT)
  const startListening = useCallback(() => {
    setErrorMessage(null);
    setTranscript('');
    transcriptRef.current = '';

    // Jika M.A.Y.A. sedang berbicara, hentikan langsung (Barge-in)
    if (ttsService.isSpeaking()) {
      ttsService.stop();
    }

    const isContinuous = settingsRef.current.voiceMode === 'hands_free';
    setVoiceState('listening');
    sttRef.current.start(isContinuous);
  }, []);

  // Berhenti mendengarkan & kirim transcript (PTT release atau klik stop)
  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // Jika ada teks transkrip di ref, kirim langsung
    if (transcriptRef.current.trim()) {
      submitTranscript();
    } else {
      sttRef.current.stop();
      setVoiceState('idle');
    }
  }, [submitTranscript]);

  // Batal bicara tanpa mengirim
  const cancelListening = useCallback(() => {
    stopAll();
  }, [stopAll]);

  // Putar respons suara via TTS (dengan Anti-Echo guard)
  const speakResponse = useCallback((text: string) => {
    if (!settingsRef.current.ttsEnabled) {
      setVoiceState('idle');
      return;
    }

    // Anti-Echo Guard: Jika headsetBargeIn FALSE, hentikan STT sementara agar tidak merekam suara speaker sendiri
    if (!settingsRef.current.headsetBargeIn) {
      sttRef.current.abort();
    }

    setVoiceState('speaking');

    ttsService.speak(text, settingsRef.current, {
      onStart: () => {
        setVoiceState('speaking');
      },
      onEnd: () => {
        setVoiceState('idle');

        // Jika mode Hands-Free, auto-resume STT setelah M.A.Y.A. selesai bicara
        if (settingsRef.current.voiceMode === 'hands_free' && !isGeneratingRef.current) {
          setTimeout(() => {
            if (voiceStateRef.current === 'idle') {
              startListening();
            }
          }, 400);
        }
      },
      onError: (err) => {
        console.warn('TTS error:', err);
        setVoiceState('idle');
      },
    });
  }, [startListening]);

  // Update Settings
  const updateSettings = useCallback((partial: Partial<VoiceSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      return next;
    });
  }, []);

  // Quick Toggle Mute/Unmute TTS
  const toggleTts = useCallback(() => {
    setSettings((prev) => {
      const nextEnabled = !prev.ttsEnabled;
      if (!nextEnabled) {
        ttsService.stop();
        if (voiceStateRef.current === 'speaking') {
          setVoiceState('idle');
        }
      }
      return { ...prev, ttsEnabled: nextEnabled };
    });
  }, []);

  return {
    voiceState,
    transcript,
    errorMessage,
    settings,
    isSpeaking: voiceState === 'speaking',
    isListening: voiceState === 'listening',
    isThinking: voiceState === 'thinking',
    startListening,
    stopListening,
    cancelListening,
    stopSpeaking: stopAll,
    speakResponse,
    updateSettings,
    toggleTts,
    isSttSupported: sttRef.current.isSupported(),
  };
}
