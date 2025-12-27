'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { db } from '@/lib/db';
import {
  calculateAverageCycleLength,
  calculateAveragePeriodDuration,
  getCycleLengthVariation,
  getNextPredictedPeriod,
  getNextPredictedOvulation,
} from '@/lib/cycle-logic';
import type { Cycle, Symptom } from '@/types';

interface SymptomCount {
  symptom: string;
  count: number;
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

  const averageCycleLength = calculateAverageCycleLength(cycles);
  const averagePeriodDuration = calculateAveragePeriodDuration(cycles);
  const variation = getCycleLengthVariation(cycles);
  const nextPeriod = getNextPredictedPeriod(cycles, averageCycleLength);
  const nextOvulation = getNextPredictedOvulation(cycles, averageCycleLength);

  // Calculate most common symptoms
  const symptomCounts: Record<string, number> = {};
  symptoms.forEach((s) => {
    symptomCounts[s.symptom_type] = (symptomCounts[s.symptom_type] || 0) + 1;
  });

  const topSymptoms: SymptomCount[] = Object.entries(symptomCounts)
    .map(([symptom, count]) => ({ symptom, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="p-4">
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Insights</h1>

      {/* Predictions */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-medium text-gray-700">Predictions</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Next Period"
            value={nextPeriod ? format(new Date(nextPeriod), 'MMM d') : '-'}
            color="bg-phase-menstrual"
          />
          <StatCard
            label="Next Ovulation"
            value={
              nextOvulation ? format(new Date(nextOvulation), 'MMM d') : '-'
            }
            color="bg-phase-ovulation"
          />
        </div>
      </section>

      {/* Cycle Statistics */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-medium text-gray-700">
          Cycle Statistics
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Avg Cycle Length"
            value={`${averageCycleLength} days`}
            color="bg-brand-pink"
          />
          <StatCard
            label="Avg Period Duration"
            value={
              averagePeriodDuration ? `${averagePeriodDuration} days` : '-'
            }
            color="bg-brand-pink"
          />
          {variation && (
            <>
              <StatCard
                label="Shortest Cycle"
                value={`${variation.min} days`}
                color="bg-gray-100"
                textColor="text-gray-700"
              />
              <StatCard
                label="Longest Cycle"
                value={`${variation.max} days`}
                color="bg-gray-100"
                textColor="text-gray-700"
              />
            </>
          )}
        </div>
      </section>

      {/* Cycle Count */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-medium text-gray-700">History</h2>
        <div className="rounded-lg bg-gray-50 p-4">
          <div className="text-3xl font-bold text-brand-red">{cycles.length}</div>
          <div className="text-sm text-gray-600">Periods tracked</div>
        </div>
      </section>

      {/* Common Symptoms */}
      {topSymptoms.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-medium text-gray-700">
            Most Common Symptoms
          </h2>
          <div className="space-y-2">
            {topSymptoms.map(({ symptom, count }) => (
              <div
                key={symptom}
                className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
              >
                <span className="capitalize text-gray-700">
                  {formatSymptomName(symptom)}
                </span>
                <span className="font-medium text-brand-red">{count}x</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  color: string;
  textColor?: string;
}

function StatCard({
  label,
  value,
  color,
  textColor = 'text-white',
}: StatCardProps) {
  return (
    <div className={`rounded-lg p-4 ${color}`}>
      <div className={`text-2xl font-bold ${textColor}`}>{value}</div>
      <div className={`text-sm ${textColor} opacity-80`}>{label}</div>
    </div>
  );
}

function formatSymptomName(symptom: string): string {
  return symptom
    .replace(/_/g, ' ')
    .replace(/^(flow|mood)\s/, '')
    .toLowerCase();
}
