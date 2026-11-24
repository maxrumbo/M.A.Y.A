import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import type { ISttProvider } from './types';

/**
 * Phase 7: Native Android/iOS STT Provider berbasis @capacitor-community/speech-recognition.
 * Menggunakan kontrak ISttProvider yang sama persis dengan WebSpeechSttProvider sehingga
 * seluruh logika useVoiceAssistant (anti-echo, VAD, auto-send, error handling) langsung bekerja di APK.
 */
export class CapacitorSttProvider implements ISttProvider {
  private isListening = false;
  private resultCallback: ((transcript: string, isFinal: boolean) => void) | null = null;
  private errorCallback: ((errorMessage: string, errorCode?: string) => void) | null = null;
  private endCallback: (() => void) | null = null;

  private partialHandle: PluginListenerHandle | null = null;
  private stateHandle: PluginListenerHandle | null = null;
  private listenersBound = false;

  public isSupported(): boolean {
    return Capacitor.isNativePlatform();
  }

  private async ensureListeners(): Promise<void> {
    if (this.listenersBound) return;

    this.partialHandle = await SpeechRecognition.addListener('partialResults', (data) => {
      const best = data?.matches?.[0]?.trim();
      if (best) {
        this.resultCallback?.(best, false);
      }
    });

    this.stateHandle = await SpeechRecognition.addListener('listeningState', (data) => {
      if (data?.status === 'started') {
        this.isListening = true;
      } else if (data?.status === 'stopped') {
        const wasListening = this.isListening;
        this.isListening = false;
        if (wasListening) {
          this.endCallback?.();
        }
      }
    });

    this.listenersBound = true;
  }

  public start(_continuous: boolean): void {
    if (this.isListening) return;

    void this.startAsync();
  }

  private async startAsync(): Promise<void> {
    try {
      const avail = await SpeechRecognition.available();
      if (!avail.available) {
        this.errorCallback?.(
          'Layanan pengenalan suara Google/Android tidak tersedia di perangkat ini.',
          'not_supported'
        );
        return;
      }

      const perm = await SpeechRecognition.checkPermissions();
      if (perm.speechRecognition !== 'granted') {
        const requested = await SpeechRecognition.requestPermissions();
        if (requested.speechRecognition !== 'granted') {
          this.errorCallback?.(
            'Izin mikrofon ditolak. Aktifkan izin Mikrofon untuk M.A.Y.A. di Setelan Android.',
            'not-allowed'
          );
          return;
        }
      }

      await this.ensureListeners();
      this.isListening = true;

      // partialResults: true + popup: false agar live transcript mengalir langsung ke UI VoiceWaveIndicator
      const res = await SpeechRecognition.start({
        language: 'id-ID',
        maxResults: 1,
        partialResults: true,
        popup: false,
      });

      const directMatch = res?.matches?.[0]?.trim();
      if (directMatch) {
        this.resultCallback?.(directMatch, true);
      }
    } catch (err: any) {
      const wasListening = this.isListening;
      this.isListening = false;

      const rawMsg = String(err?.message || err || '').toLowerCase();
      if (rawMsg.includes('permission') || rawMsg.includes('denied')) {
        this.errorCallback?.(
          'Izin mikrofon ditolak. Aktifkan izin Mikrofon di Setelan aplikasi.',
          'not-allowed'
        );
      } else if (rawMsg.includes('no match') || rawMsg.includes('timeout')) {
        // Jeda hening tanpa kata — biarkan onEnd menutup secara normal
        if (wasListening) {
          this.endCallback?.();
        }
      } else if (rawMsg.includes('network')) {
        this.errorCallback?.(
          'Koneksi pengenalan suara terputus. Pastikan internet HP aktif.',
          'network'
        );
      } else if (rawMsg.includes('busy')) {
        this.errorCallback?.('Mikrofon sedang digunakan oleh aplikasi lain.', 'audio-capture');
      } else {
        this.errorCallback?.(`Gagal pengenalan suara: ${err?.message || err}`, 'native_error');
      }
    }
  }

  public stop(): void {
    if (!this.isListening) return;
    this.isListening = false;
    void SpeechRecognition.stop()
      .catch(() => {})
      .finally(() => {
        this.endCallback?.();
      });
  }

  public abort(): void {
    const wasListening = this.isListening;
    this.isListening = false;
    if (wasListening) {
      void SpeechRecognition.stop().catch(() => {});
    }
  }

  public onResult(callback: (transcript: string, isFinal: boolean) => void): void {
    this.resultCallback = callback;
  }

  public onError(callback: (errorMessage: string, errorCode?: string) => void): void {
    this.errorCallback = callback;
  }

  public onEnd(callback: () => void): void {
    this.endCallback = callback;
  }

  public async dispose(): Promise<void> {
    this.abort();
    await this.partialHandle?.remove();
    await this.stateHandle?.remove();
    this.partialHandle = null;
    this.stateHandle = null;
    this.listenersBound = false;
  }
}
