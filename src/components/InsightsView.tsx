'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '@/lib/db';
import {
  getCycleLengthStats,
  getPeriodDurationStats,
  getSymptomsForPhaseHistory,
  type PhaseSymptomHistory,
} from '@/lib/cycle-logic';
import { getSymptomLabel, isPeriodPainSymptom, calculateAveragePain } from '@/lib/symptom-utils';
import type { Cycle, Symptom, CustomSymptomType } from '@/types';
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

// Phases to show in symptoms section (excluding FERTILE as it overlaps with others)
const SYMPTOM_PHASES: PhaseType[] = [
  PhaseType.MENSTRUAL,
  PhaseType.FOLLICULAR,
  PhaseType.OVULATION,
  PhaseType.LUTEAL,
];

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

  // Number of cycles to analyze (max 6)
  const cyclesAnalyzed = Math.min(cycles.length, 6);

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
      // Show all symptoms, not just top 3
      result[phase] = phaseSymptoms;
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
            emptyHint="Track the actual Beginning of your period at least twice to see data here"
          />

          {/* Period Duration */}
          <StatGroup
            title="Period Duration"
            stats={periodDurationStats}
            unit="days"
            color="bg-phase-menstrual"
            emptyHint="Track the actual End of your period at least twice to see data here"
          />
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
            // Filter out individual pain levels
            const nonPainSymptoms = phaseSymptoms.filter(
              (s) => !isPeriodPainSymptom(s.symptom)
            );
            // Calculate average pain for this phase
            const avgPain = calculateAveragePain(phaseSymptoms);
            const hasSymptoms = nonPainSymptoms.length > 0 || avgPain !== null;

            return (
              <div key={phase} className="rounded-lg border border-gray-200 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${info.bgColor}`} />
                  <h3 className="text-sm font-medium text-gray-900">
                    {info.name}
                  </h3>
                </div>
                {hasSymptoms ? (
                  <div className="flex flex-wrap gap-2">
                    {nonPainSymptoms.map(({ symptom, occurrences }) => (
                      <div
                        key={symptom}
                        className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1"
                      >
                        <span className="text-xs text-gray-700">
                          {getSymptomLabel(symptom, customSymptomTypes)}
                        </span>
                        <span className={`text-xs font-medium ${info.color}`}>
                          {occurrences}/{cyclesAnalyzed}
                        </span>
                      </div>
                    ))}
                    {avgPain !== null && (
                      <div className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1">
                        <span className="text-xs text-gray-700">
                          Pain (Ø {avgPain.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })})
                        </span>
                      </div>
                    )}
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
      
      {/* Cycle Count */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-medium text-gray-700">History</h2>
        <div className="rounded-lg bg-gray-100 p-4">
          <div className="text-sm font-medium text-gray-700">Periods Tracked</div>
          <div className="text-3xl font-bold text-gray-900">{cycles.length}</div>
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
  emptyHint?: string;
}

function StatGroup({ title, stats, unit, color, emptyHint }: StatGroupProps) {
  if (!stats) {
    return (
      <div className="rounded-lg bg-gray-100 p-4">
        <div className="text-sm font-medium text-gray-700">{title}</div>
        <div className="text-lg text-gray-500">Not enough data</div>
        {emptyHint && <div className="mt-1 text-xs text-gray-400">{emptyHint}</div>}
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
