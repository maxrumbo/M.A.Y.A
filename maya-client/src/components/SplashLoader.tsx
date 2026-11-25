import React from 'react';
import { MayaLogo } from './ui/MayaLogo';

interface SplashLoaderProps {
  visible: boolean;
  subtitle?: string;
}

export const SplashLoader: React.FC<SplashLoaderProps> = ({
  visible,
  subtitle = 'Menyiapkan asisten...',
}) => {
  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-0 z-[90] flex flex-col items-center justify-center bg-[#F8F9FA] dark:bg-[#0F1014] text-zinc-900 dark:text-zinc-100 transition-opacity duration-300 select-none ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="relative flex items-center justify-center">
        {/* Expanding SVG Hairline Ring */}
        <svg
          width="112"
          height="112"
          viewBox="0 0 112 112"
          className="absolute pointer-events-none"
          fill="none"
        >
          <circle
            cx="56"
            cy="56"
            r="46"
            strokeWidth="1.2"
            className="stroke-indigo-500/45 dark:stroke-indigo-400/45 animate-splash-ring"
          />
        </svg>

        <MayaLogo size={68} framed animated />
      </div>

      <h1 className="mt-6 text-base font-semibold tracking-[0.26em] text-zinc-900 dark:text-zinc-100">
        M.A.Y.A.
      </h1>

      <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>

      {/* Minimalist Solid Progress Track */}
      <div className="mt-6 w-28 h-[2px] rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
        <div className="h-full w-1/2 rounded-full bg-zinc-900 dark:bg-indigo-500 animate-splash-bar" />
      </div>
    </div>
  );
};
