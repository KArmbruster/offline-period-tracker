import {
  addDays,
  differenceInDays,
  format,
  parseISO,
  isWithinInterval,
  startOfDay,
  isSameDay,
} from 'date-fns';
import type { Cycle, OvulationMarker, PhaseType } from '@/types';
import { PhaseType as Phase } from '@/types';

const DEFAULT_CYCLE_LENGTH = 28;
const DEFAULT_PERIOD_LENGTH = 5;
const OVULATION_OFFSET = 14; // Days before next period
const FERTILE_WINDOW_BEFORE = 5; // Days before ovulation
const FERTILE_WINDOW_AFTER = 1; // Days after ovulation

/**
 * Calculate average cycle length from last 6 completed cycles
 */
export function calculateAverageCycleLength(cycles: Cycle[]): number {
  // Need at least 2 cycles to calculate (we compare consecutive starts)
  if (cycles.length < 2) {
    return DEFAULT_CYCLE_LENGTH;
  }

  // Sort by start date descending
  const sortedCycles = [...cycles].sort(
    (a, b) => parseISO(b.period_start_date).getTime() - parseISO(a.period_start_date).getTime()
  );

  // Take up to last 6 cycles (which gives us up to 5 intervals)
  const recentCycles = sortedCycles.slice(0, 7);
  const cycleLengths: number[] = [];

  for (let i = 0; i < recentCycles.length - 1 && cycleLengths.length < 6; i++) {
    const currentStart = parseISO(recentCycles[i].period_start_date);
    const previousStart = parseISO(recentCycles[i + 1].period_start_date);
    const length = differenceInDays(currentStart, previousStart);

    if (length > 0 && length < 60) {
      // Sanity check: cycles between 1-60 days
      cycleLengths.push(length);
    }
  }

  if (cycleLengths.length === 0) {
    return DEFAULT_CYCLE_LENGTH;
  }

  const sum = cycleLengths.reduce((a, b) => a + b, 0);
  return Math.round(sum / cycleLengths.length);
}

/**
 * Calculate period duration (average or specific cycle)
 */
export function calculatePeriodDuration(cycle: Cycle): number {
  if (!cycle.period_end_date) {
    return DEFAULT_PERIOD_LENGTH;
  }

  const start = parseISO(cycle.period_start_date);
  const end = parseISO(cycle.period_end_date);
  const duration = differenceInDays(end, start) + 1; // Include both start and end days

  return duration > 0 ? duration : DEFAULT_PERIOD_LENGTH;
}

/**
 * Calculate average period duration from cycles
 */
export function calculateAveragePeriodDuration(cycles: Cycle[]): number | null {
  const cyclesWithEnd = cycles.filter((c) => c.period_end_date);

  if (cyclesWithEnd.length === 0) {
    return null;
  }

  const durations = cyclesWithEnd.map(calculatePeriodDuration);
  const sum = durations.reduce((a, b) => a + b, 0);

  return Math.round(sum / durations.length);
}

/**
 * Get ovulation date for a cycle
 */
export function getOvulationDate(
  cycleStartDate: string,
  cycleLength: number,
  confirmedOvulation?: OvulationMarker
): Date {
  if (confirmedOvulation?.is_confirmed) {
    return parseISO(confirmedOvulation.date);
  }

  // Estimate: cycle length - 14 days
  const start = parseISO(cycleStartDate);
  return addDays(start, cycleLength - OVULATION_OFFSET);
}

/**
 * Get fertile window dates
 */
export function getFertileWindow(ovulationDate: Date): { start: Date; end: Date } {
  return {
    start: addDays(ovulationDate, -FERTILE_WINDOW_BEFORE),
    end: addDays(ovulationDate, FERTILE_WINDOW_AFTER),
  };
}

/**
 * Determine the phase for a given date
 */
export function getPhaseForDate(
  date: Date,
  currentCycle: Cycle | null,
  nextCycleStart: Date | null,
  cycleLength: number,
  ovulationMarker?: OvulationMarker
): PhaseType | null {
  if (!currentCycle) {
    return null;
  }

  const periodStart = parseISO(currentCycle.period_start_date);
  const periodEnd = currentCycle.period_end_date
    ? parseISO(currentCycle.period_end_date)
    : addDays(periodStart, DEFAULT_PERIOD_LENGTH - 1);

  // Check if in menstrual phase (highest priority)
  if (
    isWithinInterval(date, { start: startOfDay(periodStart), end: startOfDay(periodEnd) }) ||
    isSameDay(date, periodStart) ||
    isSameDay(date, periodEnd)
  ) {
    return Phase.MENSTRUAL;
  }

  // Calculate ovulation
  const ovulationDate = getOvulationDate(
    currentCycle.period_start_date,
    cycleLength,
    ovulationMarker
  );

  // Check if ovulation day
  if (isSameDay(date, ovulationDate)) {
    return Phase.OVULATION;
  }

  // Get fertile window
  const fertileWindow = getFertileWindow(ovulationDate);

  // Check if in fertile window
  if (
    isWithinInterval(date, { start: startOfDay(fertileWindow.start), end: startOfDay(fertileWindow.end) })
  ) {
    return Phase.FERTILE;
  }

  // Check follicular phase (after period, before fertile)
  if (date > periodEnd && date < fertileWindow.start) {
    return Phase.FOLLICULAR;
  }

  // Check luteal phase (after ovulation+1, before next period)
  const lutealStart = addDays(ovulationDate, 2);
  const cycleEnd = nextCycleStart || addDays(periodStart, cycleLength - 1);

  if (date >= lutealStart && date <= cycleEnd) {
    return Phase.LUTEAL;
  }

  return null;
}

/**
 * Predict future period start dates
 */
export function predictFuturePeriods(
  lastPeriodStart: string,
  cycleLength: number,
  monthsAhead: number = 12
): string[] {
  const predictions: string[] = [];
  const start = parseISO(lastPeriodStart);

  for (let i = 1; i <= monthsAhead; i++) {
    const predictedDate = addDays(start, cycleLength * i);
    predictions.push(format(predictedDate, 'yyyy-MM-dd'));
  }

  return predictions;
}

/**
 * Get predicted phase for a future date (beyond recorded cycles)
 * Uses the average cycle length to project phases into the future
 */
export function getPredictedPhaseForDate(
  date: Date,
  cycles: Cycle[],
  cycleLength: number,
  averagePeriodLength: number = DEFAULT_PERIOD_LENGTH
): PhaseType | null {
  if (cycles.length === 0) return null;

  // Get the most recent cycle
  const sortedCycles = [...cycles].sort(
    (a, b) => parseISO(b.period_start_date).getTime() - parseISO(a.period_start_date).getTime()
  );

  const lastCycle = sortedCycles[0];
  const lastPeriodStart = parseISO(lastCycle.period_start_date);

  // Calculate how many days since last period start
  const daysSinceLastPeriod = differenceInDays(date, lastPeriodStart);

  if (daysSinceLastPeriod < 0) {
    // Date is before the last period, not a prediction
    return null;
  }

  // Calculate position within a projected cycle
  const dayInCycle = daysSinceLastPeriod % cycleLength;

  // Determine phase based on day in cycle
  // Menstrual: days 0 to (periodLength - 1)
  if (dayInCycle < averagePeriodLength) {
    return Phase.MENSTRUAL;
  }

  // Calculate ovulation day (cycleLength - 14)
  const ovulationDay = cycleLength - OVULATION_OFFSET;

  // Fertile window: 5 days before ovulation to 1 day after
  const fertileStart = ovulationDay - FERTILE_WINDOW_BEFORE;
  const fertileEnd = ovulationDay + FERTILE_WINDOW_AFTER;

  // Follicular: after period, before fertile window
  if (dayInCycle >= averagePeriodLength && dayInCycle < fertileStart) {
    return Phase.FOLLICULAR;
  }

  // Ovulation day
  if (dayInCycle === ovulationDay) {
    return Phase.OVULATION;
  }

  // Fertile (excluding ovulation day)
  if (dayInCycle >= fertileStart && dayInCycle <= fertileEnd) {
    return Phase.FERTILE;
  }

  // Luteal: after fertile window until end of cycle
  if (dayInCycle > fertileEnd) {
    return Phase.LUTEAL;
  }

  return null;
}

/**
 * Get next predicted period date
 */
export function getNextPredictedPeriod(
  cycles: Cycle[],
  cycleLength: number
): string | null {
  if (cycles.length === 0) {
    return null;
  }

  // Get most recent cycle
  const sortedCycles = [...cycles].sort(
    (a, b) => parseISO(b.period_start_date).getTime() - parseISO(a.period_start_date).getTime()
  );

  const lastCycle = sortedCycles[0];
  const lastStart = parseISO(lastCycle.period_start_date);
  const nextPeriod = addDays(lastStart, cycleLength);

  // If predicted date is in the past, add another cycle
  const today = startOfDay(new Date());
  if (nextPeriod < today) {
    const cyclesPassed = Math.ceil(differenceInDays(today, nextPeriod) / cycleLength);
    return format(addDays(nextPeriod, cycleLength * cyclesPassed), 'yyyy-MM-dd');
  }

  return format(nextPeriod, 'yyyy-MM-dd');
}

/**
 * Get next predicted ovulation date
 */
export function getNextPredictedOvulation(
  cycles: Cycle[],
  cycleLength: number
): string | null {
  const nextPeriod = getNextPredictedPeriod(cycles, cycleLength);

  if (!nextPeriod) {
    return null;
  }

  const periodDate = parseISO(nextPeriod);
  const ovulationDate = addDays(periodDate, -OVULATION_OFFSET);

  // If ovulation is in the past, calculate for the next cycle
  const today = startOfDay(new Date());
  if (ovulationDate < today) {
    return format(addDays(ovulationDate, cycleLength), 'yyyy-MM-dd');
  }

  return format(ovulationDate, 'yyyy-MM-dd');
}

/**
 * Get cycle length variation (min and max)
 */
export function getCycleLengthVariation(cycles: Cycle[]): { min: number; max: number } | null {
  if (cycles.length < 2) {
    return null;
  }

  const sortedCycles = [...cycles].sort(
    (a, b) => parseISO(a.period_start_date).getTime() - parseISO(b.period_start_date).getTime()
  );

  const lengths: number[] = [];

  for (let i = 1; i < sortedCycles.length; i++) {
    const currentStart = parseISO(sortedCycles[i].period_start_date);
    const previousStart = parseISO(sortedCycles[i - 1].period_start_date);
    const length = differenceInDays(currentStart, previousStart);

    if (length > 0 && length < 60) {
      lengths.push(length);
    }
  }

  if (lengths.length === 0) {
    return null;
  }

  return {
    min: Math.min(...lengths),
    max: Math.max(...lengths),
  };
}

/**
 * Find the cycle a date belongs to
 */
export function findCycleForDate(date: Date, cycles: Cycle[]): Cycle | null {
  const sortedCycles = [...cycles].sort(
    (a, b) => parseISO(b.period_start_date).getTime() - parseISO(a.period_start_date).getTime()
  );

  for (let i = 0; i < sortedCycles.length; i++) {
    const cycleStart = parseISO(sortedCycles[i].period_start_date);

    // Next cycle start (or future if this is the most recent)
    const nextCycleStart = i > 0 ? parseISO(sortedCycles[i - 1].period_start_date) : null;

    if (date >= cycleStart && (!nextCycleStart || date < nextCycleStart)) {
      return sortedCycles[i];
    }
  }

  return null;
}

/**
 * Get the date range for a specific phase within a cycle
 */
export function getPhaseDateRange(
  cycle: Cycle,
  phase: PhaseType,
  cycleLength: number,
  nextCycleStart?: Date
): { start: Date; end: Date } | null {
  const periodStart = parseISO(cycle.period_start_date);
  const periodEnd = cycle.period_end_date
    ? parseISO(cycle.period_end_date)
    : addDays(periodStart, DEFAULT_PERIOD_LENGTH - 1);

  const ovulationDate = addDays(periodStart, cycleLength - OVULATION_OFFSET);
  const fertileWindow = getFertileWindow(ovulationDate);
  const cycleEnd = nextCycleStart
    ? addDays(nextCycleStart, -1)
    : addDays(periodStart, cycleLength - 1);

  switch (phase) {
    case Phase.MENSTRUAL:
      return { start: periodStart, end: periodEnd };

    case Phase.FOLLICULAR:
      const follicularStart = addDays(periodEnd, 1);
      const follicularEnd = addDays(fertileWindow.start, -1);
      if (follicularStart > follicularEnd) return null;
      return { start: follicularStart, end: follicularEnd };

    case Phase.FERTILE:
      // Exclude ovulation day itself
      return {
        start: fertileWindow.start,
        end: addDays(ovulationDate, -1),
      };

    case Phase.OVULATION:
      return { start: ovulationDate, end: ovulationDate };

    case Phase.LUTEAL:
      const lutealStart = addDays(ovulationDate, 2);
      return { start: lutealStart, end: cycleEnd };

    default:
      return null;
  }
}

/**
 * Get all dates that fall within a specific phase for a cycle
 */
export function getPhaseDates(
  cycle: Cycle,
  phase: PhaseType,
  cycleLength: number,
  nextCycleStart?: Date
): string[] {
  const range = getPhaseDateRange(cycle, phase, cycleLength, nextCycleStart);
  if (!range) return [];

  const dates: string[] = [];
  let current = range.start;

  while (current <= range.end) {
    dates.push(format(current, 'yyyy-MM-dd'));
    current = addDays(current, 1);
  }

  return dates;
}

export interface PhaseSymptomHistory {
  symptom: string;
  occurrences: number;
  percentage: number;
}

/**
 * Get symptoms that occurred during a specific phase in the last N cycles
 * Returns symptoms sorted by frequency
 */
export function getSymptomsForPhaseHistory(
  phase: PhaseType,
  cycles: Cycle[],
  symptoms: Array<{ date: string; symptom_type: string }>,
  cycleLength: number,
  maxCycles: number = 6
): PhaseSymptomHistory[] {
  if (cycles.length === 0) return [];

  // Sort cycles by date descending and take last N
  const sortedCycles = [...cycles].sort(
    (a, b) => parseISO(b.period_start_date).getTime() - parseISO(a.period_start_date).getTime()
  );

  const recentCycles = sortedCycles.slice(0, maxCycles);
  const symptomCounts: Record<string, number> = {};
  let totalPhaseDays = 0;

  // For each cycle, get the phase dates and count symptoms
  for (let i = 0; i < recentCycles.length; i++) {
    const cycle = recentCycles[i];
    const nextCycle = i > 0 ? recentCycles[i - 1] : undefined;
    const nextCycleStart = nextCycle ? parseISO(nextCycle.period_start_date) : undefined;

    const phaseDates = getPhaseDates(cycle, phase, cycleLength, nextCycleStart);
    totalPhaseDays += phaseDates.length;

    // Find symptoms that occurred on these dates
    const phaseDateSet = new Set(phaseDates);
    symptoms.forEach((symptom) => {
      if (phaseDateSet.has(symptom.date)) {
        symptomCounts[symptom.symptom_type] = (symptomCounts[symptom.symptom_type] || 0) + 1;
      }
    });
  }

  // Convert to array and calculate percentages
  const cycleCount = recentCycles.length;
  const result: PhaseSymptomHistory[] = Object.entries(symptomCounts)
    .map(([symptom, occurrences]) => ({
      symptom,
      occurrences,
      // Percentage based on how many cycles had this symptom during this phase
      percentage: Math.round((occurrences / cycleCount) * 100),
    }))
    .sort((a, b) => b.occurrences - a.occurrences);

  return result;
}
