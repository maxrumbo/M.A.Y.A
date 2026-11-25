import React from 'react';
import type { VoiceState } from '../../services/voice/types';

interface VoiceSvgVisualizerProps {
  state: VoiceState;
  onClick?: () => void;
  label?: string;
}

// 15 harmonic acoustic bars arranged symmetrically around x=120
const BAR_CONFIG = [
  { maxH: 22, dur: 0.62, delay: 0.04 },
  { maxH: 34, dur: 0.74, delay: 0.12 },
  { maxH: 50, dur: 0.56, delay: 0.22 },
  { maxH: 64, dur: 0.68, delay: 0.08 },
  { maxH: 44, dur: 0.82, delay: 0.31 },
  { maxH: 74, dur: 0.52, delay: 0.17 },
  { maxH: 86, dur: 0.64, delay: 0.05 },
  { maxH: 94, dur: 0.58, delay: 0.26 },
  { maxH: 82, dur: 0.72, delay: 0.14 },
  { maxH: 68, dur: 0.54, delay: 0.29 },
  { maxH: 48, dur: 0.78, delay: 0.09 },
  { maxH: 62, dur: 0.61, delay: 0.21 },
  { maxH: 46, dur: 0.75, delay: 0.34 },
  { maxH: 32, dur: 0.66, delay: 0.16 },
  { maxH: 20, dur: 0.84, delay: 0.24 },
];

export const VoiceSvgVisualizer: React.FC<VoiceSvgVisualizerProps> = ({
  state,
  onClick,
  label,
}) => {
  const isListening = state === 'listening';
  const isSpeaking = state === 'speaking';
  const isThinking = state === 'thinking';
  const isIdle = state === 'idle';

  const startX = 120 - ((BAR_CONFIG.length - 1) * 9) / 2;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label || 'Aktivasi Suara M.A.Y.A.'}
      className="group relative inline-flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.98] transition-transform cursor-pointer select-none"
    >
      <svg
        viewBox="0 0 240 240"
        className="w-52 h-52 sm:w-60 sm:h-60 overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Concentric Ripple Rings (Listening) */}
        {isListening && (
          <>
            <circle
              cx="120"
              cy="120"
              r="98"
              strokeWidth="1.5"
              className="stroke-indigo-500/60 dark:stroke-indigo-400/60 svg-center-origin animate-svg-ring-ripple"
            />
            <circle
              cx="120"
              cy="120"
              r="98"
              strokeWidth="1"
              className="stroke-indigo-500/40 dark:stroke-indigo-400/40 svg-center-origin animate-svg-ring-ripple-delay"
            />
          </>
        )}

        {/* Harmonic Outer Rings (Speaking) */}
        {isSpeaking && (
          <>
            <circle
              cx="120"
              cy="120"
              r="102"
              strokeWidth="1.25"
              className="stroke-zinc-400/50 dark:stroke-zinc-600/70 svg-center-origin animate-svg-breathe"
            />
            <circle
              cx="120"
              cy="120"
              r="94"
              strokeWidth="1.5"
              className="stroke-indigo-500/50 dark:stroke-indigo-400/50 svg-center-origin animate-svg-ring-ripple"
            />
          </>
        )}

        {/* Precision Counter-Rotating Orbital Arcs (Thinking) */}
        {isThinking && (
          <>
            <circle
              cx="120"
              cy="120"
              r="98"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="48 160"
              className="stroke-indigo-600 dark:stroke-indigo-400 svg-center-origin animate-svg-arc-spin"
            />
            <circle
              cx="120"
              cy="120"
              r="91"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeDasharray="28 110"
              className="stroke-zinc-400 dark:stroke-zinc-600 svg-center-origin animate-svg-arc-spin-rev"
            />
          </>
        )}

        {/* Serene Outer Hairline Ring (Idle) */}
        {isIdle && (
          <circle
            cx="120"
            cy="120"
            r="96"
            strokeWidth="1.2"
            className="stroke-zinc-300 dark:stroke-zinc-800 svg-center-origin animate-svg-breathe"
          />
        )}

        {/* Solid Inner Surface Disc */}
        <circle
          cx="120"
          cy="120"
          r="82"
          strokeWidth="1.5"
          className={`transition-colors duration-300 fill-white dark:fill-[#17191F] ${
            isListening || isThinking
              ? 'stroke-indigo-500/80 dark:stroke-indigo-400/80'
              : 'stroke-zinc-200 dark:stroke-zinc-800 group-hover:stroke-zinc-300 dark:group-hover:stroke-zinc-700'
          }`}
        />

        {/* Twin Smooth Cubic Bezier Harmonic Waves (Active Speech / Listening) */}
        {(isListening || isSpeaking) && (
          <g className="animate-svg-wave">
            <path
              d="M 52 120 C 74 96, 98 144, 120 120 C 142 96, 166 144, 188 120"
              strokeWidth="1.6"
              strokeLinecap="round"
              className="stroke-indigo-500/45 dark:stroke-indigo-400/45"
            />
            <path
              d="M 56 120 C 80 140, 100 100, 120 120 C 140 140, 160 100, 184 120"
              strokeWidth="1.2"
              strokeLinecap="round"
              className="stroke-zinc-400/40 dark:stroke-zinc-500/40"
            />
          </g>
        )}

        {/* 15 Generative SVG Acoustic Waveform Bars */}
        <g>
          {BAR_CONFIG.map((bar, idx) => {
            const x = startX + idx * 9 - 2;
            const isCenterPulse = idx >= 6 && idx <= 8;

            if (isThinking) {
              const h = isCenterPulse ? 26 : 6;
              const y = 120 - h / 2;
              return (
                <rect
                  key={idx}
                  x={x}
                  y={y}
                  width="4"
                  height={h}
                  rx="2"
                  className={`svg-bar-origin transition-all duration-300 ${
                    isCenterPulse
                      ? 'fill-indigo-600 dark:fill-indigo-400'
                      : 'fill-zinc-300 dark:fill-zinc-800'
                  }`}
                  style={
                    isCenterPulse
                      ? {
                          animation: `svg-bar-think 0.9s ease-in-out ${(idx - 6) * 0.18}s infinite`,
                        }
                      : undefined
                  }
                />
              );
            }

            if (isIdle) {
              const calmH = Math.max(8, Math.round(bar.maxH * 0.24));
              const y = 120 - calmH / 2;
              const isMidAccent = idx === 7;
              return (
                <rect
                  key={idx}
                  x={x}
                  y={y}
                  width="4"
                  height={calmH}
                  rx="2"
                  className={`svg-bar-origin transition-all duration-300 ${
                    isMidAccent
                      ? 'fill-indigo-600 dark:fill-indigo-400'
                      : 'fill-zinc-800/75 dark:fill-zinc-200/80'
                  }`}
                  style={{
                    animation: `svg-breathe-calm 3.6s ease-in-out ${bar.delay}s infinite`,
                  }}
                />
              );
            }

            const y = 120 - bar.maxH / 2;
            const animName = isListening ? 'svg-bar-wave' : 'svg-bar-speak';
            const speed = isListening ? bar.dur : bar.dur * 0.9;
            const barFill =
              idx === 7 || idx === 5 || idx === 9
                ? 'fill-indigo-600 dark:fill-indigo-400'
                : 'fill-zinc-900 dark:fill-zinc-100';

            return (
              <rect
                key={idx}
                x={x}
                y={y}
                width="4"
                height={bar.maxH}
                rx="2"
                className={`svg-bar-origin ${barFill}`}
                style={{
                  animation: `${animName} ${speed.toFixed(2)}s ease-in-out ${bar.delay}s infinite`,
                }}
              />
            );
          })}
        </g>
      </svg>
    </button>
  );
};
