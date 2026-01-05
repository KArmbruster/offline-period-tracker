import { SymptomType } from '@/types';
import type { CustomSymptomType } from '@/types';

// Symptom labels for display
export const SYMPTOM_LABELS: Record<string, string> = {
  [SymptomType.CRAMPS]: 'Cramps',
  [SymptomType.HEADACHE]: 'Headache',
  [SymptomType.BLOATING]: 'Bloating',
  [SymptomType.BREAST_TENDERNESS]: 'Breast Tenderness',
  [SymptomType.FATIGUE]: 'Fatigue',
  [SymptomType.BACKACHE]: 'Backache',
  [SymptomType.NAUSEA]: 'Nausea',
  [SymptomType.ACNE]: 'Acne',
  [SymptomType.INSOMNIA]: 'Insomnia',
  [SymptomType.CRAVINGS]: 'Cravings',
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
};

/**
 * Get display label for a symptom, handling both built-in and custom symptoms
 */
export function getSymptomLabel(symptom: string, customTypes: CustomSymptomType[]): string {
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

/**
 * Check if a symptom is a period pain level
 */
export function isPeriodPainSymptom(symptom: string): boolean {
  return symptom.startsWith('period_pain_');
}

/**
 * Extract pain level number from symptom type
 */
export function getPainLevel(symptom: string): number {
  const match = symptom.match(/period_pain_(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Calculate average pain from symptom history
 */
export function calculateAveragePain(
  symptoms: Array<{ symptom: string; occurrences: number }>
): number | null {
  const painSymptoms = symptoms.filter((s) => isPeriodPainSymptom(s.symptom));
  if (painSymptoms.length === 0) return null;

  let totalPain = 0;
  let totalOccurrences = 0;

  painSymptoms.forEach(({ symptom, occurrences }) => {
    const level = getPainLevel(symptom);
    totalPain += level * occurrences;
    totalOccurrences += occurrences;
  });

  return Math.round((totalPain / totalOccurrences) * 10) / 10;
}
