'use client';

import type { PhaseSymptomHistory } from '@/lib/cycle-logic';
import type { CustomSymptomType } from '@/types';
import { PhaseType } from '@/types';
import { SymptomType } from '@/types';

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

const SYMPTOM_LABELS: Record<string, string> = {
  [SymptomType.CRAMPS]: 'Cramps',
  [SymptomType.HEADACHE]: 'Headache',
  [SymptomType.BLOATING]: 'Bloating',
  [SymptomType.BREAST_TENDERNESS]: 'Breast Tenderness',
  [SymptomType.FATIGUE]: 'Fatigue',
  [SymptomType.BACKACHE]: 'Backache',
  [SymptomType.NAUSEA]: 'Nausea',
  [SymptomType.FLOW_LIGHT]: 'Light Flow',
  [SymptomType.FLOW_MEDIUM]: 'Medium Flow',
  [SymptomType.FLOW_HEAVY]: 'Heavy Flow',
  [SymptomType.SPOTTING]: 'Spotting',
  [SymptomType.MOOD_HAPPY]: 'Happy',
  [SymptomType.MOOD_SAD]: 'Sad',
  [SymptomType.MOOD_IRRITABLE]: 'Irritable',
  [SymptomType.MOOD_ANXIOUS]: 'Anxious',
  [SymptomType.MOOD_CALM]: 'Calm',
  [SymptomType.MOOD_HORNY]: 'Horny',
  [SymptomType.ACNE]: 'Acne',
  [SymptomType.INSOMNIA]: 'Insomnia',
  [SymptomType.CRAVINGS]: 'Cravings',
};

function getSymptomLabel(symptom: string, customTypes: CustomSymptomType[]): string {
  // Check if it's a built-in symptom
  if (SYMPTOM_LABELS[symptom]) {
    return SYMPTOM_LABELS[symptom];
  }

  // Check if it's a custom symptom (format: custom_${id})
  if (symptom.startsWith('custom_')) {
    const customId = parseInt(symptom.replace('custom_', ''), 10);
    const customType = customTypes.find((c) => c.id === customId);
    if (customType) {
      return customType.name;
    }
  }

  // Fallback: replace underscores with spaces
  return symptom.replace(/_/g, ' ');
}

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
        {symptoms.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {symptoms.map(({ symptom, occurrences }) => (
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
        ) : (
          <p className="text-xs text-gray-500">
            No symptoms recorded for this phase yet
          </p>
        )}
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
