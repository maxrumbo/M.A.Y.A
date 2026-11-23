import type { ISttProvider } from './types';

// Deklarasi type global SpeechRecognition untuk TypeScript
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export class WebSpeechSttProvider implements ISttProvider {
  private recognition: any = null;
  private isListening = false;
  private resultCallback: ((transcript: string, isFinal: boolean) => void) | null = null;
  private errorCallback: ((errorMessage: string, errorCode?: string) => void) | null = null;
  private endCallback: (() => void) | null = null;

  constructor() {
    this.initRecognition();
  }

  private initRecognition(): void {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'id-ID';
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = 0; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTranscript += item[0].transcript + ' ';
          } else {
            interimTranscript += item[0].transcript + ' ';
          }
        }

        const combined = (finalTranscript + interimTranscript).trim();
        if (combined) {
          this.resultCallback?.(combined, finalTranscript.trim().length > 0);
        }
      };

      this.recognition.onerror = (event: any) => {
        const errorType = event.error || 'unknown';

        // 'no-speech' dan 'aborted' adalah event normal saat jeda hening atau interupsi
        if (errorType === 'aborted') {
          return;
        }

        let userFriendlyMsg = `Error STT: ${errorType}`;
        switch (errorType) {
          case 'not-allowed':
          case 'permission-denied':
            userFriendlyMsg = 'Izin mikrofon ditolak oleh browser. Harap izinkan akses mic di address bar browser.';
            break;
          case 'network':
            userFriendlyMsg = 'Koneksi pengenalan suara terputus. Pastikan internet aktif (Web Speech butuh koneksi).';
            break;
          case 'audio-capture':
            userFriendlyMsg = 'Mikrofon tidak terdeteksi atau sedang dipakai oleh aplikasi lain.';
            break;
          case 'no-speech':
            userFriendlyMsg = 'Tidak ada suara yang terdengar.';
            break;
        }

        this.errorCallback?.(userFriendlyMsg, errorType);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.endCallback?.();
      };
    }
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  public start(continuous: boolean): void {
    if (!this.recognition) {
      this.initRecognition();
    }
    if (!this.recognition) {
      this.errorCallback?.('Browser ini belum mendukung Web Speech Recognition. Gunakan Chrome, Edge, atau Chromium.', 'not_supported');
      return;
    }

    if (this.isListening) {
      return;
    }

    try {
      this.recognition.continuous = continuous;
      this.recognition.start();
      this.isListening = true;
    } catch (err: any) {
      // Jika sudah started, abaikan error invalid state
      if (!err?.message?.includes('already started')) {
        this.isListening = false;
        this.errorCallback?.(`Gagal memulai mic: ${err?.message || err}`, 'start_failed');
      }
    }
  }

  public stop(): void {
    if (!this.recognition || !this.isListening) return;
    try {
      this.recognition.stop();
    } catch {
      // ignore
    } finally {
      this.isListening = false;
    }
  }

  public abort(): void {
    if (!this.recognition) return;
    try {
      this.recognition.abort();
    } catch {
      // ignore
    } finally {
      this.isListening = false;
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
}

export const defaultSttProvider: ISttProvider = new WebSpeechSttProvider();
