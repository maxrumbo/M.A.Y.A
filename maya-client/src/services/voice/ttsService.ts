import type { VoiceSettings } from './types';

/**
 * Membersihkan teks markdown menjadi teks naratif yang alami dibacakan oleh TTS.
 * Mencegah TTS mengeja simbol bintang, backticks, kode program panjang, atau tautan URL mentah.
 */
export function cleanTextForSpeech(markdown: string): string {
  if (!markdown) return '';

  let text = markdown;

  // 1. Ganti block code ```lang ... ``` dengan narasi singkat
  text = text.replace(/```[\s\S]*?```/g, 'kode program terlampir di chat.');

  // 2. Ganti inline code `code` menjadi teks biasa
  text = text.replace(/`([^`]+)`/g, '$1');

  // 3. Ganti link markdown [label](url) menjadi hanya label
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 4. Ganti URL mentah menjadi kata 'tautan web'
  text = text.replace(/https?:\/\/\S+/gi, 'tautan web');

  // 5. Bersihkan formatting markdown: headings, bold, italic, strikethrough, quote
  text = text.replace(/^#+\s+/gm, '');             // Headings
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');  // Bold
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');     // Italic
  text = text.replace(/~~(.*?)~~/g, '$1');         // Strikethrough
  text = text.replace(/^\s*>\s+/gm, '');           // Blockquotes
  text = text.replace(/^\s*[-*+]\s+/gm, '');       // List bullets
  text = text.replace(/^\s*\d+\.\s+/gm, '');       // Numbered lists

  // 6. Bersihkan baris kosong berlebih & trim
  text = text.replace(/\n{2,}/g, '. ').replace(/\n/g, ' ');
  text = text.replace(/\s{2,}/g, ' ').trim();

  return text;
}

export class TtsService {
  private voices: SpeechSynthesisVoice[] = [];
  private isInitialized = false;

  constructor() {
    this.initVoices();
  }

  private initVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const loadVoices = () => {
      this.voices = window.speechSynthesis.getVoices();
      if (this.voices.length > 0) {
        this.isInitialized = true;
      }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.isInitialized || this.voices.length === 0) {
      this.voices = window.speechSynthesis.getVoices();
    }
    return this.voices;
  }

  public getIndonesianVoices(): SpeechSynthesisVoice[] {
    const all = this.getAvailableVoices();
    return all.filter((v) => v.lang.toLowerCase().startsWith('id'));
  }

  public getPreferredVoice(selectedUri?: string | null): SpeechSynthesisVoice | null {
    const all = this.getAvailableVoices();
    if (all.length === 0) return null;

    if (selectedUri) {
      const matched = all.find((v) => v.voiceURI === selectedUri);
      if (matched) return matched;
    }

    // Prioritas suara PEREMPUAN Indonesia (Gadis / Female / Google Bahasa Indonesia non-male)
    const isMaleVoice = (v: SpeechSynthesisVoice) => {
      const n = `${v.name} ${v.voiceURI}`.toLowerCase();
      return (
        n.includes('ardi') ||
        n.includes('male') ||
        n.includes('id-id-x-dfz') ||
        n.includes('id-id-x-idd')
      );
    };

    const isFemaleHint = (v: SpeechSynthesisVoice) => {
      const n = `${v.name} ${v.voiceURI}`.toLowerCase();
      return (
        n.includes('gadis') ||
        n.includes('female') ||
        n.includes('perempuan') ||
        n.includes('damayanti') ||
        n.includes('id-id-x-idc') ||
        n.includes('id-id-x-ide')
      );
    };

    const idVoices = this.getIndonesianVoices();
    if (idVoices.length > 0) {
      // 1. Microsoft Gadis / explicit female Indonesian voice
      const gadis = idVoices.find((v) => v.name.toLowerCase().includes('gadis'));
      if (gadis) return gadis;

      const femaleId = idVoices.find((v) => isFemaleHint(v) && !isMaleVoice(v));
      if (femaleId) return femaleId;

      // 2. Google Bahasa Indonesia / Natural voice yang bukan suara laki-laki
      const googleOrNatural = idVoices.find(
        (v) =>
          !isMaleVoice(v) &&
          (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Online'))
      );
      if (googleOrNatural) return googleOrNatural;

      // 3. Voice id-ID apa pun yang bukan male
      const nonMaleId = idVoices.find((v) => !isMaleVoice(v));
      return nonMaleId || idVoices[0];
    }

    // Fallback: suara perempuan default sistem bila voice id-ID tidak tersedia
    const femaleFallback = all.find((v) => {
      const n = v.name.toLowerCase();
      return (
        n.includes('gadis') ||
        n.includes('female') ||
        n.includes('zira') ||
        n.includes('samantha') ||
        n.includes('aria')
      );
    });

    return femaleFallback || all.find((v) => v.default) || all[0];
  }

  public speak(
    text: string,
    settings: VoiceSettings,
    callbacks?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    }
  ): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      callbacks?.onEnd?.();
      return;
    }

    // Cancel ucapan sebelumnya jika masih bersuara
    this.stop();

    if (!settings.ttsEnabled) {
      callbacks?.onEnd?.();
      return;
    }

    const clean = cleanTextForSpeech(text);
    if (!clean) {
      callbacks?.onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'id-ID';
    utterance.rate = settings.ttsRate ?? 1.05;
    utterance.pitch = settings.ttsPitch ?? 1.0;

    const voice = this.getPreferredVoice(settings.selectedVoiceUri);
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      callbacks?.onStart?.();
    };

    utterance.onend = () => {
      callbacks?.onEnd?.();
    };

    utterance.onerror = (e) => {
      // Jangan trigger error jika cancel intentional
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        callbacks?.onError?.(e);
      }
      callbacks?.onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  }

  public stop(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public isSpeaking(): boolean {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      return window.speechSynthesis.speaking;
    }
    return false;
  }
}

export const ttsService = new TtsService();
