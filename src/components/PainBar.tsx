'use client';

interface PainBarProps {
  /** Average pain on the 1-10 scale */
  average: number;
  /** Smaller text for use inside compact cards */
  compact?: boolean;
}

/**
 * Average pain as a ten-step bar, so levels can be compared at a glance
 */
export default function PainBar({ average, compact = false }: PainBarProps) {
  const label = average.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <div>
      <div className={`flex items-baseline justify-between ${compact ? 'text-xs' : 'text-sm'}`}>
        <span className="text-gray-800">Average pain</span>
        <span className="text-gray-500">{label} of 10</span>
      </div>
      <div
        className="mt-1 flex gap-0.5"
        role="img"
        aria-label={`Average pain ${label} of 10`}
      >
        {Array.from({ length: 10 }, (_, step) => {
          // Each step fills completely, partly (for the fraction) or not at all
          const fill = Math.max(0, Math.min(1, average - step));
          return (
            <div key={step} className="h-2.5 flex-1 overflow-hidden rounded-sm bg-gray-100">
              <div className="h-full bg-brand-red" style={{ width: `${fill * 100}%` }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
