'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  differenceInCalendarDays,
} from 'date-fns';
import { db } from '@/lib/db';
import {
  createCycleModel,
  findCycleForDate,
  getSymptomsForPhaseHistory,
  getDaysUntilNextPeriod,
  MAX_PERIOD_LENGTH,
  type DayInfo,
} from '@/lib/cycle-logic';
import type { Cycle, Symptom, CustomSymptomType, DayNote } from '@/types';
import { PhaseType as Phase, SymptomType } from '@/types';
import { Input } from '@/components/ui/input';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import PhaseSymptoms from '@/components/PhaseSymptoms';
import CycleStatusCard from '@/components/CycleStatusCard';

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

// Period pain levels (1-10 scale)
const PERIOD_PAIN_LEVELS = [
  { type: SymptomType.PERIOD_PAIN_1, label: '1' },
  { type: SymptomType.PERIOD_PAIN_2, label: '2' },
  { type: SymptomType.PERIOD_PAIN_3, label: '3' },
  { type: SymptomType.PERIOD_PAIN_4, label: '4' },
  { type: SymptomType.PERIOD_PAIN_5, label: '5' },
  { type: SymptomType.PERIOD_PAIN_6, label: '6' },
  { type: SymptomType.PERIOD_PAIN_7, label: '7' },
  { type: SymptomType.PERIOD_PAIN_8, label: '8' },
  { type: SymptomType.PERIOD_PAIN_9, label: '9' },
  { type: SymptomType.PERIOD_PAIN_10, label: '10' },
];

// Day type for radio button selection
type DayType = 'none' | 'period_start' | 'period_end' | 'ovulation';

// Shape and colours of one calendar day. Logged days are filled, predicted
// days are dashed outlines, and period days join into a continuous band.
function getDayShape(info: DayInfo, prev?: DayInfo, next?: DayInfo): string {
  const { phase, isPrediction, isFertile } = info;

  if (phase === Phase.MENSTRUAL) {
    const joinsPrev = prev?.phase === Phase.MENSTRUAL && prev.isPrediction === isPrediction;
    const joinsNext = next?.phase === Phase.MENSTRUAL && next.isPrediction === isPrediction;
    const rounding = `${joinsPrev ? '' : 'rounded-l-full'} ${joinsNext ? '' : 'rounded-r-full'}`;

    if (isPrediction) {
      return `w-full ${rounding} border-y-2 border-dashed border-phase-menstrual bg-phase-menstrual-soft text-phase-menstrual ${
        joinsPrev ? '' : 'border-l-2'
      } ${joinsNext ? '' : 'border-r-2'}`;
    }
    return `w-full ${rounding} bg-phase-menstrual text-white`;
  }

  const circle = 'w-10 rounded-full';
  const fertileRing = isFertile
    ? `border-[2.5px] border-phase-fertile ${isPrediction ? 'border-dashed' : ''}`
    : '';

  switch (phase) {
    case Phase.OVULATION:
      return isPrediction
        ? `${circle} border-2 border-dashed border-phase-ovulation-strong bg-phase-ovulation-soft text-phase-ovulation-ink`
        : `${circle} bg-phase-ovulation-strong text-white`;
    case Phase.FOLLICULAR:
      return isPrediction
        ? `${circle} bg-phase-follicular-soft/40 text-phase-follicular-ink ${
            fertileRing || 'border-[1.5px] border-dashed border-phase-follicular'
          }`
        : `${circle} bg-phase-follicular-soft text-phase-follicular-ink ${fertileRing}`;
    case Phase.LUTEAL:
      return isPrediction
        ? `${circle} bg-phase-luteal-soft/40 text-phase-luteal-ink ${
            fertileRing || 'border-[1.5px] border-dashed border-phase-luteal'
          }`
        : `${circle} bg-phase-luteal-soft text-phase-luteal-ink ${fertileRing}`;
    default:
      return `${circle} ${isPrediction ? 'text-gray-400' : 'text-gray-900'}`;
  }
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

  // Swipe gesture state
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const SWIPE_THRESHOLD = 50; // minimum distance for a swipe

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

  const cycleModel = useMemo(() => createCycleModel(cycles), [cycles]);
  const cycleLength = cycleModel.cycleLength;

  // Check if a date is in the future (after today)
  const isFutureDate = useCallback((date: Date): boolean => {
    const today = startOfDay(new Date());
    return isAfter(startOfDay(date), today);
  }, []);

  // Where today sits in the cycle
  const todayInfo = useMemo(() => cycleModel.getDayInfo(new Date()), [cycleModel]);
  const todayPhase = todayInfo.phase;

  const cycleDay = useMemo(() => {
    const now = new Date();
    const cycle = findCycleForDate(now, cycles);
    return cycle
      ? differenceInCalendarDays(now, parseISO(cycle.period_start_date)) + 1
      : null;
  }, [cycles]);

  const phaseSymptoms = useMemo(() => {
    if (!todayPhase) return [];
    return getSymptomsForPhaseHistory(todayPhase, cycles, symptoms, 6);
  }, [todayPhase, cycles, symptoms]);

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

  // A period end must fall inside its cycle and within a plausible period length
  const canEndPeriodOn = (date: Date, cycle: Cycle): boolean => {
    const dayInCycle = differenceInCalendarDays(date, parseISO(cycle.period_start_date));
    return dayInCycle >= 0 && dayInCycle < MAX_PERIOD_LENGTH;
  };

  // Handle day type change (radio button behavior)
  const handleDayTypeChange = async (newType: DayType) => {
    if (!selectedDate) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const currentType = selectedDayType;
    if (newType === currentType) return;

    try {
      // Work on a local copy so the second step sees the result of the first
      let working = cycles.map((c) => ({ ...c }));

      // First, remove the existing marker for this date
      if (currentType === 'period_start') {
        const cycle = working.find((c) => c.period_start_date === dateStr);
        if (cycle) {
          if (
            (cycle.period_end_date || cycle.ovulation_date) &&
            !confirm(
              'Removing this period start also removes the period end and ovulation day logged for this cycle. Continue?'
            )
          ) {
            return;
          }
          await db.deleteCycle(cycle.id);
          working = working.filter((c) => c.id !== cycle.id);
        }
      } else if (currentType === 'period_end') {
        const cycle = working.find((c) => c.period_end_date === dateStr);
        if (cycle) {
          cycle.period_end_date = null;
          await db.updateCycle(cycle.id, cycle.period_start_date, undefined, cycle.ovulation_date || undefined);
        }
      } else if (currentType === 'ovulation') {
        const cycle = working.find((c) => c.ovulation_date === dateStr);
        if (cycle) {
          cycle.ovulation_date = null;
          await db.updateCycle(cycle.id, cycle.period_start_date, cycle.period_end_date || undefined, undefined);
        }
      }

      // Then, add the new marker if not 'none'
      if (newType === 'period_start') {
        await db.addCycle(dateStr);
      } else if (newType === 'period_end') {
        const cycle = findCycleForDate(selectedDate, working);
        if (cycle && canEndPeriodOn(selectedDate, cycle)) {
          await db.updateCycle(cycle.id, cycle.period_start_date, dateStr, cycle.ovulation_date || undefined);
        }
      } else if (newType === 'ovulation') {
        const cycle = findCycleForDate(selectedDate, working);
        if (cycle) {
          // Replaces any ovulation day already marked in this cycle
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

  // Dates that have anything logged (period marker, symptom or note)
  const datesWithEntries = useMemo(() => {
    const dates = new Set<string>();
    cycles.forEach((c) => {
      dates.add(c.period_start_date);
      if (c.period_end_date) dates.add(c.period_end_date);
      if (c.ovulation_date) dates.add(c.ovulation_date);
    });
    symptoms.forEach((s) => dates.add(s.date));
    allNotes.forEach((n) => dates.add(n.date));
    return dates;
  }, [cycles, symptoms, allNotes]);

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

  // Get the currently selected period pain level (if any)
  const getSelectedPainLevel = (): string | null => {
    const painSymptom = selectedDateInfo.symptoms.find((s) =>
      s.symptom_type.startsWith('period_pain_')
    );
    return painSymptom?.symptom_type || null;
  };

  // Handle period pain level selection (radio button behavior - only one can be selected)
  const handlePainLevelChange = async (painType: string) => {
    if (!selectedDate || isFutureDate(selectedDate)) return;

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const currentPainLevel = getSelectedPainLevel();

      // If clicking the same level, remove it
      if (currentPainLevel === painType) {
        const existingSymptom = selectedDateInfo.symptoms.find(
          (s) => s.symptom_type === painType
        );
        if (existingSymptom) {
          await db.deleteSymptom(existingSymptom.id);
        }
      } else {
        // Remove any existing pain level first
        if (currentPainLevel) {
          const existingSymptom = selectedDateInfo.symptoms.find(
            (s) => s.symptom_type === currentPainLevel
          );
          if (existingSymptom) {
            await db.deleteSymptom(existingSymptom.id);
          }
        }
        // Add the new pain level
        await db.addSymptom(dateStr, painType);
      }
      await loadData();
    } catch (error) {
      console.error('Failed to update pain level:', error);
    }
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
  const canSetPeriodEnd = (): boolean => {
    if (!selectedDate) return false;
    const cycle = findCycleForDate(selectedDate, cycles);
    return cycle !== null && canEndPeriodOn(selectedDate, cycle);
  };

  // Check if ovulation can be set (must be within a cycle)
  const canSetOvulation = useCallback((): boolean => {
    if (!selectedDate) return false;
    return findCycleForDate(selectedDate, cycles) !== null;
  }, [selectedDate, cycles]);

  // Swipe handlers for month navigation
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;

    // Only trigger swipe if horizontal movement is greater than vertical
    // This prevents accidental swipes when scrolling
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
      if (deltaX > 0) {
        // Swipe right -> previous month
        setCurrentMonth(subMonths(currentMonth, 1));
      } else {
        // Swipe left -> next month
        setCurrentMonth(addMonths(currentMonth, 1));
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  }, [currentMonth]);

  const calendarDays = getCalendarDays();
  const dayInfos = calendarDays.map((day) => cycleModel.getDayInfo(day));
  const today = new Date();
  const isViewingToday = isSameMonth(currentMonth, today);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col p-4">
      {/* Cycle status */}
      {cycles.length > 0 && (
        <CycleStatusCard
          phase={todayPhase}
          isFertile={todayInfo.isFertile}
          cycleDay={cycleDay}
          nextPeriodInfo={nextPeriodInfo}
        />
      )}

      {/* Month Navigation */}
      <div className="mb-3 flex items-center gap-1">
        <h2 className="flex-1 whitespace-nowrap text-lg font-semibold text-gray-900">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <button
          onClick={() => setCurrentMonth(new Date())}
          aria-label="Jump to today"
          className={`flex h-11 items-center gap-1.5 rounded-full border-2 px-3 text-sm font-semibold transition-colors ${
            isViewingToday
              ? 'border-gray-200 text-gray-400'
              : 'border-brand-red bg-brand-red text-white'
          }`}
        >
          <TodayIcon />
          Today
        </button>
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          aria-label="Previous month"
          className="flex h-11 w-10 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100"
        >
          <ChevronLeftIcon />
        </button>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          aria-label="Next month"
          className="flex h-11 w-10 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100"
        >
          <ChevronRightIcon />
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="mb-1 grid grid-cols-7">
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
      <div
        className="grid grid-cols-7 gap-y-1.5"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {calendarDays.map((day, index) => {
          const isToday = isSameDay(day, today);
          const isFuture = isFutureDate(day);
          const shape = getDayShape(dayInfos[index], dayInfos[index - 1], dayInfos[index + 1]);
          const hasEntry = datesWithEntries.has(format(day, 'yyyy-MM-dd'));

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDayClick(day)}
              disabled={isFuture}
              aria-label={format(day, 'EEEE, d MMMM yyyy')}
              aria-current={isToday ? 'date' : undefined}
              className={`relative flex h-12 items-center justify-center text-sm ${
                isToday ? 'font-bold' : 'font-medium'
              } ${isFuture ? 'cursor-not-allowed' : ''}`}
            >
              <span className={`relative flex h-10 items-center justify-center ${shape}`}>
                {format(day, 'd')}
                {/* Dot: something is logged on this day */}
                {hasEntry && (
                  <span
                    className={`absolute left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-current ${
                      isToday ? 'top-1' : 'bottom-1'
                    }`}
                  />
                )}
              </span>
              {/* Today: dark ring with a white gap, plus a label */}
              {isToday && (
                <>
                  <span className="pointer-events-none absolute h-10 w-10 rounded-full ring-[3px] ring-ink ring-offset-1 ring-offset-white" />
                  <span className="pointer-events-none absolute -bottom-1.5 z-10 rounded-full bg-ink px-1.5 text-[10px] font-semibold leading-4 text-white">
                    Today
                  </span>
                </>
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
      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs">
        <LegendItem swatch="bg-phase-menstrual" label="Period" />
        <LegendItem swatch="border border-phase-follicular bg-phase-follicular-soft" label="Follicular" />
        <LegendItem swatch="bg-phase-ovulation-strong" label="Ovulation" />
        <LegendItem swatch="border border-phase-luteal bg-phase-luteal-soft" label="Luteal" />
        <LegendItem swatch="border-2 border-phase-fertile" label="Fertile" />
        <LegendItem swatch="border-[1.5px] border-dashed border-gray-500" label="Predicted" />
      </div>

      {/* Common symptoms for the current phase */}
      {cycles.length > 0 && (
        <PhaseSymptoms
          phase={todayPhase}
          symptoms={phaseSymptoms}
          customSymptomTypes={customSymptomTypes}
          cyclesAnalyzed={cyclesAnalyzed}
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

              {/* Period Pain */}
              <div>
                <h3 className="mb-2 text-sm font-medium text-gray-500">
                  Pain Level
                </h3>
                <div className="flex gap-1">
                  {PERIOD_PAIN_LEVELS.map(({ type, label }) => (
                    <button
                      key={type}
                      onClick={() => handlePainLevelChange(type)}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                        getSelectedPainLevel() === type
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

function LegendItem({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-4 w-4 rounded-full ${swatch}`} />
      <span className="text-gray-600">{label}</span>
    </div>
  );
}

function TodayIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
      />
      <circle cx="12" cy="15" r="1.75" fill="currentColor" stroke="none" />
    </svg>
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
