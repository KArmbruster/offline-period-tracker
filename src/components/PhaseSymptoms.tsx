'use client';

import type { PhaseSymptomHistory } from '@/lib/cycle-logic';
import { getSymptomLabel, isPeriodPainSymptom, calculateAveragePain } from '@/lib/symptom-utils';
import PainBar from '@/components/PainBar';
import type { CustomSymptomType } from '@/types';
import { PhaseType } from '@/types';

interface PhaseSymptomsProps {
  phase: PhaseType | null;
  symptoms: PhaseSymptomHistory[];
  customSymptomTypes: CustomSymptomType[];
  cyclesAnalyzed: number;
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
  [PhaseType.FOLLICULAR]: { bg: 'bg-phase-follicular', text: 'text-phase-follicular-ink' },
  [PhaseType.FERTILE]: { bg: 'bg-phase-fertile', text: 'text-phase-fertile' },
  [PhaseType.OVULATION]: { bg: 'bg-phase-ovulation-strong', text: 'text-phase-ovulation-strong' },
  [PhaseType.LUTEAL]: { bg: 'bg-phase-luteal', text: 'text-phase-luteal-ink' },
};

export default function PhaseSymptoms({
  phase,
  symptoms,
  customSymptomTypes,
  cyclesAnalyzed,
}: PhaseSymptomsProps) {
  if (!phase) {
    return null;
  }

  const phaseName = PHASE_NAMES[phase];
  const phaseColors = PHASE_COLORS[phase];

  return (
    <div className="mt-4 space-y-3">
      {/* Common Symptoms for Phase */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-2 flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${phaseColors.bg}`} />
          <h3 className="text-sm font-medium text-gray-900">
            Common in your {phaseName.toLowerCase()} phase
          </h3>
        </div>
        {(() => {
          const nonPainSymptoms = symptoms.filter((s) => !isPeriodPainSymptom(s.symptom));
          const avgPain = calculateAveragePain(symptoms);
          const hasSymptoms = nonPainSymptoms.length > 0 || avgPain !== null;

          return hasSymptoms ? (
            <div className="space-y-3">
              {nonPainSymptoms.length > 0 && (
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
                </div>
              )}
              {avgPain !== null && <PainBar average={avgPain} compact />}
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              No symptoms recorded for this phase yet
            </p>
          );
        })()}
      </div>
    </div>
  );
}
