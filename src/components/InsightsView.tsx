'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '@/lib/db';
import {
  getCycleLengthStats,
  getPeriodDurationStats,
  getDaysUntilOvulationStats,
  getSymptomsForPhaseHistory,
  type PhaseSymptomHistory,
} from '@/lib/cycle-logic';
import type { Cycle, Symptom } from '@/types';
import { PhaseType } from '@/types';

const PHASE_INFO: Record<PhaseType, { name: string; color: string; bgColor: string }> = {
  [PhaseType.MENSTRUAL]: {
    name: 'Menstrual',
    color: 'text-phase-menstrual',
    bgColor: 'bg-phase-menstrual',
  },
  [PhaseType.FOLLICULAR]: {
    name: 'Follicular',
    color: 'text-phase-follicular',
    bgColor: 'bg-phase-follicular',
  },
  [PhaseType.FERTILE]: {
    name: 'Fertile',
    color: 'text-phase-fertile',
    bgColor: 'bg-phase-fertile',
  },
  [PhaseType.OVULATION]: {
    name: 'Ovulation',
    color: 'text-phase-ovulation',
    bgColor: 'bg-phase-ovulation',
  },
  [PhaseType.LUTEAL]: {
    name: 'Luteal',
    color: 'text-phase-luteal',
    bgColor: 'bg-phase-luteal',
  },
};

const SYMPTOM_LABELS: Record<string, string> = {
  cramps: 'Cramps',
  headache: 'Headache',
  bloating: 'Bloating',
  breast_tenderness: 'Breast Tenderness',
  fatigue: 'Fatigue',
  backache: 'Backache',
  nausea: 'Nausea',
  acne: 'Acne',
  insomnia: 'Insomnia',
  cravings: 'Cravings',
  flow_light: 'Light Flow',
  flow_medium: 'Medium Flow',
  flow_heavy: 'Heavy Flow',
  spotting: 'Spotting',
  mood_happy: 'Happy',
  mood_sad: 'Sad',
  mood_irritable: 'Irritable',
  mood_anxious: 'Anxious',
  mood_calm: 'Calm',
  mood_horny: 'Horny',
};

// Phases to show in symptoms section (excluding FERTILE as it overlaps with others)
const SYMPTOM_PHASES: PhaseType[] = [
  PhaseType.MENSTRUAL,
  PhaseType.FOLLICULAR,
  PhaseType.OVULATION,
  PhaseType.LUTEAL,
];

function getSymptomLabel(symptom: string): string {
  return SYMPTOM_LABELS[symptom] || symptom.replace(/_/g, ' ');
}

export default function InsightsView() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [allCycles, allSymptoms] = await Promise.all([
        db.getAllCycles(),
        db.getAllSymptoms(),
      ]);
      setCycles(allCycles);
      setSymptoms(allSymptoms);
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
  const ovulationStats = useMemo(() => getDaysUntilOvulationStats(cycles, 6), [cycles]);

  // Calculate symptoms by phase - always compute for all 4 phases
  const symptomsByPhase = useMemo(() => {
    const result: Record<PhaseType, PhaseSymptomHistory[]> = {} as Record<PhaseType, PhaseSymptomHistory[]>;

    if (cycles.length === 0) {
      // Return empty arrays for all phases
      SYMPTOM_PHASES.forEach((phase) => {
        result[phase] = [];
      });
      return result;
    }

    const avgCycleLength = cycleLengthStats?.avg || 28;

    SYMPTOM_PHASES.forEach((phase) => {
      const phaseSymptoms = getSymptomsForPhaseHistory(
        phase,
        cycles,
        symptoms,
        avgCycleLength,
        6
      );
      result[phase] = phaseSymptoms.slice(0, 3); // Top 3 per phase
    });

    return result;
  }, [cycles, symptoms, cycleLengthStats]);

  // Check if there are any symptoms recorded
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
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 text-6xl">📊</div>
        <h2 className="mb-2 text-xl font-semibold text-gray-900">
          No Data Yet
        </h2>
        <p className="text-gray-600">
          Start tracking your periods to see insights and predictions.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Insights</h1>

      {/* Cycle Statistics */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-medium text-gray-700">
          Cycle Statistics
        </h2>
        <p className="mb-3 text-xs text-gray-500">Based on your last 6 cycles</p>

        <div className="space-y-4">
          {/* Cycle Length */}
          <StatGroup
            title="Cycle Length"
            stats={cycleLengthStats}
            unit="days"
            color="bg-brand-pink"
          />

          {/* Period Duration */}
          <StatGroup
            title="Period Duration"
            stats={periodDurationStats}
            unit="days"
            color="bg-phase-menstrual"
          />

          {/* Days Until Ovulation */}
          <StatGroup
            title="Days Until Ovulation"
            stats={ovulationStats}
            unit="days"
            color="bg-phase-ovulation"
          />
        </div>
      </section>

      {/* Cycle Count */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-medium text-gray-700">History</h2>
        <div className="rounded-lg bg-gray-100 p-4">
          <div className="text-sm font-medium text-gray-700">Periods Tracked</div>
          <div className="text-3xl font-bold text-gray-900">{cycles.length}</div>
        </div>
      </section>

      {/* Symptoms by Phase - Always show all 4 phases */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-medium text-gray-700">
          Common Symptoms by Phase
        </h2>
        <div className="space-y-4">
          {SYMPTOM_PHASES.map((phase) => {
            const info = PHASE_INFO[phase];
            const phaseSymptoms = symptomsByPhase[phase] || [];

            return (
              <div key={phase} className="rounded-lg border border-gray-200 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${info.bgColor}`} />
                  <h3 className="text-sm font-medium text-gray-900">
                    {info.name}
                  </h3>
                </div>
                {phaseSymptoms.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {phaseSymptoms.map(({ symptom, percentage }) => (
                      <div
                        key={symptom}
                        className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1"
                      >
                        <span className="text-xs text-gray-700">
                          {getSymptomLabel(symptom)}
                        </span>
                        <span className={`text-xs font-medium ${info.color}`}>
                          {percentage}%
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">
                    {hasAnySymptoms
                      ? 'No symptoms recorded for this phase yet'
                      : 'Enter some symptoms in the calendar to see them here'}
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

interface StatGroupProps {
  title: string;
  stats: { min: number; max: number; avg: number } | null;
  unit: string;
  color: string;
}

function StatGroup({ title, stats, unit, color }: StatGroupProps) {
  if (!stats) {
    return (
      <div className="rounded-lg bg-gray-100 p-4">
        <div className="text-sm font-medium text-gray-700">{title}</div>
        <div className="text-lg text-gray-500">Not enough data</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <div className="mb-3 text-sm font-medium text-gray-700">{title}</div>
      <div className="grid grid-cols-3 gap-2">
        <div className={`rounded-lg p-3 ${color}`}>
          <div className="text-xs font-medium text-white/80">Average</div>
          <div className="text-xl font-bold text-white">
            {stats.avg} <span className="text-sm font-normal">{unit}</span>
          </div>
        </div>
        <div className="rounded-lg bg-gray-200 p-3">
          <div className="text-xs font-medium text-gray-600">Shortest</div>
          <div className="text-xl font-bold text-gray-900">
            {stats.min} <span className="text-sm font-normal text-gray-600">{unit}</span>
          </div>
        </div>
        <div className="rounded-lg bg-gray-200 p-3">
          <div className="text-xs font-medium text-gray-600">Longest</div>
          <div className="text-xl font-bold text-gray-900">
            {stats.max} <span className="text-sm font-normal text-gray-600">{unit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
