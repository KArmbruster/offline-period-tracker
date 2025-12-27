'use client';

import type { PhaseSymptomHistory } from '@/lib/cycle-logic';
import { PhaseType } from '@/types';
import { SymptomType } from '@/types';

interface PhaseSymptomsProps {
  phase: PhaseType | null;
  symptoms: PhaseSymptomHistory[];
}

const PHASE_NAMES: Record<PhaseType, string> = {
  [PhaseType.MENSTRUAL]: 'Menstrual',
  [PhaseType.FOLLICULAR]: 'Follicular',
  [PhaseType.FERTILE]: 'Fertile',
  [PhaseType.OVULATION]: 'Ovulation',
  [PhaseType.LUTEAL]: 'Luteal',
};

const PHASE_COLORS: Record<PhaseType, string> = {
  [PhaseType.MENSTRUAL]: 'bg-phase-menstrual',
  [PhaseType.FOLLICULAR]: 'bg-phase-follicular',
  [PhaseType.FERTILE]: 'bg-phase-fertile',
  [PhaseType.OVULATION]: 'bg-phase-ovulation',
  [PhaseType.LUTEAL]: 'bg-phase-luteal',
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
  [SymptomType.ACNE]: 'Acne',
  [SymptomType.INSOMNIA]: 'Insomnia',
  [SymptomType.CRAVINGS]: 'Cravings',
};

function getSymptomLabel(symptom: string): string {
  return SYMPTOM_LABELS[symptom] || symptom.replace(/_/g, ' ');
}

export default function PhaseSymptoms({ phase, symptoms }: PhaseSymptomsProps) {
  if (!phase || symptoms.length === 0) {
    return null;
  }

  const phaseName = PHASE_NAMES[phase];
  const phaseColor = PHASE_COLORS[phase];

  // Show top 5 symptoms
  const topSymptoms = symptoms.slice(0, 5);

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className={`h-3 w-3 rounded-full ${phaseColor}`} />
        <h3 className="text-sm font-medium text-gray-700">
          Common symptoms during {phaseName} phase
        </h3>
      </div>

      <p className="mb-3 text-xs text-gray-500">
        Based on your last 6 cycles
      </p>

      <div className="flex flex-wrap gap-2">
        {topSymptoms.map(({ symptom, percentage }) => (
          <div
            key={symptom}
            className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5"
          >
            <span className="text-sm text-gray-700">
              {getSymptomLabel(symptom)}
            </span>
            <span className="text-xs font-medium text-brand-red">
              {percentage}%
            </span>
          </div>
        ))}
      </div>

      {symptoms.length > 5 && (
        <p className="mt-2 text-xs text-gray-400">
          +{symptoms.length - 5} more symptoms tracked
        </p>
      )}
    </div>
  );
}
