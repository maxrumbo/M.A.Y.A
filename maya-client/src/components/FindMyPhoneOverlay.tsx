import React from 'react';
import { BellRing, Square } from 'lucide-react';

interface FindMyPhoneOverlayProps {
  message: string;
  onStop: () => void;
}

export const FindMyPhoneOverlay: React.FC<FindMyPhoneOverlayProps> = ({
  message,
  onStop,
}) => {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-zinc-950/95 backdrop-blur-md p-6 text-center select-none">
      <div className="relative mb-8">
        <div className="absolute inset-0 rounded-full bg-indigo-500/30 animate-ping" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-indigo-600/20 border-2 border-indigo-400 text-indigo-300 shadow-2xl">
          <BellRing className="h-12 w-12 animate-bounce" />
        </div>
      </div>

      <h1 className="text-2xl font-bold tracking-wide text-zinc-100">
        Find My Phone Aktif
      </h1>
      <p className="mt-2 max-w-xs text-sm text-zinc-300">
        &ldquo;{message}&rdquo;
      </p>
      <p className="mt-1 text-xs font-mono text-zinc-500">
        Volume alarm akan otomatis kembali normal setelah dihentikan.
      </p>

      <button
        type="button"
        onClick={onStop}
        className="mt-10 flex items-center justify-center space-x-3 w-full max-w-xs py-5 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-semibold text-base shadow-xl shadow-red-600/30 transition-all"
      >
        <Square className="h-5 w-5 fill-white" />
        <span>STOP ALARM</span>
      </button>
    </div>
  );
};
