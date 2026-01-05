// Symptom Types
export enum SymptomType {
  // Physical
  CRAMPS = 'cramps',
  HEADACHE = 'headache',
  BLOATING = 'bloating',
  BREAST_TENDERNESS = 'breast_tenderness',
  FATIGUE = 'fatigue',
  BACKACHE = 'backache',
  NAUSEA = 'nausea',

  // Flow
  FLOW_LIGHT = 'flow_light',
  FLOW_MEDIUM = 'flow_medium',
  FLOW_HEAVY = 'flow_heavy',
  SPOTTING = 'spotting',

  // Mood
  MOOD_HAPPY = 'mood_happy',
  MOOD_SAD = 'mood_sad',
  MOOD_IRRITABLE = 'mood_irritable',
  MOOD_ANXIOUS = 'mood_anxious',
  MOOD_CALM = 'mood_calm',
  MOOD_HORNY = 'mood_horny',

  // Other
  ACNE = 'acne',
  INSOMNIA = 'insomnia',
  CRAVINGS = 'cravings',

  // Period Pain (1-10 scale)
  PERIOD_PAIN_1 = 'period_pain_1',
  PERIOD_PAIN_2 = 'period_pain_2',
  PERIOD_PAIN_3 = 'period_pain_3',
  PERIOD_PAIN_4 = 'period_pain_4',
  PERIOD_PAIN_5 = 'period_pain_5',
  PERIOD_PAIN_6 = 'period_pain_6',
  PERIOD_PAIN_7 = 'period_pain_7',
  PERIOD_PAIN_8 = 'period_pain_8',
  PERIOD_PAIN_9 = 'period_pain_9',
  PERIOD_PAIN_10 = 'period_pain_10',
}

// Phase Types
export enum PhaseType {
  MENSTRUAL = 'menstrual',
  FOLLICULAR = 'follicular',
  FERTILE = 'fertile',
  OVULATION = 'ovulation',
  LUTEAL = 'luteal',
}

// Database Models
export interface Cycle {
  id: number;
  period_start_date: string; // ISO 8601 YYYY-MM-DD
  period_end_date: string | null;
  ovulation_date: string | null; // ISO 8601 YYYY-MM-DD
  created_at: string;
}

export interface Symptom {
  id: number;
  cycle_id: number | null;
  date: string; // ISO 8601 YYYY-MM-DD
  symptom_type: string;
}

export interface CustomSymptomType {
  id: number;
  name: string;
  category: 'physical' | 'mood';
  created_at: string;
}

export interface DayNote {
  id: number;
  date: string; // ISO 8601 YYYY-MM-DD
  content: string;
  created_at: string;
  updated_at: string;
}


// App State
export interface AppState {
  isUnlocked: boolean;
  isFirstLaunch: boolean;
}

// Export/Import Format
export interface ExportData {
  version: number;
  exported_at: string;
  cycles: Cycle[];
  symptoms: Symptom[];
  custom_symptom_types: CustomSymptomType[];
  day_notes: DayNote[];
}
