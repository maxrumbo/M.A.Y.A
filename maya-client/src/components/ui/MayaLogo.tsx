import React from 'react';

interface MayaLogoProps {
  size?: number;
  framed?: boolean;
  animated?: boolean;
  className?: string;
}

export const MayaLogo: React.FC<MayaLogoProps> = ({
  size = 40,
  framed = true,
  animated = false,
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-label="M.A.Y.A."
    >
      {framed && (
        <rect
          width="64"
          height="64"
          rx="16"
          fill="#121318"
          className="stroke-zinc-800/40 dark:stroke-zinc-700/50"
          strokeWidth="1"
        />
      )}

      <path
        d="M17 44V23L32 36L47 23V44"
        stroke={framed ? '#F8F9FA' : 'currentColor'}
        strokeWidth="4.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={animated ? 'animate-logo-draw' : undefined}
        style={
          animated
            ? {
                strokeDasharray: 100,
                strokeDashoffset: 100,
              }
            : undefined
        }
      />

      <circle
        cx="32"
        cy="18"
        r="3.2"
        fill="#6366F1"
        className={animated ? 'animate-logo-dot-pop' : undefined}
      />
    </svg>
  );
};
