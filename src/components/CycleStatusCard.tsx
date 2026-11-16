'use client';

import { format, parseISO } from 'date-fns';
import { PhaseType } from '@/types';

interface CycleStatusCardProps {
  phase: PhaseType | null;
  isFertile: boolean;
  cycleDay: number | null;
  nextPeriodInfo: { daysUntil: number; predictedDate: string; isOverdue: boolean } | null;
}

const PHASE_TITLES: Record<PhaseType, string> = {
  [PhaseType.MENSTRUAL]: 'Menstrual phase',
  [PhaseType.FOLLICULAR]: 'Follicular phase',
  [PhaseType.FERTILE]: 'Fertile window',
  [PhaseType.OVULATION]: 'Ovulation day',
  [PhaseType.LUTEAL]: 'Luteal phase',
};

const PHASE_RING: Record<PhaseType, string> = {
  [PhaseType.MENSTRUAL]: 'border-phase-menstrual',
  [PhaseType.FOLLICULAR]: 'border-phase-follicular',
  [PhaseType.FERTILE]: 'border-phase-fertile',
  [PhaseType.OVULATION]: 'border-phase-ovulation-strong',
  [PhaseType.LUTEAL]: 'border-phase-luteal',
};

function pluralDays(count: number): string {
  return `${count} ${count === 1 ? 'day' : 'days'}`;
}

/**
 * Summary of where today sits in the cycle, shown above the calendar
 */
export default function CycleStatusCard({
  phase,
  isFertile,
  cycleDay,
  nextPeriodInfo,
}: CycleStatusCardProps) {
  // No phase means the last logged period is too long ago to say anything
  if (!phase) {
    return (
      <div className="mb-4 rounded-2xl border border-brand-pink/30 bg-white p-4">
        <p className="font-semibold text-gray-900">No recent period logged</p>
        <p className="text-sm text-gray-600">
          Tap a date in the calendar to log your latest period start and resume predictions.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 flex items-center gap-4 rounded-2xl border border-brand-pink/30 bg-white p-4">
      {cycleDay !== null && (
        <div
          className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border-4 ${PHASE_RING[phase]}`}
        >
          <span className="text-xs leading-none text-gray-500">Day</span>
          <span className="text-xl font-semibold leading-tight text-gray-900">{cycleDay}</span>
        </div>
      )}
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-tight text-gray-900">{PHASE_TITLES[phase]}</p>
        {nextPeriodInfo &&
          (nextPeriodInfo.isOverdue ? (
            <>
              <p className="text-sm font-medium text-phase-menstrual">
                Period is {pluralDays(Math.abs(nextPeriodInfo.daysUntil))} late
              </p>
              <p className="text-xs text-gray-500">Tap a date to log your period start</p>
            </>
          ) : nextPeriodInfo.daysUntil === 0 ? (
            <p className="text-sm font-medium text-phase-menstrual">Period expected today</p>
          ) : (
            <p className="text-sm text-gray-600">
              Period in about {pluralDays(nextPeriodInfo.daysUntil)}
              <span className="text-gray-400"> · </span>
              {format(parseISO(nextPeriodInfo.predictedDate), 'EEE d MMM')}
            </p>
          ))}
        {isFertile && (
          <p className="text-sm text-phase-ovulation-strong">Fertile window (estimate)</p>
        )}
      </div>
    </div>
  );
}
