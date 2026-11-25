import React from 'react';

interface CircularGaugeProps {
  label: string;
  value: number | null | undefined;
  unit?: string;
  strokeColor: string;
  subtitle?: string;
  offline?: boolean;
}

export const CircularGauge: React.FC<CircularGaugeProps> = ({
  label,
  value,
  unit = '%',
  strokeColor,
  subtitle,
  offline = false,
}) => {
  const safeValue =
    !offline && typeof value === 'number' && !Number.isNaN(value)
      ? Math.max(0, Math.min(100, value))
      : null;

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progressOffset =
    safeValue !== null
      ? circumference - (safeValue / 100) * circumference
      : circumference;

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#17191F] p-3 sm:p-4 flex flex-col items-center justify-center text-center transition-colors">
      <div className="relative h-16 w-16 sm:h-20 sm:w-20 flex items-center justify-center">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 72 72">
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill="none"
            strokeWidth="5.5"
            className="stroke-zinc-100 dark:stroke-zinc-800"
          />
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill="none"
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={progressOffset}
            className={`transition-all duration-500 ${strokeColor}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs sm:text-sm font-semibold font-mono text-zinc-900 dark:text-zinc-100">
            {safeValue !== null ? `${Math.round(safeValue)}${unit}` : '--'}
          </span>
        </div>
      </div>

      <p className="mt-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200">{label}</p>
      {subtitle && (
        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate max-w-full">
          {subtitle}
        </p>
      )}
    </div>
  );
};
