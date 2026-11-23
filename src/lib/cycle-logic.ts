import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
} from 'date-fns';
import type { Cycle, PhaseType } from '@/types';
import { PhaseType as Phase, SymptomType } from '@/types';
import { getSportScore, isActivityEntry, isSportSession } from '@/lib/symptom-utils';

const DEFAULT_CYCLE_LENGTH = 28;
const DEFAULT_PERIOD_LENGTH = 5;
const LUTEAL_LENGTH = 14; // Days between ovulation and the next period start
const FERTILE_WINDOW_BEFORE = 5; // Days before ovulation
const FERTILE_WINDOW_AFTER = 1; // Days after ovulation
const MAX_CYCLES = 6;
const MAX_VALID_CYCLE_LENGTH = 60; // Longer gaps are treated as missing data
const OUTLIER_FACTOR = 1.5; // Gaps above 1.5x the median are a skipped log, not a cycle
export const MAX_PERIOD_LENGTH = 14; // Longest period the UI lets the user log
const PREDICTION_DAYS = 365;

function sortAscending(cycles: Cycle[]): Cycle[] {
  return [...cycles].sort((a, b) =>
    a.period_start_date < b.period_start_date ? -1 : a.period_start_date > b.period_start_date ? 1 : 0
  );
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function isPlausibleCycleLength(length: number, typicalLength: number): boolean {
  return length > 0 && length < MAX_VALID_CYCLE_LENGTH && length <= typicalLength * OUTLIER_FACTOR;
}

export interface CycleHistoryEntry {
  cycle: Cycle;
  /** Days from this period start to the next one. Null for the current cycle. */
  length: number | null;
  /** Logged period duration, or the 5-day default if no end was logged */
  periodLength: number;
  /** False for gaps that are ignored in averages (a period that was not logged) */
  counted: boolean;
}

/**
 * The current cycle plus the most recent completed ones, newest first.
 * Gaps that are far longer than the others are flagged as not counted: they
 * almost always mean a period was not logged, and would skew every prediction.
 */
export function getCycleHistory(cycles: Cycle[], maxCycles: number = MAX_CYCLES): CycleHistoryEntry[] {
  const sorted = sortAscending(cycles);
  const entries: CycleHistoryEntry[] = [];
  let valid = 0;

  for (let i = sorted.length - 1; i >= 0 && valid < maxCycles; i--) {
    const cycle = sorted[i];
    const periodLength = calculatePeriodDuration(cycle);

    if (i === sorted.length - 1) {
      entries.push({ cycle, length: null, periodLength, counted: false });
      continue;
    }

    const length = differenceInCalendarDays(
      parseISO(sorted[i + 1].period_start_date),
      parseISO(cycle.period_start_date)
    );
    const counted = length > 0 && length < MAX_VALID_CYCLE_LENGTH;
    if (counted) valid++;
    entries.push({ cycle, length, periodLength, counted });
  }

  const lengths = entries.filter((e) => e.counted).map((e) => e.length as number);
  if (lengths.length >= 3) {
    const typical = median(lengths);
    entries.forEach((e) => {
      if (e.counted && (e.length as number) > typical * OUTLIER_FACTOR) {
        e.counted = false;
      }
    });
  }

  return entries;
}

/**
 * Lengths of the most recent cycles that count towards the average, newest first
 */
export function getRecentCycleLengths(cycles: Cycle[], maxCycles: number = MAX_CYCLES): number[] {
  return getCycleHistory(cycles, maxCycles)
    .filter((e) => e.counted)
    .map((e) => e.length as number);
}

/**
 * Exact (unrounded) mean cycle length. Used for projecting far into the
 * future, where a rounded value would drift by several days.
 */
export function calculateMeanCycleLength(cycles: Cycle[]): number {
  const lengths = getRecentCycleLengths(cycles);
  if (lengths.length === 0) {
    return DEFAULT_CYCLE_LENGTH;
  }
  return lengths.reduce((a, b) => a + b, 0) / lengths.length;
}

/**
 * Average cycle length in whole days from the last 6 completed cycles
 */
export function calculateAverageCycleLength(cycles: Cycle[]): number {
  return Math.round(calculateMeanCycleLength(cycles));
}

/**
 * Period duration of one cycle in days, counting both the start and end day
 */
export function calculatePeriodDuration(cycle: Cycle): number {
  if (!cycle.period_end_date) {
    return DEFAULT_PERIOD_LENGTH;
  }

  const duration =
    differenceInCalendarDays(parseISO(cycle.period_end_date), parseISO(cycle.period_start_date)) + 1;

  return duration > 0 ? duration : DEFAULT_PERIOD_LENGTH;
}

function getRecentPeriodDurations(cycles: Cycle[], maxCycles: number = MAX_CYCLES): number[] {
  return sortAscending(cycles.filter((c) => c.period_end_date))
    .reverse()
    .slice(0, maxCycles)
    .map(calculatePeriodDuration);
}

/**
 * Average period duration from the last 6 periods that have an end date
 */
export function calculateAveragePeriodDuration(cycles: Cycle[]): number | null {
  const durations = getRecentPeriodDurations(cycles);
  if (durations.length === 0) {
    return null;
  }
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}

function toStats(values: number[]): { min: number; max: number; avg: number } | null {
  if (values.length === 0) {
    return null;
  }
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
  };
}

/**
 * Get period duration variation (min, max, avg) from last N cycles
 */
export function getPeriodDurationStats(
  cycles: Cycle[],
  maxCycles: number = MAX_CYCLES
): { min: number; max: number; avg: number } | null {
  return toStats(getRecentPeriodDurations(cycles, maxCycles));
}

/**
 * Get cycle length stats (min, max, avg) from last N cycles
 */
export function getCycleLengthStats(
  cycles: Cycle[],
  maxCycles: number = MAX_CYCLES
): { min: number; max: number; avg: number } | null {
  return toStats(getRecentCycleLengths(cycles, maxCycles));
}

/**
 * Find the cycle a date belongs to
 */
export function findCycleForDate(date: Date, cycles: Cycle[]): Cycle | null {
  const sorted = sortAscending(cycles);
  const day = startOfDay(date);

  for (let i = sorted.length - 1; i >= 0; i--) {
    if (day >= parseISO(sorted[i].period_start_date)) {
      return sorted[i];
    }
  }

  return null;
}

/**
 * Get days until next predicted period (negative if overdue)
 */
export function getDaysUntilNextPeriod(
  cycles: Cycle[],
  now: Date = new Date()
): { daysUntil: number; predictedDate: string; isOverdue: boolean } | null {
  const nextPeriod = createCycleModel(cycles, now).nextPeriodStart;
  if (!nextPeriod) {
    return null;
  }

  const daysUntil = differenceInCalendarDays(nextPeriod, startOfDay(now));

  return {
    daysUntil,
    predictedDate: format(nextPeriod, 'yyyy-MM-dd'),
    isOverdue: daysUntil < 0,
  };
}

export interface DayInfo {
  /** Menstrual, follicular, ovulation or luteal. Never FERTILE: see isFertile. */
  phase: PhaseType | null;
  /** True for every date after today */
  isPrediction: boolean;
  /** In the fertile window. Always false on menstrual days (menstrual wins). */
  isFertile: boolean;
}

export interface CycleModel {
  cycleLength: number;
  periodLength: number;
  /** When the next period is expected. In the past if it is late. Null without data. */
  nextPeriodStart: Date | null;
  getDayInfo(date: Date): DayInfo;
}

const NO_INFO: DayInfo = { phase: null, isPrediction: false, isFertile: false };

/**
 * Phase of a day given its position in a cycle.
 * All arguments are 0-based day offsets from the period start.
 */
function phaseAt(
  dayInCycle: number,
  periodLength: number,
  ovulationDay: number
): { phase: PhaseType; isFertile: boolean } {
  if (dayInCycle < periodLength) {
    return { phase: Phase.MENSTRUAL, isFertile: false };
  }

  const isFertile =
    dayInCycle >= ovulationDay - FERTILE_WINDOW_BEFORE &&
    dayInCycle <= ovulationDay + FERTILE_WINDOW_AFTER;

  if (dayInCycle === ovulationDay) {
    return { phase: Phase.OVULATION, isFertile };
  }

  return { phase: dayInCycle < ovulationDay ? Phase.FOLLICULAR : Phase.LUTEAL, isFertile };
}

/**
 * Estimated ovulation as a 0-based day offset. The luteal phase is the
 * stable part of the cycle, so ovulation is counted back from the next
 * period: cycle day (length - 14), which is day 14 of a 28-day cycle.
 */
function estimateOvulationDay(cycleLength: number): number {
  return Math.max(cycleLength - LUTEAL_LENGTH - 1, 0);
}

/**
 * Single source of truth for which phase a date is in. The calendar, the
 * "current phase" panel and the symptom statistics all read from this.
 */
export function createCycleModel(cycles: Cycle[], now: Date = new Date()): CycleModel {
  const sorted = sortAscending(cycles);
  const today = startOfDay(now);
  const meanLength = calculateMeanCycleLength(cycles);
  const cycleLength = Math.round(meanLength);
  const periodLength = calculateAveragePeriodDuration(cycles) ?? DEFAULT_PERIOD_LENGTH;
  const starts = sorted.map((c) => parseISO(c.period_start_date));

  const lastStart = starts.length > 0 ? starts[starts.length - 1] : null;

  // Expected length of the current cycle. A marked ovulation day moves the
  // expected period, because the luteal phase after it is the stable part.
  let currentLength = cycleLength;
  const markedOvulation = sorted.length > 0 ? sorted[sorted.length - 1].ovulation_date : null;
  if (lastStart && markedOvulation) {
    const ovulationDay = differenceInCalendarDays(parseISO(markedOvulation), lastStart);
    if (ovulationDay >= 0 && ovulationDay < MAX_VALID_CYCLE_LENGTH) {
      currentLength = ovulationDay + LUTEAL_LENGTH + 1;
    }
  }
  const expectedNextStart = lastStart ? addDays(lastStart, currentLength) : null;
  // An unlogged period never appears in the past: if it is due or late,
  // the prediction slides forward and starts tomorrow at the earliest.
  const tomorrow = addDays(today, 1);
  const predictionStart =
    expectedNextStart && expectedNextStart > tomorrow ? expectedNextStart : tomorrow;

  function recordedDayInfo(day: Date, index: number, isPrediction: boolean): DayInfo {
    const cycle = sorted[index];
    const start = starts[index];
    const isLastCycle = index === sorted.length - 1;
    const dayInCycle = differenceInCalendarDays(day, start);

    // Real length is known for completed cycles; use it unless the gap is
    // implausible (a period that was never logged in between).
    let length = cycleLength;
    if (!isLastCycle) {
      const actual = differenceInCalendarDays(starts[index + 1], start);
      if (isPlausibleCycleLength(actual, meanLength)) {
        length = actual;
      } else if (dayInCycle >= cycleLength) {
        // Past the end of a normal cycle inside an implausible gap: unknown
        return NO_INFO;
      }
    } else {
      length = currentLength;
      if (dayInCycle >= currentLength) {
        // Period is due or late and not logged yet: still luteal, for up to
        // one more cycle length. After that the data is too stale to say.
        return dayInCycle < currentLength + cycleLength
          ? { phase: Phase.LUTEAL, isPrediction, isFertile: false }
          : NO_INFO;
      }
    }

    const ovulationDay = cycle.ovulation_date
      ? differenceInCalendarDays(parseISO(cycle.ovulation_date), start)
      : estimateOvulationDay(length);

    return { ...phaseAt(dayInCycle, Math.min(calculatePeriodDuration(cycle), length), ovulationDay), isPrediction };
  }

  function predictedDayInfo(day: Date): DayInfo {
    if (differenceInCalendarDays(day, today) > PREDICTION_DAYS) {
      return NO_INFO;
    }

    // Projected starts are rounded from the exact mean so they do not drift
    const offset = differenceInCalendarDays(day, predictionStart);
    let n = Math.floor(offset / meanLength);
    while (Math.round((n + 1) * meanLength) <= offset) n++;
    while (n > 0 && Math.round(n * meanLength) > offset) n--;

    const cycleStartOffset = Math.round(n * meanLength);
    const length = Math.round((n + 1) * meanLength) - cycleStartOffset;

    return {
      ...phaseAt(offset - cycleStartOffset, Math.min(periodLength, length), estimateOvulationDay(length)),
      isPrediction: true,
    };
  }

  function getDayInfo(date: Date): DayInfo {
    if (!lastStart) {
      return NO_INFO;
    }

    const day = startOfDay(date);
    const isPrediction = day > today;

    if (isPrediction && day >= predictionStart) {
      return predictedDayInfo(day);
    }

    for (let i = starts.length - 1; i >= 0; i--) {
      if (day >= starts[i]) {
        return recordedDayInfo(day, i, isPrediction);
      }
    }

    return NO_INFO;
  }

  return { cycleLength, periodLength, nextPeriodStart: expectedNextStart, getDayInfo };
}

export interface PhaseSymptomHistory {
  symptom: string;
  /** Number of cycles in which the symptom was logged during the phase */
  occurrences: number;
  /** Number of days on which it was logged during the phase */
  days: number;
  /** Share of the analysed cycles in which it occurred */
  percentage: number;
}

/**
 * Symptoms logged during a phase across the last N cycles, most common first.
 * A symptom counts once per cycle, however many days it was logged.
 */
export function getSymptomsForPhaseHistory(
  phase: PhaseType,
  cycles: Cycle[],
  symptoms: Array<{ date: string; symptom_type: string }>,
  maxCycles: number = MAX_CYCLES
): PhaseSymptomHistory[] {
  if (cycles.length === 0) return [];

  const sorted = sortAscending(cycles);
  const recent = sorted.slice(-maxCycles);
  const firstDate = recent[0].period_start_date;
  const model = createCycleModel(cycles);

  const cyclesBySymptom = new Map<string, Set<number>>();
  const daysBySymptom = new Map<string, Set<string>>();

  for (const symptom of symptoms) {
    if (symptom.date < firstDate) continue;
    // Sport and sex have their own statistics (getActivityStatsByPhase)
    if (isActivityEntry(symptom.symptom_type)) continue;

    const date = parseISO(symptom.date);
    const info = model.getDayInfo(date);
    const matches = phase === Phase.FERTILE ? info.isFertile : info.phase === phase;
    if (!matches) continue;

    const cycle = findCycleForDate(date, recent);
    if (!cycle) continue;

    if (!cyclesBySymptom.has(symptom.symptom_type)) {
      cyclesBySymptom.set(symptom.symptom_type, new Set());
      daysBySymptom.set(symptom.symptom_type, new Set());
    }
    cyclesBySymptom.get(symptom.symptom_type)!.add(cycle.id);
    daysBySymptom.get(symptom.symptom_type)!.add(symptom.date);
  }

  return [...cyclesBySymptom.entries()]
    .map(([symptom, cycleIds]) => ({
      symptom,
      occurrences: cycleIds.size,
      days: daysBySymptom.get(symptom)!.size,
      percentage: Math.round((cycleIds.size / recent.length) * 100),
    }))
    .sort((a, b) => b.occurrences - a.occurrences || b.days - a.days);
}

export interface PhaseActivityStats {
  phase: PhaseType;
  /** Recent cycles that have reached this phase so far (the denominator) */
  cycles: number;
  /** Average number of sport sessions in this phase per cycle */
  sportPerCycle: number | null;
  /** Average strength score (1-5) on sport days in this phase */
  averageStrength: number | null;
  /** Average number of days with sex in this phase per cycle */
  sexPerCycle: number | null;
}

const ACTIVITY_PHASES: PhaseType[] = [Phase.MENSTRUAL, Phase.FOLLICULAR, Phase.OVULATION, Phase.LUTEAL];

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Sport sessions, strength score and sex per phase across the last N cycles.
 * Counts are divided by the number of cycles that have reached the phase, so
 * the current cycle only counts towards phases it has already been through.
 */
export function getActivityStatsByPhase(
  cycles: Cycle[],
  entries: Array<{ date: string; symptom_type: string }>,
  maxCycles: number = MAX_CYCLES,
  now: Date = new Date()
): PhaseActivityStats[] {
  const empty = ACTIVITY_PHASES.map((phase) => ({
    phase,
    cycles: 0,
    sportPerCycle: null,
    averageStrength: null,
    sexPerCycle: null,
  }));
  if (cycles.length === 0) return empty;

  const recent = sortAscending(cycles).slice(-maxCycles);
  const model = createCycleModel(cycles, now);
  const today = startOfDay(now);

  // Phase of every past day in the analysed cycles
  const phaseByDate = new Map<string, PhaseType>();
  const cyclesByPhase = new Map<PhaseType, Set<number>>(ACTIVITY_PHASES.map((p) => [p, new Set()]));
  for (let day = parseISO(recent[0].period_start_date); day <= today; day = addDays(day, 1)) {
    const { phase } = model.getDayInfo(day);
    const cycle = phase ? findCycleForDate(day, recent) : null;
    if (!phase || !cycle) continue;
    phaseByDate.set(format(day, 'yyyy-MM-dd'), phase);
    cyclesByPhase.get(phase)!.add(cycle.id);
  }

  const sport = new Map<PhaseType, number>();
  const sex = new Map<PhaseType, number>();
  const scores = new Map<PhaseType, number[]>();
  for (const { date, symptom_type: type } of entries) {
    const phase = phaseByDate.get(date);
    if (!phase) continue;
    if (isSportSession(type)) {
      sport.set(phase, (sport.get(phase) ?? 0) + 1);
    } else if (type === SymptomType.SEX) {
      sex.set(phase, (sex.get(phase) ?? 0) + 1);
    } else {
      const score = getSportScore(type);
      if (score > 0) scores.set(phase, [...(scores.get(phase) ?? []), score]);
    }
  }

  return ACTIVITY_PHASES.map((phase) => {
    const count = cyclesByPhase.get(phase)!.size;
    const phaseScores = scores.get(phase) ?? [];
    return {
      phase,
      cycles: count,
      sportPerCycle: count > 0 ? roundOne((sport.get(phase) ?? 0) / count) : null,
      averageStrength:
        phaseScores.length > 0
          ? roundOne(phaseScores.reduce((a, b) => a + b, 0) / phaseScores.length)
          : null,
      sexPerCycle: count > 0 ? roundOne((sex.get(phase) ?? 0) / count) : null,
    };
  });
}
