'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ChartColumn } from 'lucide-react';
import { db } from '@/lib/db';
import PainBar from '@/components/PainBar';
import {
  getCycleHistory,
  getCycleLengthStats,
  getPeriodDurationStats,
  getSymptomsForPhaseHistory,
  type CycleHistoryEntry,
  type PhaseSymptomHistory,
} from '@/lib/cycle-logic';
import { getSymptomLabel, isPeriodPainSymptom, calculateAveragePain } from '@/lib/symptom-utils';
import type { Cycle, Symptom, CustomSymptomType } from '@/types';
import { PhaseType } from '@/types';

const PHASE_INFO: Record<PhaseType, { name: string; color: string }> = {
  [PhaseType.MENSTRUAL]: { name: 'Menstrual', color: 'bg-phase-menstrual' },
  [PhaseType.FOLLICULAR]: { name: 'Follicular', color: 'bg-phase-follicular' },
  [PhaseType.FERTILE]: { name: 'Fertile', color: 'bg-phase-fertile' },
  [PhaseType.OVULATION]: { name: 'Ovulation', color: 'bg-phase-ovulation-strong' },
  [PhaseType.LUTEAL]: { name: 'Luteal', color: 'bg-phase-luteal' },
};

// Phases to show in symptoms section (excluding FERTILE as it overlaps with others)
const SYMPTOM_PHASES: PhaseType[] = [
  PhaseType.MENSTRUAL,
  PhaseType.FOLLICULAR,
  PhaseType.OVULATION,
  PhaseType.LUTEAL,
];

// Cycle lengths outside this range are worth a neutral note
const TYPICAL_MIN_CYCLE = 21;
const TYPICAL_MAX_CYCLE = 35;
const NOTABLE_VARIATION = 7;

function pluralDays(count: number): string {
  return `${count} ${count === 1 ? 'day' : 'days'}`;
}

export default function InsightsView() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [customSymptomTypes, setCustomSymptomTypes] = useState<CustomSymptomType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [allCycles, allSymptoms, allCustomTypes] = await Promise.all([
        db.getAllCycles(),
        db.getAllSymptoms(),
        db.getAllCustomSymptomTypes(),
      ]);
      setCycles(allCycles);
      setSymptoms(allSymptoms);
      setCustomSymptomTypes(allCustomTypes);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const cycleLengthStats = useMemo(() => getCycleLengthStats(cycles, 6), [cycles]);
  const periodDurationStats = useMemo(() => getPeriodDurationStats(cycles, 6), [cycles]);
  const history = useMemo(() => getCycleHistory(cycles, 6), [cycles]);

  // Number of cycles to analyze (max 6)
  const cyclesAnalyzed = Math.min(cycles.length, 6);

  const symptomsByPhase = useMemo(() => {
    const result = {} as Record<PhaseType, PhaseSymptomHistory[]>;
    SYMPTOM_PHASES.forEach((phase) => {
      result[phase] = getSymptomsForPhaseHistory(phase, cycles, symptoms, 6);
    });
    return result;
  }, [cycles, symptoms]);

  const hasAnySymptoms = symptoms.length > 0;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (cycles.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
        <ChartColumn className="mb-4 h-14 w-14 text-brand-pink" strokeWidth={1.5} aria-hidden="true" />
        <h2 className="mb-2 text-xl font-semibold text-gray-900">Your insights start here</h2>
        <p className="text-gray-600">
          Log a period start in the calendar to see cycle statistics and predictions.
        </p>
      </div>
    );
  }

  const regularityNote = getRegularityNote(cycleLengthStats);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold text-gray-900">Insights</h1>
      <p className="mb-5 text-sm text-gray-500">Based on your last 6 cycles</p>

      {/* Averages */}
      <section className="mb-6">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            title="Cycle length"
            stats={cycleLengthStats}
            emptyHint="Log two period starts to see this"
          />
          <StatCard
            title="Period duration"
            stats={periodDurationStats}
            emptyHint="Log a period end to see this"
          />
        </div>
        {regularityNote && (
          <p className="mt-3 rounded-2xl bg-brand-pink/10 p-3 text-sm text-gray-700">
            {regularityNote}
          </p>
        )}
      </section>

      {/* Cycle history */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Cycle history</h2>
        <CycleHistoryChart history={history} />
        <p className="mt-3 text-sm text-gray-500">
          {cycles.length} {cycles.length === 1 ? 'period' : 'periods'} tracked in total
        </p>
      </section>

      {/* Symptoms by Phase - Always show all 4 phases */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Common symptoms by phase</h2>
        <div className="space-y-3">
          {SYMPTOM_PHASES.map((phase) => {
            const info = PHASE_INFO[phase];
            const phaseSymptoms = symptomsByPhase[phase] || [];
            // Individual pain levels are summarised as one average instead
            const nonPainSymptoms = phaseSymptoms.filter((s) => !isPeriodPainSymptom(s.symptom));
            const avgPain = calculateAveragePain(phaseSymptoms);
            const hasSymptoms = nonPainSymptoms.length > 0 || avgPain !== null;

            return (
              <div key={phase} className="rounded-2xl border border-gray-200 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${info.color}`} />
                  <h3 className="font-medium text-gray-900">{info.name}</h3>
                </div>
                {hasSymptoms ? (
                  <div className="space-y-2.5">
                    {nonPainSymptoms.map(({ symptom, occurrences }) => (
                      <div key={symptom}>
                        <div className="flex items-baseline justify-between text-sm">
                          <span className="text-gray-800">
                            {getSymptomLabel(symptom, customSymptomTypes)}
                          </span>
                          <span className="text-gray-500">
                            {occurrences} of {cyclesAnalyzed} {cyclesAnalyzed === 1 ? 'cycle' : 'cycles'}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full ${info.color}`}
                            style={{ width: `${Math.min((occurrences / cyclesAnalyzed) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {avgPain !== null && <PainBar average={avgPain} />}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    {hasAnySymptoms
                      ? 'No symptoms logged in this phase yet'
                      : 'Log symptoms in the calendar to see them here'}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function getRegularityNote(stats: { min: number; max: number } | null): string | null {
  if (!stats) return null;

  if (stats.min < TYPICAL_MIN_CYCLE || stats.max > TYPICAL_MAX_CYCLE) {
    return `Some of your recent cycles were shorter than ${TYPICAL_MIN_CYCLE} or longer than ${TYPICAL_MAX_CYCLE} days. That can be normal, but it is worth mentioning to a doctor if it keeps happening.`;
  }
  if (stats.max - stats.min > NOTABLE_VARIATION) {
    return `Your cycle length varied by ${stats.max - stats.min} days recently, so predictions are less precise.`;
  }
  return null;
}

interface StatCardProps {
  title: string;
  stats: { min: number; max: number; avg: number } | null;
  emptyHint: string;
}

function StatCard({ title, stats, emptyHint }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 p-4">
      <div className="text-sm text-gray-500">{title}</div>
      {stats ? (
        <>
          <div className="mt-1">
            <span className="text-3xl font-semibold text-brand-red">{stats.avg}</span>
            <span className="ml-1 text-sm text-gray-600">{stats.avg === 1 ? 'day' : 'days'}</span>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {stats.min === stats.max
              ? 'Same every cycle'
              : `Range ${stats.min}–${stats.max} days`}
          </div>
        </>
      ) : (
        <>
          <div className="mt-1 text-3xl font-semibold text-gray-300">&ndash;</div>
          <div className="mt-1 text-xs text-gray-500">{emptyHint}</div>
        </>
      )}
    </div>
  );
}

/**
 * One horizontal bar per cycle: full width is the cycle length, the red
 * part is the period.
 */
function CycleHistoryChart({ history }: { history: CycleHistoryEntry[] }) {
  const today = new Date();
  const rows = history.map((entry) => {
    const start = parseISO(entry.cycle.period_start_date);
    const isCurrent = entry.length === null;
    const days = isCurrent ? differenceInCalendarDays(today, start) + 1 : (entry.length as number);
    return { entry, start, isCurrent, days: Math.max(days, 1) };
  });
  // Bars share one scale; excluded gaps are capped so they do not flatten the rest
  const scale = Math.max(
    TYPICAL_MAX_CYCLE,
    ...rows.filter((r) => r.entry.counted).map((r) => r.days)
  );

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 p-4">
      {rows.map(({ entry, start, isCurrent, days }) => {
        const shown = Math.min(days, scale);
        const period = Math.min(entry.periodLength, shown);
        const excluded = !isCurrent && !entry.counted;

        return (
          <div key={entry.cycle.id}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="text-gray-800">{format(start, 'd MMM yyyy')}</span>
              <span className="text-gray-500">
                {isCurrent
                  ? `Current · day ${days}`
                  : excluded
                  ? `${pluralDays(days)} · not counted`
                  : pluralDays(days)}
              </span>
            </div>
            <div className="h-3 rounded-full bg-gray-100">
              <div
                className={`flex h-full overflow-hidden rounded-full ${
                  excluded
                    ? 'border border-dashed border-gray-400'
                    : isCurrent
                    ? 'bg-brand-pink/25'
                    : 'bg-brand-pink/50'
                }`}
                style={{ width: `${(shown / scale) * 100}%` }}
              >
                <div
                  className="h-full rounded-full bg-phase-menstrual"
                  style={{ width: `${(period / shown) * 100}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
      <div className="flex gap-4 pt-1 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-phase-menstrual" />
          Period
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-pink/50" />
          Rest of cycle
        </span>
      </div>
    </div>
  );
}
