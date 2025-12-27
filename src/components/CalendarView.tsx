'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  parseISO,
} from 'date-fns';
import { db } from '@/lib/db';
import {
  calculateAverageCycleLength,
  calculateAveragePeriodDuration,
  getPhaseForDate,
  findCycleForDate,
  getSymptomsForPhaseHistory,
  getPredictedPhaseForDate,
} from '@/lib/cycle-logic';
import type { Cycle, Symptom, PhaseType } from '@/types';
import { PhaseType as Phase, SymptomType } from '@/types';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import PhaseSymptoms from '@/components/PhaseSymptoms';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Symptom categories for the drawer
const SYMPTOM_CATEGORIES = {
  physical: {
    label: 'Physical',
    symptoms: [
      { type: SymptomType.CRAMPS, label: 'Cramps' },
      { type: SymptomType.HEADACHE, label: 'Headache' },
      { type: SymptomType.BLOATING, label: 'Bloating' },
      { type: SymptomType.BREAST_TENDERNESS, label: 'Breast Tenderness' },
      { type: SymptomType.FATIGUE, label: 'Fatigue' },
      { type: SymptomType.BACKACHE, label: 'Backache' },
      { type: SymptomType.NAUSEA, label: 'Nausea' },
      { type: SymptomType.ACNE, label: 'Acne' },
      { type: SymptomType.INSOMNIA, label: 'Insomnia' },
      { type: SymptomType.CRAVINGS, label: 'Cravings' },
    ],
  },
  flow: {
    label: 'Flow',
    symptoms: [
      { type: SymptomType.FLOW_LIGHT, label: 'Light' },
      { type: SymptomType.FLOW_MEDIUM, label: 'Medium' },
      { type: SymptomType.FLOW_HEAVY, label: 'Heavy' },
      { type: SymptomType.SPOTTING, label: 'Spotting' },
    ],
  },
  mood: {
    label: 'Mood',
    symptoms: [
      { type: SymptomType.MOOD_HAPPY, label: 'Happy' },
      { type: SymptomType.MOOD_SAD, label: 'Sad' },
      { type: SymptomType.MOOD_IRRITABLE, label: 'Irritable' },
      { type: SymptomType.MOOD_ANXIOUS, label: 'Anxious' },
      { type: SymptomType.MOOD_CALM, label: 'Calm' },
    ],
  },
};

// Helper function to get phase for a specific date
function getDayPhaseForDate(
  date: Date,
  cycles: Cycle[],
  cycleLength: number,
  averagePeriodLength: number = 5
): { phase: PhaseType | null; isPrediction: boolean } {
  const cycle = findCycleForDate(date, cycles);

  if (cycle) {
    // Date belongs to a recorded cycle
    const sortedCycles = [...cycles].sort(
      (a, b) =>
        parseISO(a.period_start_date).getTime() -
        parseISO(b.period_start_date).getTime()
    );
    const cycleIndex = sortedCycles.findIndex((c) => c.id === cycle.id);
    const nextCycle = sortedCycles[cycleIndex + 1];
    const nextCycleStart = nextCycle
      ? parseISO(nextCycle.period_start_date)
      : null;

    return {
      phase: getPhaseForDate(date, cycle, nextCycleStart, cycleLength),
      isPrediction: false,
    };
  }

  // No recorded cycle - use prediction for future dates
  if (cycles.length >= 2) {
    const predictedPhase = getPredictedPhaseForDate(
      date,
      cycles,
      cycleLength,
      averagePeriodLength
    );
    return { phase: predictedPhase, isPrediction: true };
  }

  return { phase: null, isPrediction: false };
}

export default function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
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

  const cycleLength = calculateAverageCycleLength(cycles);
  const periodLength = calculateAveragePeriodDuration(cycles) || 5;

  // Get today's phase and historical symptoms for that phase
  const todayPhase = useMemo(() => {
    const today = new Date();
    const result = getDayPhaseForDate(today, cycles, cycleLength, periodLength);
    return result.phase;
  }, [cycles, cycleLength, periodLength]);

  const phaseSymptoms = useMemo(() => {
    if (!todayPhase) return [];
    return getSymptomsForPhaseHistory(todayPhase, cycles, symptoms, cycleLength, 6);
  }, [todayPhase, cycles, symptoms, cycleLength]);

  const getCalendarDays = useCallback(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    // Start from Monday
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const getDayPhaseInfo = useCallback(
    (date: Date): { phase: PhaseType | null; isPrediction: boolean } => {
      return getDayPhaseForDate(date, cycles, cycleLength, periodLength);
    },
    [cycles, cycleLength, periodLength]
  );

  const getPhaseColor = (phase: PhaseType | null, isPrediction: boolean): string => {
    if (isPrediction) {
      // Lighter/muted colors for predictions
      switch (phase) {
        case Phase.MENSTRUAL:
          return 'bg-phase-menstrual/50 text-white';
        case Phase.FOLLICULAR:
          return 'bg-phase-follicular/50 text-white';
        case Phase.OVULATION:
          return 'bg-phase-ovulation/50 text-white';
        case Phase.FERTILE:
          return 'border-2 border-phase-fertile/50 bg-white text-gray-500';
        case Phase.LUTEAL:
          return 'bg-phase-luteal/50 text-white';
        default:
          return 'bg-white text-gray-900';
      }
    }

    switch (phase) {
      case Phase.MENSTRUAL:
        return 'bg-phase-menstrual text-white';
      case Phase.FOLLICULAR:
        return 'bg-phase-follicular text-white';
      case Phase.OVULATION:
        return 'bg-phase-ovulation text-white';
      case Phase.FERTILE:
        return 'border-2 border-phase-fertile bg-white text-gray-900';
      case Phase.LUTEAL:
        return 'bg-phase-luteal text-white';
      default:
        return 'bg-white text-gray-900';
    }
  };

  const getTodayRingColor = (phase: PhaseType | null): string => {
    switch (phase) {
      case Phase.MENSTRUAL:
        return 'ring-red-900';
      case Phase.FOLLICULAR:
        return 'ring-teal-700';
      case Phase.OVULATION:
        return 'ring-green-700';
      case Phase.FERTILE:
        return 'ring-green-700';
      case Phase.LUTEAL:
        return 'ring-blue-700';
      default:
        return 'ring-gray-400';
    }
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setIsDrawerOpen(true);
  };

  const handleMarkPeriodStart = async () => {
    if (!selectedDate) return;

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      await db.addCycle(dateStr);
      await loadData();
      setIsDrawerOpen(false);
    } catch (error) {
      console.error('Failed to mark period start:', error);
    }
  };

  const handleMarkPeriodEnd = async () => {
    if (!selectedDate) return;

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      // Find the most recent cycle that doesn't have an end date
      const sortedCycles = [...cycles].sort(
        (a, b) =>
          parseISO(b.period_start_date).getTime() -
          parseISO(a.period_start_date).getTime()
      );
      const openCycle = sortedCycles.find((c) => !c.period_end_date);

      if (openCycle) {
        await db.updateCycle(openCycle.id, openCycle.period_start_date, dateStr);
        await loadData();
      }
      setIsDrawerOpen(false);
    } catch (error) {
      console.error('Failed to mark period end:', error);
    }
  };

  const handleRemovePeriodStart = async () => {
    if (!selectedDate) return;

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const cycleToRemove = cycles.find((c) => c.period_start_date === dateStr);

      if (cycleToRemove) {
        await db.deleteCycle(cycleToRemove.id);
        await loadData();
      }
      setIsDrawerOpen(false);
    } catch (error) {
      console.error('Failed to remove period start:', error);
    }
  };

  const handleRemovePeriodEnd = async () => {
    if (!selectedDate) return;

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const cycleToUpdate = cycles.find((c) => c.period_end_date === dateStr);

      if (cycleToUpdate) {
        // Remove the end date by setting it to undefined
        await db.updateCycle(cycleToUpdate.id, cycleToUpdate.period_start_date, undefined);
        await loadData();
      }
      setIsDrawerOpen(false);
    } catch (error) {
      console.error('Failed to remove period end:', error);
    }
  };

  // Check if selected date is a period start or end
  const getSelectedDateInfo = useCallback(() => {
    if (!selectedDate) return { isPeriodStart: false, isPeriodEnd: false, symptoms: [] as Symptom[] };

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const cycleWithStart = cycles.find((c) => c.period_start_date === dateStr);
    const cycleWithEnd = cycles.find((c) => c.period_end_date === dateStr);
    const dateSymptoms = symptoms.filter((s) => s.date === dateStr);

    return {
      isPeriodStart: !!cycleWithStart,
      isPeriodEnd: !!cycleWithEnd,
      cycleWithStart,
      cycleWithEnd,
      symptoms: dateSymptoms,
    };
  }, [selectedDate, cycles, symptoms]);

  const selectedDateInfo = getSelectedDateInfo();

  // Check if a day has any user entries (period start/end or symptoms)
  const getDayHasEntries = useCallback(
    (date: Date): boolean => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const hasPeriodStart = cycles.some((c) => c.period_start_date === dateStr);
      const hasPeriodEnd = cycles.some((c) => c.period_end_date === dateStr);
      const hasSymptoms = symptoms.some((s) => s.date === dateStr);
      return hasPeriodStart || hasPeriodEnd || hasSymptoms;
    },
    [cycles, symptoms]
  );

  // Toggle a symptom for the selected date
  const handleToggleSymptom = async (symptomType: string) => {
    if (!selectedDate) return;

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const existingSymptom = selectedDateInfo.symptoms.find(
        (s) => s.symptom_type === symptomType
      );

      if (existingSymptom) {
        // Remove symptom
        await db.deleteSymptom(existingSymptom.id);
      } else {
        // Add symptom
        await db.addSymptom(dateStr, symptomType);
      }
      await loadData();
    } catch (error) {
      console.error('Failed to toggle symptom:', error);
    }
  };

  // Check if a symptom is selected for the current date
  const isSymptomSelected = (symptomType: string): boolean => {
    return selectedDateInfo.symptoms.some((s) => s.symptom_type === symptomType);
  };

  const calendarDays = getCalendarDays();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col p-4">
      {/* Month Navigation */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="rounded-full p-2 hover:bg-gray-100"
        >
          <ChevronLeftIcon />
        </button>
        <h2 className="text-xl font-semibold text-gray-900">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="rounded-full p-2 hover:bg-gray-100"
        >
          <ChevronRightIcon />
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="mb-2 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-xs font-medium text-gray-500"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());
          const { phase, isPrediction } = isCurrentMonth
            ? getDayPhaseInfo(day)
            : { phase: null, isPrediction: false };
          const phaseColor = getPhaseColor(phase, isPrediction);
          const todayRingColor = getTodayRingColor(phase);
          const hasEntries = isCurrentMonth && getDayHasEntries(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDayClick(day)}
              className={`relative flex h-12 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                isCurrentMonth ? phaseColor : 'text-gray-300'
              }`}
            >
              {isToday ? (
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full ring-2 ${todayRingColor}`}
                >
                  {format(day, 'd')}
                </span>
              ) : (
                format(day, 'd')
              )}
              {hasEntries && (
                <span className="absolute right-1 top-1">
                  <PenIcon />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Empty State */}
      {cycles.length === 0 && (
        <div className="mt-8 rounded-lg bg-brand-pink/20 p-4 text-center">
          <p className="text-gray-700">
            Start tracking your periods as they come, or fill in historic data
            from the last 6 months.
          </p>
        </div>
      )}

      {/* Phase Legend */}
      <div className="mt-6 grid grid-cols-2 gap-2 text-xs">
        <LegendItem color="bg-phase-menstrual" label="Menstrual" />
        <LegendItem color="bg-phase-follicular" label="Follicular" />
        <LegendItem
          color="border-2 border-phase-fertile bg-white"
          label="Fertile"
        />
        <LegendItem color="bg-phase-ovulation" label="Ovulation" />
        <LegendItem color="bg-phase-luteal" label="Luteal" />
      </div>

      {/* Phase Symptoms - shows historical symptoms for current phase */}
      {cycles.length > 0 && (
        <PhaseSymptoms phase={todayPhase} symptoms={phaseSymptoms} />
      )}

      {/* Date Action Drawer */}
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>
              {selectedDate && format(selectedDate, 'MMMM d, yyyy')}
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-8">
            {/* Period Actions */}
            <div className="mb-6 flex gap-2">
              {selectedDateInfo.isPeriodStart ? (
                <Button
                  variant="outline"
                  className="h-12 flex-1 border-red-500 text-red-500 hover:bg-red-50"
                  onClick={handleRemovePeriodStart}
                >
                  Remove Start
                </Button>
              ) : (
                <Button
                  className="h-12 flex-1 bg-brand-red text-white hover:bg-brand-red/90"
                  onClick={handleMarkPeriodStart}
                >
                  Period Start
                </Button>
              )}

              {selectedDateInfo.isPeriodEnd ? (
                <Button
                  variant="outline"
                  className="h-12 flex-1 border-red-500 text-red-500 hover:bg-red-50"
                  onClick={handleRemovePeriodEnd}
                >
                  Remove End
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="h-12 flex-1 border-brand-red text-brand-red hover:bg-brand-red/10"
                  onClick={handleMarkPeriodEnd}
                  disabled={!cycles.some((c) => !c.period_end_date)}
                >
                  Period End
                </Button>
              )}
            </div>

            {/* Symptoms */}
            <div className="space-y-4">
              {Object.entries(SYMPTOM_CATEGORIES).map(([key, category]) => (
                <div key={key}>
                  <h3 className="mb-2 text-sm font-medium text-gray-500">
                    {category.label}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {category.symptoms.map(({ type, label }) => (
                      <button
                        key={type}
                        onClick={() => handleToggleSymptom(type)}
                        className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                          isSymptomSelected(type)
                            ? 'bg-brand-fuchsia text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-4 w-4 rounded ${color}`} />
      <span className="text-gray-600">{label}</span>
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className="h-5 w-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 19.5 8.25 12l7.5-7.5"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className="h-5 w-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m8.25 4.5 7.5 7.5-7.5 7.5"
      />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3 w-3 opacity-60"
    >
      <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
      <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
    </svg>
  );
}
