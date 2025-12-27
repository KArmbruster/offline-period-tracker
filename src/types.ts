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

  // Other
  ACNE = 'acne',
  INSOMNIA = 'insomnia',
  CRAVINGS = 'cravings',
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
  created_at: string;
}

export interface Symptom {
  id: number;
  cycle_id: number | null;
  date: string; // ISO 8601 YYYY-MM-DD
  symptom_type: string;
  notes: string | null;
}

export interface CustomSymptomType {
  id: number;
  name: string;
  created_at: string;
}

export interface OvulationMarker {
  id: number;
  cycle_id: number;
  date: string; // ISO 8601 YYYY-MM-DD
  is_confirmed: boolean;
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
  ovulation_markers: OvulationMarker[];
}

// Insights
export interface CycleInsights {
  averageCycleLength: number | null;
  shortestCycle: number | null;
  longestCycle: number | null;
  averagePeriodDuration: number | null;
  mostCommonSymptoms: { symptom: string; count: number }[];
  nextPredictedPeriod: string | null;
  nextPredictedOvulation: string | null;
}

// Calendar Day Info
export interface DayInfo {
  date: string;
  phase: PhaseType | null;
  isToday: boolean;
  isPredicted: boolean;
  symptoms: Symptom[];
  hasPeriodStart: boolean;
  hasPeriodEnd: boolean;
  hasOvulationMarker: boolean;
}
