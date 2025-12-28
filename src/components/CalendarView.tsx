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
  isAfter,
  startOfDay,
  isWithinInterval,
  addDays,
} from 'date-fns';
import { db } from '@/lib/db';
import {
  calculateAverageCycleLength,
  calculateAveragePeriodDuration,
  getPhaseForDate,
  findCycleForDate,
  getSymptomsForPhaseHistory,
  getPredictedPhaseForDate,
  getFertileWindow,
  getOvulationDate,
} from '@/lib/cycle-logic';
import type { Cycle, Symptom, PhaseType, OvulationMarker } from '@/types';
import { PhaseType as Phase, SymptomType } from '@/types';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
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
      { type: SymptomType.MOOD_HORNY, label: 'Horny' },
    ],
  },
};

// Day type for radio button selection
type DayType = 'none' | 'period_start' | 'period_end' | 'ovulation';

// Helper function to check if a date is in the fertile window
function isInFertileWindow(
  date: Date,
  cycles: Cycle[],
  cycleLength: number,
  ovulationMarkers: OvulationMarker[]
): boolean {
  const cycle = findCycleForDate(date, cycles);
  if (!cycle) return false;

  // Check if there's a confirmed ovulation marker for this cycle
  const marker = ovulationMarkers.find((m) => m.cycle_id === cycle.id);
  const ovulationDate = getOvulationDate(
    cycle.period_start_date,
    cycleLength,
    marker
  );
  const fertileWindow = getFertileWindow(ovulationDate);

  return isWithinInterval(date, {
    start: startOfDay(fertileWindow.start),
    end: startOfDay(fertileWindow.end),
  });
}

// Helper function to get phase for a specific date
function getDayPhaseForDate(
  date: Date,
  cycles: Cycle[],
  cycleLength: number,
  ovulationMarkers: OvulationMarker[],
  averagePeriodLength: number = 5
): { phase: PhaseType | null; isPrediction: boolean } {
  if (cycles.length === 0) {
    return { phase: null, isPrediction: false };
  }

  // Check if this date is in the future (after today)
  const today = startOfDay(new Date());
  const isFutureDate = isAfter(startOfDay(date), today);

  // Sort cycles by date ascending
  const sortedCycles = [...cycles].sort(
    (a, b) =>
      parseISO(a.period_start_date).getTime() -
      parseISO(b.period_start_date).getTime()
  );

  // Get the most recent cycle
  const mostRecentCycle = sortedCycles[sortedCycles.length - 1];
  const mostRecentStart = parseISO(mostRecentCycle.period_start_date);

  // Calculate when we should start showing predictions
  // This is after one cycle length from the most recent period start
  const predictionCutoff = addDays(mostRecentStart, cycleLength);

  // If date is beyond the prediction cutoff, use predictions (for up to 12 months)
  if (date >= predictionCutoff && cycles.length >= 2) {
    const predictedPhase = getPredictedPhaseForDate(
      date,
      cycles,
      cycleLength,
      averagePeriodLength
    );
    // Only mark as prediction (transparent) if it's a future date
    return { phase: predictedPhase, isPrediction: isFutureDate };
  }

  // Find which cycle this date belongs to
  const cycle = findCycleForDate(date, cycles);

  if (cycle) {
    // Date belongs to a recorded cycle
    const cycleIndex = sortedCycles.findIndex((c) => c.id === cycle.id);
    const nextCycle = sortedCycles[cycleIndex + 1];
    const nextCycleStart = nextCycle
      ? parseISO(nextCycle.period_start_date)
      : null;

    // Find ovulation marker for this cycle
    const ovulationMarker = ovulationMarkers.find((m) => m.cycle_id === cycle.id);

    const phase = getPhaseForDate(date, cycle, nextCycleStart, cycleLength, ovulationMarker);
    // Mark as prediction (transparent) only if it's a future date
    return {
      phase,
      isPrediction: isFutureDate,
    };
  }

  // No recorded cycle - use prediction for dates before first cycle or gaps
  if (cycles.length >= 2) {
    const predictedPhase = getPredictedPhaseForDate(
      date,
      cycles,
      cycleLength,
      averagePeriodLength
    );
    // Only mark as prediction (transparent) if it's a future date
    return { phase: predictedPhase, isPrediction: isFutureDate };
  }

  return { phase: null, isPrediction: false };
}

export default function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [ovulationMarkers, setOvulationMarkers] = useState<OvulationMarker[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [allCycles, allSymptoms, allMarkers] = await Promise.all([
        db.getAllCycles(),
        db.getAllSymptoms(),
        db.getAllOvulationMarkers(),
      ]);
      setCycles(allCycles);
      setSymptoms(allSymptoms);
      setOvulationMarkers(allMarkers);
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

  // Check if a date is in the future (after today)
  const isFutureDate = useCallback((date: Date): boolean => {
    const today = startOfDay(new Date());
    return isAfter(startOfDay(date), today);
  }, []);

  // Get today's phase and historical symptoms for that phase
  const todayPhase = useMemo(() => {
    const today = new Date();
    const result = getDayPhaseForDate(today, cycles, cycleLength, ovulationMarkers, periodLength);
    return result.phase;
  }, [cycles, cycleLength, ovulationMarkers, periodLength]);

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
    (date: Date): { phase: PhaseType | null; isPrediction: boolean; isFertile: boolean } => {
      const { phase, isPrediction } = getDayPhaseForDate(date, cycles, cycleLength, ovulationMarkers, periodLength);

      // For recorded cycles, use actual fertile window calculation
      // For predictions, derive fertile from the phase
      let isFertile = false;

      if (!isPrediction) {
        // Use actual cycle data for past/present days
        isFertile = isInFertileWindow(date, cycles, cycleLength, ovulationMarkers);
      } else {
        // For predicted days, derive from phase
        isFertile = phase === Phase.FERTILE;
      }

      return { phase, isPrediction, isFertile };
    },
    [cycles, cycleLength, periodLength, ovulationMarkers]
  );

  // Get the background color for a phase (used for fertile days too)
  const getPhaseBackgroundColor = (phase: PhaseType | null, isPrediction: boolean): string => {
    // For predictions, we'll add opacity-70 separately
    switch (phase) {
      case Phase.MENSTRUAL:
        return isPrediction ? 'bg-phase-menstrual opacity-70' : 'bg-phase-menstrual';
      case Phase.FOLLICULAR:
        return isPrediction ? 'bg-phase-follicular opacity-70' : 'bg-phase-follicular';
      case Phase.OVULATION:
        return isPrediction ? 'bg-phase-ovulation opacity-70' : 'bg-phase-ovulation';
      case Phase.LUTEAL:
        return isPrediction ? 'bg-phase-luteal opacity-70' : 'bg-phase-luteal';
      case Phase.FERTILE:
        return isPrediction ? 'bg-phase-follicular opacity-70' : 'bg-phase-follicular';
      default:
        return 'bg-white';
    }
  };

  // Get the full styling for a calendar day
  const getDayStyles = (
    phase: PhaseType | null,
    isPrediction: boolean,
    isFertile: boolean
  ): string => {
    const bgColor = getPhaseBackgroundColor(phase, isPrediction);
    const textColor = phase && phase !== Phase.FERTILE ? 'text-white' : 'text-gray-900';

    // Fertile days get a thick green border
    if (isFertile || phase === Phase.FERTILE) {
      return `${bgColor} ${textColor} ring-6 ring-inset ring-phase-fertile`;
    }

    return `${bgColor} ${textColor}`;
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
    // Don't open drawer for future dates
    if (isFutureDate(date)) return;

    setSelectedDate(date);
    setIsDrawerOpen(true);
  };

  // Get the current day type (none, period_start, period_end, ovulation)
  const getSelectedDayType = useCallback((): DayType => {
    if (!selectedDate) return 'none';

    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    if (cycles.some((c) => c.period_start_date === dateStr)) {
      return 'period_start';
    }
    if (cycles.some((c) => c.period_end_date === dateStr)) {
      return 'period_end';
    }
    if (ovulationMarkers.some((m) => m.date === dateStr)) {
      return 'ovulation';
    }
    return 'none';
  }, [selectedDate, cycles, ovulationMarkers]);

  const selectedDayType = getSelectedDayType();

  // Handle day type change (radio button behavior)
  const handleDayTypeChange = async (newType: DayType) => {
    if (!selectedDate) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const currentType = selectedDayType;

    try {
      // First, remove any existing markers for this date
      if (currentType === 'period_start') {
        const cycle = cycles.find((c) => c.period_start_date === dateStr);
        if (cycle) await db.deleteCycle(cycle.id);
      } else if (currentType === 'period_end') {
        const cycle = cycles.find((c) => c.period_end_date === dateStr);
        if (cycle) await db.updateCycle(cycle.id, cycle.period_start_date, undefined);
      } else if (currentType === 'ovulation') {
        await db.deleteOvulationMarkerByDate(dateStr);
      }

      // Then, add the new marker if not 'none'
      if (newType === 'period_start') {
        await db.addCycle(dateStr);
      } else if (newType === 'period_end') {
        // Find the cycle this date belongs to
        const cycle = findCycleForDate(selectedDate, cycles);
        if (cycle) {
          await db.updateCycle(cycle.id, cycle.period_start_date, dateStr);
        }
      } else if (newType === 'ovulation') {
        // Find the cycle this date belongs to
        const cycle = findCycleForDate(selectedDate, cycles);
        if (cycle) {
          // Delete existing ovulation marker for this cycle if any (replace behavior)
          const existingMarker = ovulationMarkers.find((m) => m.cycle_id === cycle.id);
          if (existingMarker) {
            await db.deleteOvulationMarker(existingMarker.id);
          }
          await db.addOvulationMarker(cycle.id, dateStr, true);
        }
      }

      await loadData();
    } catch (error) {
      console.error('Failed to update day type:', error);
    }
  };

  // Check if selected date is a period start or end
  const getSelectedDateInfo = useCallback(() => {
    if (!selectedDate) return { symptoms: [] as Symptom[] };

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const dateSymptoms = symptoms.filter((s) => s.date === dateStr);

    return {
      symptoms: dateSymptoms,
    };
  }, [selectedDate, symptoms]);

  const selectedDateInfo = getSelectedDateInfo();

  // Check if a day has any user entries (period start/end, ovulation, or symptoms)
  const getDayHasEntries = useCallback(
    (date: Date): boolean => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const hasPeriodStart = cycles.some((c) => c.period_start_date === dateStr);
      const hasPeriodEnd = cycles.some((c) => c.period_end_date === dateStr);
      const hasOvulation = ovulationMarkers.some((m) => m.date === dateStr);
      const hasSymptoms = symptoms.some((s) => s.date === dateStr);
      return hasPeriodStart || hasPeriodEnd || hasOvulation || hasSymptoms;
    },
    [cycles, symptoms, ovulationMarkers]
  );

  // Toggle a symptom for the selected date
  const handleToggleSymptom = async (symptomType: string) => {
    if (!selectedDate || isFutureDate(selectedDate)) return;

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

  // Check if period end button should be enabled
  const canSetPeriodEnd = useCallback((): boolean => {
    if (!selectedDate) return false;

    // Find the cycle this date belongs to
    const cycle = findCycleForDate(selectedDate, cycles);
    if (!cycle) return false;

    // Can set period end if the selected date is on or after the cycle start
    const cycleStart = parseISO(cycle.period_start_date);
    return selectedDate >= cycleStart;
  }, [selectedDate, cycles]);

  // Check if ovulation can be set (must be within a cycle)
  const canSetOvulation = useCallback((): boolean => {
    if (!selectedDate) return false;
    return findCycleForDate(selectedDate, cycles) !== null;
  }, [selectedDate, cycles]);

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
          const isFuture = isFutureDate(day);
          const { phase, isPrediction, isFertile } = isCurrentMonth
            ? getDayPhaseInfo(day)
            : { phase: null, isPrediction: false, isFertile: false };
          const dayStyles = isCurrentMonth
            ? getDayStyles(phase, isPrediction, isFertile)
            : 'text-gray-300';
          const todayRingColor = getTodayRingColor(phase);
          const hasEntries = isCurrentMonth && !isFuture && getDayHasEntries(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDayClick(day)}
              disabled={isFuture}
              className={`relative flex h-12 items-center justify-center rounded-lg text-sm font-medium transition-colors ${dayStyles} ${
                isFuture && isCurrentMonth ? 'cursor-not-allowed opacity-50' : ''
              }`}
            >
              {isToday ? (
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full ring-3 ${todayRingColor}`}
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
          color="ring-4 ring-inset ring-phase-fertile"
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
            {/* Day Type Radio Buttons */}
            <div className="mb-6">
              <h3 className="mb-2 text-sm font-medium text-gray-500">Day Type</h3>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => handleDayTypeChange('none')}
                  className={`flex h-12 flex-col items-center justify-center rounded-lg border-2 text-xs transition-colors ${
                    selectedDayType === 'none'
                      ? 'border-brand-fuchsia bg-brand-fuchsia/10 text-brand-fuchsia'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className="text-lg">⬜</span>
                  <span>None</span>
                </button>
                <button
                  onClick={() => handleDayTypeChange('period_start')}
                  className={`flex h-12 flex-col items-center justify-center rounded-lg border-2 text-xs transition-colors ${
                    selectedDayType === 'period_start'
                      ? 'border-brand-red bg-brand-red/10 text-brand-red'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className="text-lg">🔴</span>
                  <span>Start</span>
                </button>
                <button
                  onClick={() => handleDayTypeChange('period_end')}
                  disabled={!canSetPeriodEnd() && selectedDayType !== 'period_end'}
                  className={`flex h-12 flex-col items-center justify-center rounded-lg border-2 text-xs transition-colors ${
                    selectedDayType === 'period_end'
                      ? 'border-brand-red bg-brand-red/10 text-brand-red'
                      : !canSetPeriodEnd()
                      ? 'cursor-not-allowed border-gray-100 text-gray-300'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className="text-lg">🟢</span>
                  <span>End</span>
                </button>
                <button
                  onClick={() => handleDayTypeChange('ovulation')}
                  disabled={!canSetOvulation() && selectedDayType !== 'ovulation'}
                  className={`flex h-12 flex-col items-center justify-center rounded-lg border-2 text-xs transition-colors ${
                    selectedDayType === 'ovulation'
                      ? 'border-phase-ovulation bg-phase-ovulation/10 text-phase-ovulation'
                      : !canSetOvulation()
                      ? 'cursor-not-allowed border-gray-100 text-gray-300'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className="text-lg">🥚</span>
                  <span>Ovulation</span>
                </button>
              </div>
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
