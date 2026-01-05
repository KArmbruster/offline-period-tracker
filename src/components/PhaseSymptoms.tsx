'use client';

import type { PhaseSymptomHistory } from '@/lib/cycle-logic';
import { getSymptomLabel, isPeriodPainSymptom, calculateAveragePain } from '@/lib/symptom-utils';
import type { CustomSymptomType } from '@/types';
import { PhaseType } from '@/types';

interface PhaseSymptomsProps {
  phase: PhaseType | null;
  symptoms: PhaseSymptomHistory[];
  customSymptomTypes: CustomSymptomType[];
  cyclesAnalyzed: number;
  nextPeriodInfo: { daysUntil: number; isOverdue: boolean } | null;
}

const PHASE_NAMES: Record<PhaseType, string> = {
  [PhaseType.MENSTRUAL]: 'Menstrual',
  [PhaseType.FOLLICULAR]: 'Follicular',
  [PhaseType.FERTILE]: 'Fertile',
  [PhaseType.OVULATION]: 'Ovulation',
  [PhaseType.LUTEAL]: 'Luteal',
};

const PHASE_COLORS: Record<PhaseType, { bg: string; text: string }> = {
  [PhaseType.MENSTRUAL]: { bg: 'bg-phase-menstrual', text: 'text-phase-menstrual' },
  [PhaseType.FOLLICULAR]: { bg: 'bg-phase-follicular', text: 'text-black' },
  [PhaseType.FERTILE]: { bg: 'bg-phase-fertile', text: 'text-phase-fertile' },
  [PhaseType.OVULATION]: { bg: 'bg-phase-ovulation', text: 'text-phase-ovulation' },
  [PhaseType.LUTEAL]: { bg: 'bg-phase-luteal', text: 'text-phase-luteal' },
};

export default function PhaseSymptoms({
  phase,
  symptoms,
  customSymptomTypes,
  cyclesAnalyzed,
  nextPeriodInfo,
}: PhaseSymptomsProps) {
  if (!phase) {
    return null;
  }

  const phaseName = PHASE_NAMES[phase];
  const phaseColors = PHASE_COLORS[phase];

  return (
    <div className="mt-4 space-y-3">
      {/* Current Phase */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${phaseColors.bg}`} />
          <span className="text-sm text-gray-500">Current phase:</span>
          <span className="font-medium text-gray-900">{phaseName}</span>
        </div>
      </div>

      {/* Common Symptoms for Phase */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-2 flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${phaseColors.bg}`} />
          <h3 className="text-sm font-medium text-gray-900">
            Common symptoms
          </h3>
        </div>
        {(() => {
          const nonPainSymptoms = symptoms.filter((s) => !isPeriodPainSymptom(s.symptom));
          const avgPain = calculateAveragePain(symptoms);
          const hasSymptoms = nonPainSymptoms.length > 0 || avgPain !== null;

          return hasSymptoms ? (
            <div className="flex flex-wrap gap-2">
              {nonPainSymptoms.map(({ symptom, occurrences }) => (
                <div
                  key={symptom}
                  className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1"
                >
                  <span className="text-xs text-gray-700">
                    {getSymptomLabel(symptom, customSymptomTypes)}
                  </span>
                  <span className={`text-xs font-medium ${phaseColors.text}`}>
                    {occurrences}/{cyclesAnalyzed}
                  </span>
                </div>
              ))}
              {avgPain !== null && (
                <div className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1">
                  <span className="text-xs text-gray-700">
                    Pain (Ø {avgPain.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })})
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              No symptoms recorded for this phase yet
            </p>
          );
        })()}
      </div>

      {/* Next Period Prediction */}
      {nextPeriodInfo && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          {nextPeriodInfo.isOverdue ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-phase-menstrual">
                  Period is {Math.abs(nextPeriodInfo.daysUntil)} days late
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Tap a date in the calendar to log your period start
              </p>
            </div>
          ) : nextPeriodInfo.daysUntil === 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Period expected:</span>
              <span className="font-medium text-phase-menstrual">Today</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Next period in:</span>
              <span className="font-medium text-gray-900">
                {nextPeriodInfo.daysUntil} {nextPeriodInfo.daysUntil === 1 ? 'day' : 'days'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
