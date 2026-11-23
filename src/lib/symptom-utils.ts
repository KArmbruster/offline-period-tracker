import { SportType, SymptomType } from '@/types';
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
  [SymptomType.SEX]: 'Had sex',
};

// Built-in sports in the order shown in the day sheet
export const SPORT_OPTIONS: Array<{ type: string; label: string }> = [
  { type: SportType.RUNNING, label: 'Running' },
  { type: SportType.CYCLING, label: 'Cycling' },
  { type: SportType.SWIMMING, label: 'Swimming' },
  { type: SportType.STRENGTH_TRAINING, label: 'Strength training' },
  { type: SportType.YOGA, label: 'Yoga' },
  { type: SportType.PILATES, label: 'Pilates' },
  { type: SportType.HIKING, label: 'Hiking' },
];

const SPORT_LABELS: Record<string, string> = Object.fromEntries(
  SPORT_OPTIONS.map(({ type, label }) => [type, label])
);

// How strong the user felt during sport, one score per day
export const SPORT_SCORE_LABELS: Record<number, string> = {
  1: 'Weaker than usual',
  2: 'A bit weaker',
  3: 'Normal',
  4: 'A bit stronger',
  5: 'Stronger than usual',
};

const SPORT_SCORE_PREFIX = 'sport_score_';
const CUSTOM_SPORT_PREFIX = 'sport_custom_';

/** Symptom type of a user-defined sport */
export function customSportType(customTypeId: number): string {
  return `${CUSTOM_SPORT_PREFIX}${customTypeId}`;
}

/** Symptom type of a strength score from 1 to 5 */
export function sportScoreType(score: number): string {
  return `${SPORT_SCORE_PREFIX}${score}`;
}

/** True for the strength score entry */
export function isSportScore(type: string): boolean {
  return type.startsWith(SPORT_SCORE_PREFIX);
}

/** True for a sport session (built-in or custom), not the score */
export function isSportSession(type: string): boolean {
  return type.startsWith('sport_') && !isSportScore(type);
}

/** Strength score 1-5 from its symptom type, or 0 if it is not one */
export function getSportScore(type: string): number {
  if (!isSportScore(type)) return 0;
  const score = parseInt(type.slice(SPORT_SCORE_PREFIX.length), 10);
  return score >= 1 && score <= 5 ? score : 0;
}

/**
 * Sport and sexual activity are stored next to symptoms but are not symptoms:
 * they are left out of the symptom statistics and shown on their own.
 */
export function isActivityEntry(type: string): boolean {
  return type.startsWith('sport_') || type === SymptomType.SEX;
}

/**
 * Get display label for a symptom, handling both built-in and custom symptoms
 */
export function getSymptomLabel(symptom: string, customTypes: CustomSymptomType[]): string {
  // Check if it's a built-in symptom
  if (SYMPTOM_LABELS[symptom]) {
    return SYMPTOM_LABELS[symptom];
  }

  if (SPORT_LABELS[symptom]) {
    return SPORT_LABELS[symptom];
  }

  // Custom sport (format: sport_custom_${id})
  if (symptom.startsWith(CUSTOM_SPORT_PREFIX)) {
    const customId = parseInt(symptom.slice(CUSTOM_SPORT_PREFIX.length), 10);
    const customType = customTypes.find((c) => c.id === customId);
    if (customType) {
      return customType.name;
    }
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
 * Calculate average pain from symptom history, weighted by logged days
 */
export function calculateAveragePain(
  symptoms: Array<{ symptom: string; days: number }>
): number | null {
  const painSymptoms = symptoms.filter((s) => isPeriodPainSymptom(s.symptom));
  if (painSymptoms.length === 0) return null;

  let totalPain = 0;
  let totalOccurrences = 0;

  painSymptoms.forEach(({ symptom, days }) => {
    const level = getPainLevel(symptom);
    totalPain += level * days;
    totalOccurrences += days;
  });

  return Math.round((totalPain / totalOccurrences) * 10) / 10;
}
