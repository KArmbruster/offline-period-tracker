import { describe, expect, it } from 'vitest';
import { addDays, format, parseISO } from 'date-fns';
import {
  calculateAverageCycleLength,
  createCycleModel,
  getCycleHistory,
  getDaysUntilNextPeriod,
  getRecentCycleLengths,
  getSymptomsForPhaseHistory,
  type CycleModel,
} from '@/lib/cycle-logic';
import { calculateAveragePain } from '@/lib/symptom-utils';
import { PhaseType } from '@/types';
import type { Cycle } from '@/types';

let nextId = 1;
function cycle(start: string, end?: string, ovulation?: string): Cycle {
  return {
    id: nextId++,
    period_start_date: start,
    period_end_date: end ?? null,
    ovulation_date: ovulation ?? null,
    created_at: '',
  };
}

/** Compact description of a day: phase, "+fertile" if fertile, "?" if predicted */
function day(model: CycleModel, date: string): string {
  const info = model.getDayInfo(parseISO(date));
  return `${info.phase}${info.isFertile ? '+fertile' : ''}${info.isPrediction ? '?' : ''}`;
}

const symptom = (date: string, symptom_type: string) => ({ date, symptom_type });

// Three regular 28-day cycles with 5-day periods
const REGULAR = [
  cycle('2026-09-10', '2026-09-14'),
  cycle('2026-10-08', '2026-10-12'),
  cycle('2026-11-05', '2026-11-09'),
];

describe('regular 28-day cycle', () => {
  const model = createCycleModel(REGULAR, parseISO('2026-11-16'));

  it('uses the logged averages', () => {
    expect(model.cycleLength).toBe(28);
    expect(model.periodLength).toBe(5);
  });

  it('assigns the phases of the current cycle', () => {
    expect(day(model, '2026-11-05')).toBe('menstrual');
    expect(day(model, '2026-11-09')).toBe('menstrual');
    expect(day(model, '2026-11-10')).toBe('follicular');
    expect(day(model, '2026-11-12')).toBe('follicular');
    expect(day(model, '2026-11-13')).toBe('follicular+fertile');
    expect(day(model, '2026-11-16')).toBe('follicular+fertile');
  });

  it('puts ovulation on cycle day 14 with a fertile window of -5 to +1', () => {
    expect(day(model, '2026-10-21')).toBe('ovulation+fertile');
    expect(day(model, '2026-11-18')).toBe('ovulation+fertile?');
    expect(day(model, '2026-11-19')).toBe('luteal+fertile?');
    expect(day(model, '2026-11-20')).toBe('luteal?');
  });

  it('predicts the following cycles', () => {
    expect(day(model, '2026-12-02')).toBe('luteal?');
    expect(day(model, '2026-12-03')).toBe('menstrual?');
    expect(day(model, '2026-12-07')).toBe('menstrual?');
    expect(day(model, '2026-12-08')).toBe('follicular?');
    expect(day(model, '2026-12-16')).toBe('ovulation+fertile?');
    expect(day(model, '2026-12-31')).toBe('menstrual?');
  });

  it('shows nothing before the first cycle or beyond 12 months', () => {
    expect(day(model, '2026-09-09')).toBe('null');
    expect(day(model, '2027-11-20')).toBe('null');
  });
});

describe('late period', () => {
  it('keeps unlogged days luteal and slides the prediction to tomorrow', () => {
    const model = createCycleModel(REGULAR, parseISO('2026-12-06'));
    expect(day(model, '2026-12-03')).toBe('luteal');
    expect(day(model, '2026-12-06')).toBe('luteal');
    expect(day(model, '2026-12-07')).toBe('menstrual?');
    expect(day(model, '2027-01-04')).toBe('menstrual?');
  });

  it('reports how late the period is', () => {
    expect(getDaysUntilNextPeriod(REGULAR, parseISO('2026-12-06'))).toEqual({
      daysUntil: -3,
      predictedDate: '2026-12-03',
      isOverdue: true,
    });
  });

  it('shows no phase once the data is more than a cycle overdue', () => {
    const model = createCycleModel(REGULAR, parseISO('2027-03-01'));
    expect(day(model, '2027-02-20')).toBe('null');
  });
});

describe('cycle lengths', () => {
  it('uses the real length of completed cycles for ovulation', () => {
    const cycles = [cycle('2026-08-01'), cycle('2026-09-05'), cycle('2026-10-03'), cycle('2026-10-31')];
    const model = createCycleModel(cycles, parseISO('2026-11-16'));
    expect(model.cycleLength).toBe(30); // mean of 35, 28, 28
    expect(day(model, '2026-08-21')).toBe('ovulation+fertile'); // day 21 of a 35-day cycle
    expect(day(model, '2026-08-15')).toBe('follicular');
    expect(day(model, '2026-09-18')).toBe('ovulation+fertile'); // day 14 of a 28-day cycle
    expect(day(model, '2026-08-05')).toBe('menstrual'); // default 5-day period
  });

  // One period (July) was never logged, leaving a 56-day gap
  const WITH_GAP = [
    cycle('2026-05-01'),
    cycle('2026-05-29'),
    cycle('2026-06-26'),
    cycle('2026-08-21'),
    cycle('2026-09-18'),
    cycle('2026-10-16'),
  ];

  it('ignores a skipped month in the average', () => {
    expect(getRecentCycleLengths(WITH_GAP)).toEqual([28, 28, 28, 28]);
    expect(calculateAverageCycleLength(WITH_GAP)).toBe(28);
  });

  it('flags the gap as not counted in the history', () => {
    expect(getCycleHistory(WITH_GAP).map((e) => [e.length, e.counted])).toEqual([
      [null, false],
      [28, true],
      [28, true],
      [56, false],
      [28, true],
      [28, true],
    ]);
  });

  it('shows no phase for the unknown part of a gap', () => {
    const model = createCycleModel(WITH_GAP, parseISO('2026-11-01'));
    expect(day(model, '2026-07-09')).toBe('ovulation+fertile');
    expect(day(model, '2026-07-30')).toBe('null');
  });

  it('predicts from a single cycle using the 28-day default', () => {
    const model = createCycleModel([cycle('2026-11-05')], parseISO('2026-11-16'));
    expect(day(model, '2026-12-03')).toBe('menstrual?');
  });
});

describe('short cycles and marked ovulation', () => {
  const cycles = [
    cycle('2026-09-01', '2026-09-07'),
    cycle('2026-09-22', '2026-09-28'),
    cycle('2026-10-13', '2026-10-19', '2026-10-24'),
  ];
  const model = createCycleModel(cycles, parseISO('2026-10-30'));

  it('lets menstrual win over fertile and ovulation', () => {
    expect(model.cycleLength).toBe(21);
    expect(day(model, '2026-09-05')).toBe('menstrual');
    expect(day(model, '2026-09-07')).toBe('menstrual'); // estimated ovulation day
    expect(day(model, '2026-09-08')).toBe('luteal+fertile');
  });

  it('uses a marked ovulation day instead of the estimate', () => {
    expect(day(model, '2026-10-24')).toBe('ovulation+fertile');
    expect(day(model, '2026-10-20')).toBe('follicular+fertile');
  });

  it('moves the expected period to 15 days after a marked ovulation', () => {
    const marked = [cycle('2026-09-10'), cycle('2026-10-08'), cycle('2026-11-05', '2026-11-09', '2026-11-24')];
    const now = parseISO('2026-11-26');
    const shifted = createCycleModel(marked, now);
    expect(format(shifted.nextPeriodStart as Date, 'yyyy-MM-dd')).toBe('2026-12-09');
    expect(day(shifted, '2026-12-03')).toBe('luteal?'); // would be a period without the mark
    expect(day(shifted, '2026-12-08')).toBe('luteal?');
    expect(day(shifted, '2026-12-09')).toBe('menstrual?');
    expect(getDaysUntilNextPeriod(marked, now)?.daysUntil).toBe(13);
    expect(getDaysUntilNextPeriod(REGULAR, now)?.daysUntil).toBe(7);
  });
});

describe('long-range predictions', () => {
  // 28, 29, 28 days: a mean of 28.33
  const cycles = [cycle('2026-08-10'), cycle('2026-09-07'), cycle('2026-10-06'), cycle('2026-11-03')];
  const model = createCycleModel(cycles, parseISO('2026-11-16'));

  const starts: string[] = [];
  const fertileRuns: number[] = [];
  let previousPhase: string | null = null;
  let run = 0;
  for (let i = 0, d = parseISO('2026-11-17'); i < 364; i++, d = addDays(d, 1)) {
    const info = model.getDayInfo(d);
    if (info.phase === PhaseType.MENSTRUAL && previousPhase !== PhaseType.MENSTRUAL) {
      starts.push(format(d, 'yyyy-MM-dd'));
    }
    if (info.isFertile) {
      run++;
    } else if (run > 0) {
      fertileRuns.push(run);
      run = 0;
    }
    previousPhase = info.phase;
  }

  it('does not drift with a fractional average', () => {
    expect(starts.slice(0, 6)).toEqual([
      '2026-12-01',
      '2026-12-29',
      '2027-01-27',
      '2027-02-24',
      '2027-03-24',
      '2027-04-22',
    ]);
    // Twelfth predicted start: 11 cycles of 28.33 days = 312 days later
    expect(starts[11]).toBe(format(addDays(parseISO('2026-12-01'), 312), 'yyyy-MM-dd'));
  });

  it('keeps every fertile window at 7 days, also across clock changes', () => {
    // The first run is the tail of the current cycle's window
    expect([...new Set(fertileRuns.slice(1))]).toEqual([7]);
  });
});

describe('symptom statistics', () => {
  const symptoms = [
    symptom('2026-11-05', 'cramps'),
    symptom('2026-11-06', 'cramps'),
    symptom('2026-11-07', 'cramps'),
    symptom('2026-11-08', 'cramps'),
    symptom('2026-10-08', 'cramps'),
    symptom('2026-11-05', 'period_pain_4'),
    symptom('2026-11-06', 'period_pain_8'),
    symptom('2026-11-07', 'period_pain_6'),
    symptom('2026-10-17', 'headache'), // fertile day before ovulation
    symptom('2026-10-22', 'bloating'), // day after ovulation
    symptom('2026-10-21', 'mood_happy'), // ovulation day
  ];
  const summary = (phase: PhaseType) =>
    getSymptomsForPhaseHistory(phase, REGULAR, symptoms).map((s) => [s.symptom, s.occurrences, s.days]);

  it('counts a symptom once per cycle, however many days it was logged', () => {
    expect(summary(PhaseType.MENSTRUAL)).toEqual([
      ['cramps', 2, 5],
      ['period_pain_4', 1, 1],
      ['period_pain_8', 1, 1],
      ['period_pain_6', 1, 1],
    ]);
  });

  it('does not drop symptoms logged in the fertile window', () => {
    expect(summary(PhaseType.FOLLICULAR)).toEqual([['headache', 1, 1]]);
    expect(summary(PhaseType.LUTEAL)).toEqual([['bloating', 1, 1]]);
    expect(summary(PhaseType.OVULATION)).toEqual([['mood_happy', 1, 1]]);
  });

  it('averages pain over the days it was logged', () => {
    expect(calculateAveragePain(getSymptomsForPhaseHistory(PhaseType.MENSTRUAL, REGULAR, symptoms))).toBe(6);
  });
});
