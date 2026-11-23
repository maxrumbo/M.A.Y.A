export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export type VoiceMode = 'ptt' | 'hands_free';

export interface VoiceSettings {
  ttsEnabled: boolean;
  voiceMode: VoiceMode;
  ttsRate: number;            // 0.8 - 1.5 (default 1.05)
  ttsPitch: number;           // 0.8 - 1.2 (default 1.0)
  selectedVoiceUri: string | null;
  headsetBargeIn: boolean;    // Anti-Echo Guard: false = auto-pause STT saat TTS bicara
  autoSendDelayMs: number;    // VAD silence detection timer (default 1800ms)
}

export interface ISttProvider {
  isSupported(): boolean;
  start(continuous: boolean): void;
  stop(): void;
  abort(): void;
  onResult(callback: (transcript: string, isFinal: boolean) => void): void;
  onError(callback: (errorMessage: string, errorCode?: string) => void): void;
  onEnd(callback: () => void): void;
}
