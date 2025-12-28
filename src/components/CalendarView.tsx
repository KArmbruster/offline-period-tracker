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
  getDaysUntilNextPeriod,
} from '@/lib/cycle-logic';
import type { Cycle, Symptom, PhaseType, CustomSymptomType, DayNote } from '@/types';
import { PhaseType as Phase, SymptomType } from '@/types';
import { Input } from '@/components/ui/input';
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
  cycleLength: number
): boolean {
  const cycle = findCycleForDate(date, cycles);
  if (!cycle) return false;

  const ovulationDate = getOvulationDate(cycle, cycleLength);
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

    const phase = getPhaseForDate(date, cycle, nextCycleStart, cycleLength);
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
  const [customSymptomTypes, setCustomSymptomTypes] = useState<CustomSymptomType[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Custom symptom creation state
  const [isCreatingCustomSymptom, setIsCreatingCustomSymptom] = useState(false);
  const [newSymptomCategory, setNewSymptomCategory] = useState<'physical' | 'mood' | null>(null);
  const [newSymptomName, setNewSymptomName] = useState('');

  // Day note state
  const [dayNote, setDayNote] = useState<DayNote | null>(null);
  const [noteText, setNoteText] = useState('');
  const [allNotes, setAllNotes] = useState<DayNote[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [allCycles, allSymptoms, allCustomTypes, notes] = await Promise.all([
        db.getAllCycles(),
        db.getAllSymptoms(),
        db.getAllCustomSymptomTypes(),
        db.getAllNotes(),
      ]);
      setCycles(allCycles);
      setSymptoms(allSymptoms);
      setCustomSymptomTypes(allCustomTypes);
      setAllNotes(notes);
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
    const result = getDayPhaseForDate(today, cycles, cycleLength, periodLength);
    return result.phase;
  }, [cycles, cycleLength, periodLength]);

  const phaseSymptoms = useMemo(() => {
    if (!todayPhase) return [];
    return getSymptomsForPhaseHistory(todayPhase, cycles, symptoms, cycleLength, 6);
  }, [todayPhase, cycles, symptoms, cycleLength]);

  const nextPeriodInfo = useMemo(() => {
    return getDaysUntilNextPeriod(cycles, cycleLength);
  }, [cycles, cycleLength]);

  const cyclesAnalyzed = Math.min(cycles.length, 6);

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
      const { phase, isPrediction } = getDayPhaseForDate(date, cycles, cycleLength, periodLength);

      // For recorded cycles, use actual fertile window calculation
      // For predictions, derive fertile from the phase
      let isFertile = false;

      if (!isPrediction) {
        // Use actual cycle data for past/present days
        isFertile = isInFertileWindow(date, cycles, cycleLength);
      } else {
        // For predicted days, derive from phase
        isFertile = phase === Phase.FERTILE;
      }

      return { phase, isPrediction, isFertile };
    },
    [cycles, cycleLength, periodLength]
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

  const handleDayClick = async (date: Date) => {
    // Don't open drawer for future dates
    if (isFutureDate(date)) return;

    setSelectedDate(date);
    setIsDrawerOpen(true);

    // Reset custom symptom creation state
    setIsCreatingCustomSymptom(false);
    setNewSymptomCategory(null);
    setNewSymptomName('');

    // Load note for this date
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const note = await db.getNoteByDate(dateStr);
      setDayNote(note);
      setNoteText(note?.content || '');
    } catch (error) {
      console.error('Failed to load note:', error);
      setDayNote(null);
      setNoteText('');
    }
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
    if (cycles.some((c) => c.ovulation_date === dateStr)) {
      return 'ovulation';
    }
    return 'none';
  }, [selectedDate, cycles]);

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
        if (cycle) await db.updateCycle(cycle.id, cycle.period_start_date, undefined, cycle.ovulation_date || undefined);
      } else if (currentType === 'ovulation') {
        const cycle = cycles.find((c) => c.ovulation_date === dateStr);
        if (cycle) await db.updateCycle(cycle.id, cycle.period_start_date, cycle.period_end_date || undefined, undefined);
      }

      // Then, add the new marker if not 'none'
      if (newType === 'period_start') {
        await db.addCycle(dateStr);
      } else if (newType === 'period_end') {
        // Find the cycle this date belongs to
        const cycle = findCycleForDate(selectedDate, cycles);
        if (cycle) {
          await db.updateCycle(cycle.id, cycle.period_start_date, dateStr, cycle.ovulation_date || undefined);
        }
      } else if (newType === 'ovulation') {
        // Find the cycle this date belongs to
        const cycle = findCycleForDate(selectedDate, cycles);
        if (cycle) {
          // Update cycle with the new ovulation date (replaces any existing)
          await db.updateCycle(cycle.id, cycle.period_start_date, cycle.period_end_date || undefined, dateStr);
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

  // Check what type of entries a day has
  const getDayEntries = useCallback(
    (date: Date): { hasDateMarker: boolean; hasSymptoms: boolean; hasNote: boolean } => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const hasPeriodStart = cycles.some((c) => c.period_start_date === dateStr);
      const hasPeriodEnd = cycles.some((c) => c.period_end_date === dateStr);
      const hasOvulation = cycles.some((c) => c.ovulation_date === dateStr);
      const hasSymptoms = symptoms.some((s) => s.date === dateStr);
      const hasNote = allNotes.some((n) => n.date === dateStr);
      return {
        hasDateMarker: hasPeriodStart || hasPeriodEnd || hasOvulation,
        hasSymptoms,
        hasNote,
      };
    },
    [cycles, symptoms, allNotes]
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

  // Handle creating a custom symptom
  const handleCreateCustomSymptom = async () => {
    if (!newSymptomName.trim() || !newSymptomCategory) return;

    try {
      await db.addCustomSymptomType(newSymptomName.trim(), newSymptomCategory);
      await loadData();
      setIsCreatingCustomSymptom(false);
      setNewSymptomCategory(null);
      setNewSymptomName('');
    } catch (error) {
      console.error('Failed to create custom symptom:', error);
    }
  };

  // Handle note save (on blur or explicit save)
  const handleSaveNote = async () => {
    if (!selectedDate) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const trimmedNote = noteText.trim();

    try {
      if (dayNote) {
        // Update or delete existing note
        if (trimmedNote) {
          await db.updateNote(dayNote.id, trimmedNote);
        } else {
          await db.deleteNote(dayNote.id);
          setDayNote(null);
        }
      } else if (trimmedNote) {
        // Create new note
        await db.addNote(dateStr, trimmedNote);
        const newNote = await db.getNoteByDate(dateStr);
        setDayNote(newNote);
      }
      // Reload data to update calendar icons
      await loadData();
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  };

  // Get custom symptoms grouped by category
  const customSymptomsByCategory = useMemo(() => {
    return {
      physical: customSymptomTypes.filter((c) => c.category === 'physical'),
      mood: customSymptomTypes.filter((c) => c.category === 'mood'),
    };
  }, [customSymptomTypes]);

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
          const dayEntries = isCurrentMonth && !isFuture ? getDayEntries(day) : null;

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
              {/* Top left: Circle for date markers (start, end, ovulation) */}
              {dayEntries?.hasDateMarker && (
                <span className="absolute left-1 top-1">
                  <CircleIcon />
                </span>
              )}
              {/* Top right: Star for symptoms */}
              {dayEntries?.hasSymptoms && (
                <span className="absolute right-1 top-1">
                  <StarIcon />
                </span>
              )}
              {/* Bottom right: Pen for notes */}
              {dayEntries?.hasNote && (
                <span className="absolute bottom-1 right-1">
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

      {/* Phase Info Panel - shows current phase, next period, and common symptoms */}
      {cycles.length > 0 && (
        <PhaseSymptoms
          phase={todayPhase}
          symptoms={phaseSymptoms}
          customSymptomTypes={customSymptomTypes}
          cyclesAnalyzed={cyclesAnalyzed}
          nextPeriodInfo={nextPeriodInfo}
        />
      )}

      {/* Date Action Drawer */}
      <Drawer open={isDrawerOpen} onOpenChange={(open) => {
        if (!open) {
          // Save note and refresh data when drawer closes
          handleSaveNote();
        }
        setIsDrawerOpen(open);
      }}>
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
              {/* Physical symptoms */}
              <div>
                <h3 className="mb-2 text-sm font-medium text-gray-500">
                  {SYMPTOM_CATEGORIES.physical.label}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {SYMPTOM_CATEGORIES.physical.symptoms.map(({ type, label }) => (
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
                  {/* Custom physical symptoms */}
                  {customSymptomsByCategory.physical.map((custom) => (
                    <button
                      key={`custom-${custom.id}`}
                      onClick={() => handleToggleSymptom(`custom_${custom.id}`)}
                      className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                        isSymptomSelected(`custom_${custom.id}`)
                          ? 'bg-brand-fuchsia text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {custom.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Flow symptoms */}
              <div>
                <h3 className="mb-2 text-sm font-medium text-gray-500">
                  {SYMPTOM_CATEGORIES.flow.label}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {SYMPTOM_CATEGORIES.flow.symptoms.map(({ type, label }) => (
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

              {/* Mood symptoms */}
              <div>
                <h3 className="mb-2 text-sm font-medium text-gray-500">
                  {SYMPTOM_CATEGORIES.mood.label}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {SYMPTOM_CATEGORIES.mood.symptoms.map(({ type, label }) => (
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
                  {/* Custom mood symptoms */}
                  {customSymptomsByCategory.mood.map((custom) => (
                    <button
                      key={`custom-${custom.id}`}
                      onClick={() => handleToggleSymptom(`custom_${custom.id}`)}
                      className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                        isSymptomSelected(`custom_${custom.id}`)
                          ? 'bg-brand-fuchsia text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {custom.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add Custom Symptom Button / Form */}
              <div className="pt-2">
                {!isCreatingCustomSymptom ? (
                  <button
                    onClick={() => setIsCreatingCustomSymptom(true)}
                    className="flex items-center gap-1 text-sm text-brand-fuchsia hover:text-brand-red"
                  >
                    <PlusIcon />
                    Add custom symptom
                  </button>
                ) : (
                  <div className="space-y-3 rounded-lg border border-gray-200 p-3">
                    {/* Category selection */}
                    {!newSymptomCategory ? (
                      <div>
                        <p className="mb-2 text-sm text-gray-600">Select category:</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setNewSymptomCategory('physical')}
                            className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
                          >
                            Physical
                          </button>
                          <button
                            onClick={() => setNewSymptomCategory('mood')}
                            className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
                          >
                            Mood
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="mb-2 text-sm text-gray-600">
                          New {newSymptomCategory} symptom:
                        </p>
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            value={newSymptomName}
                            onChange={(e) => setNewSymptomName(e.target.value)}
                            placeholder="Symptom name"
                            className="flex-1 text-base"
                            autoFocus
                          />
                          <button
                            onClick={handleCreateCustomSymptom}
                            disabled={!newSymptomName.trim()}
                            className="rounded-lg bg-brand-fuchsia px-4 py-2 text-sm text-white hover:bg-brand-red disabled:opacity-50"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setIsCreatingCustomSymptom(false);
                        setNewSymptomCategory(null);
                        setNewSymptomName('');
                      }}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Notes Section */}
            <div className="mt-6 border-t border-gray-200 pt-4">
              <h3 className="mb-2 text-sm font-medium text-gray-500">Note</h3>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onBlur={handleSaveNote}
                placeholder="Add a note for this day..."
                className="w-full rounded-lg border border-gray-200 p-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-brand-fuchsia focus:outline-none focus:ring-1 focus:ring-brand-fuchsia"
                rows={3}
              />
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

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
    >
      <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3 w-3 opacity-60"
    >
      <circle cx="10" cy="10" r="6" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3 w-3 opacity-60"
    >
      <path
        fillRule="evenodd"
        d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
