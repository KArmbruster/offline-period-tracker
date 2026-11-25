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
  differenceInCalendarDays,
} from 'date-fns';
import { Droplet, DropletOff, Egg, Heart } from 'lucide-react';
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
import {
  customSportType,
  getPainLevel,
  getSportScore,
  isSportScore,
  isSportSession,
  sportScoreType,
  SPORT_OPTIONS,
  SPORT_SCORE_LABELS,
} from '@/lib/symptom-utils';

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

// Flow options in the order shown in the day sheet (only one per day)
const FLOW_OPTIONS = [
  { type: SymptomType.SPOTTING, label: 'Spotting' },
  { type: SymptomType.FLOW_LIGHT, label: 'Light' },
  { type: SymptomType.FLOW_MEDIUM, label: 'Medium' },
  { type: SymptomType.FLOW_HEAVY, label: 'Heavy' },
];
const FLOW_TYPES: string[] = FLOW_OPTIONS.map((o) => o.type);

const PHASE_LABELS: Record<string, string> = {
  [Phase.MENSTRUAL]: 'Menstrual',
  [Phase.FOLLICULAR]: 'Follicular',
  [Phase.OVULATION]: 'Ovulation',
  [Phase.LUTEAL]: 'Luteal',
};

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

  // Custom sport creation state
  const [isCreatingCustomSport, setIsCreatingCustomSport] = useState(false);
  const [newSportName, setNewSportName] = useState('');

  // Day note state
  const [dayNote, setDayNote] = useState<DayNote | null>(null);
  const [noteText, setNoteText] = useState('');
  const [allNotes, setAllNotes] = useState<DayNote[]>([]);

  // Day type waiting for the user to confirm removing a period start
  const [pendingDayType, setPendingDayType] = useState<DayType | null>(null);

  // Pain slider: value while dragging, saved when the thumb is released
  const [painDraft, setPainDraft] = useState<number | null>(null);
  const painDraftRef = useRef<number | null>(null);

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

  // Today's date as a string, refreshed when the app comes back to the
  // foreground so nothing stays on yesterday after midnight
  const [todayKey, setTodayKey] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  useEffect(() => {
    const refresh = () => setTodayKey(format(new Date(), 'yyyy-MM-dd'));
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const cycleModel = useMemo(() => createCycleModel(cycles, parseISO(todayKey)), [cycles, todayKey]);

  // Where today sits in the cycle
  const todayInfo = useMemo(() => cycleModel.getDayInfo(parseISO(todayKey)), [cycleModel, todayKey]);
  const todayPhase = todayInfo.phase;

  const cycleDay = useMemo(() => {
    const now = parseISO(todayKey);
    const cycle = findCycleForDate(now, cycles);
    return cycle
      ? differenceInCalendarDays(now, parseISO(cycle.period_start_date)) + 1
      : null;
  }, [cycles, todayKey]);

  const phaseSymptoms = useMemo(() => {
    if (!todayPhase) return [];
    return getSymptomsForPhaseHistory(todayPhase, cycles, symptoms, 6);
  }, [todayPhase, cycles, symptoms]);

  const nextPeriodInfo = useMemo(
    () => getDaysUntilNextPeriod(cycles, parseISO(todayKey)),
    [cycles, todayKey]
  );

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
    setSelectedDate(date);
    setIsDrawerOpen(true);
    setPendingDayType(null);

    // Reset custom symptom creation state
    setIsCreatingCustomSymptom(false);
    setNewSymptomCategory(null);
    setNewSymptomName('');
    setIsCreatingCustomSport(false);
    setNewSportName('');

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
  const handleDayTypeChange = async (newType: DayType, confirmed = false) => {
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
          // Removing the start deletes the whole cycle: ask first if that loses data
          if ((cycle.period_end_date || cycle.ovulation_date) && !confirmed) {
            setPendingDayType(newType);
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

  // Pain level logged for the selected date (0 = none)
  const selectedPainLevel = selectedDateInfo.symptoms.reduce(
    (level, s) => (s.symptom_type.startsWith('period_pain_') ? getPainLevel(s.symptom_type) : level),
    0
  );

  const handlePainDrag = (level: number) => {
    painDraftRef.current = level;
    setPainDraft(level);
  };

  // Save the pain level once the slider is released (only one level per day)
  const commitPainLevel = async () => {
    const level = painDraftRef.current;
    if (level === null || !selectedDate) return;
    painDraftRef.current = null;

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const target = level > 0 ? `period_pain_${level}` : null;
      const existing = selectedDateInfo.symptoms.filter((s) =>
        s.symptom_type.startsWith('period_pain_')
      );
      const unchanged =
        (existing.length === 0 && !target) ||
        (existing.length === 1 && existing[0].symptom_type === target);

      if (!unchanged) {
        for (const symptom of existing) {
          await db.deleteSymptom(symptom.id);
        }
        if (target) {
          await db.addSymptom(dateStr, target);
        }
        await loadData();
      }
    } catch (error) {
      console.error('Failed to update pain level:', error);
    } finally {
      setPainDraft(null);
    }
  };

  // Flow is single choice: picking one replaces the other, tapping it again clears it
  const handleFlowChange = async (flowType: string) => {
    if (!selectedDate) return;

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const existing = selectedDateInfo.symptoms.filter((s) => FLOW_TYPES.includes(s.symptom_type));
      const wasSelected = existing.some((s) => s.symptom_type === flowType);

      for (const symptom of existing) {
        await db.deleteSymptom(symptom.id);
      }
      if (!wasSelected) {
        await db.addSymptom(dateStr, flowType);
      }
      await loadData();
    } catch (error) {
      console.error('Failed to update flow:', error);
    }
  };

  const selectedSportCount = selectedDateInfo.symptoms.filter((s) => isSportSession(s.symptom_type)).length;
  const selectedSportScore = selectedDateInfo.symptoms.reduce(
    (score, s) => getSportScore(s.symptom_type) || score,
    0
  );

  // Sports are multi choice. Removing the last sport of the day also removes
  // the strength score, which only makes sense together with a sport.
  const handleToggleSport = async (sportType: string) => {
    if (!selectedDate) return;

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const existing = selectedDateInfo.symptoms.find((s) => s.symptom_type === sportType);

      if (existing) {
        await db.deleteSymptom(existing.id);
        if (selectedSportCount === 1) {
          for (const s of selectedDateInfo.symptoms.filter((e) => isSportScore(e.symptom_type))) {
            await db.deleteSymptom(s.id);
          }
        }
      } else {
        await db.addSymptom(dateStr, sportType);
      }
      await loadData();
    } catch (error) {
      console.error('Failed to toggle sport:', error);
    }
  };

  // Strength score is one choice per day; tapping the active one clears it
  const handleSportScoreChange = async (score: number) => {
    if (!selectedDate) return;

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      for (const s of selectedDateInfo.symptoms.filter((e) => isSportScore(e.symptom_type))) {
        await db.deleteSymptom(s.id);
      }
      if (score !== selectedSportScore) {
        await db.addSymptom(dateStr, sportScoreType(score));
      }
      await loadData();
    } catch (error) {
      console.error('Failed to update strength score:', error);
    }
  };

  const handleCreateCustomSport = async () => {
    const name = newSportName.trim();
    if (!name) return;

    try {
      await db.addCustomSymptomType(name, 'sport');
      await loadData();
      setIsCreatingCustomSport(false);
      setNewSportName('');
    } catch (error) {
      console.error('Failed to create custom sport:', error);
    }
  };

  // Tapping the active day type again clears it
  const toggleDayType = (type: DayType) =>
    handleDayTypeChange(selectedDayType === type ? 'none' : type);

  // Subtitle of the day sheet: where the selected date sits in the cycle
  const selectedDateSummary = (() => {
    if (!selectedDate) return '';
    const info = cycleModel.getDayInfo(selectedDate);
    const cycle = findCycleForDate(selectedDate, cycles);
    const parts: string[] = [];
    if (isSameDay(selectedDate, new Date())) parts.push('Today');
    if (info.phase && cycle) {
      const day = differenceInCalendarDays(selectedDate, parseISO(cycle.period_start_date)) + 1;
      parts.push(`Cycle day ${day}`);
      parts.push(PHASE_LABELS[info.phase] ?? '');
    }
    return parts.filter(Boolean).join(' · ');
  })();

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
      sport: customSymptomTypes.filter((c) => c.category === 'sport'),
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
  const today = parseISO(todayKey);
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
          const shape = getDayShape(dayInfos[index], dayInfos[index - 1], dayInfos[index + 1]);
          const hasEntry = datesWithEntries.has(format(day, 'yyyy-MM-dd'));

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDayClick(day)}
              aria-label={format(day, 'EEEE, d MMMM yyyy')}
              aria-current={isToday ? 'date' : undefined}
              className={`relative flex h-12 items-center justify-center text-sm ${
                isToday ? 'font-bold' : 'font-medium'
              }`}
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
        <DrawerContent className="max-h-[88vh]">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle className="text-lg">
              {selectedDate && format(selectedDate, 'EEEE, d MMMM')}
            </DrawerTitle>
            {selectedDateSummary && (
              <p className="text-sm text-gray-500">{selectedDateSummary}</p>
            )}
          </DrawerHeader>
          <div className="space-y-5 overflow-y-auto px-4 pb-8">
            {/* Period start / end / ovulation */}
            <SheetSection title="Cycle">
              {pendingDayType !== null ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3" role="alertdialog" aria-label="Remove period start">
                  <p className="font-medium text-gray-900">Remove this period start?</p>
                  <p className="mt-1 text-sm text-gray-600">
                    The period end and ovulation day logged for this cycle will be removed too.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPendingDayType(null)}
                      className="h-11 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        const type = pendingDayType;
                        setPendingDayType(null);
                        handleDayTypeChange(type, true);
                      }}
                      className="h-11 rounded-xl bg-red-600 text-sm font-semibold text-white"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
              <div className="grid grid-cols-3 gap-2">
                <DayTypeButton
                  icon={<Droplet className="h-5 w-5" />}
                  label="Period start"
                  active={selectedDayType === 'period_start'}
                  activeClass="border-phase-menstrual bg-phase-menstrual text-white"
                  onClick={() => toggleDayType('period_start')}
                />
                <DayTypeButton
                  icon={<DropletOff className="h-5 w-5" />}
                  label="Period end"
                  active={selectedDayType === 'period_end'}
                  activeClass="border-phase-menstrual bg-phase-menstrual text-white"
                  disabled={!canSetPeriodEnd() && selectedDayType !== 'period_end'}
                  onClick={() => toggleDayType('period_end')}
                />
                <DayTypeButton
                  icon={<Egg className="h-5 w-5" />}
                  label="Ovulation"
                  active={selectedDayType === 'ovulation'}
                  activeClass="border-phase-ovulation-strong bg-phase-ovulation-strong text-white"
                  disabled={!canSetOvulation() && selectedDayType !== 'ovulation'}
                  onClick={() => toggleDayType('ovulation')}
                />
              </div>
              )}
            </SheetSection>

            {/* Flow: one choice */}
            <SheetSection title="Flow">
              <div className="grid grid-cols-4 overflow-hidden rounded-xl border border-gray-200">
                {FLOW_OPTIONS.map(({ type, label }, index) => (
                  <button
                    key={type}
                    onClick={() => handleFlowChange(type)}
                    aria-pressed={isSymptomSelected(type)}
                    className={`h-11 text-sm transition-colors ${index > 0 ? 'border-l border-gray-200' : ''} ${
                      isSymptomSelected(type)
                        ? 'bg-phase-menstrual font-semibold text-white'
                        : 'bg-white text-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </SheetSection>

            {/* Pain: slider from 0 (none) to 10 */}
            <SheetSection
              title="Pain"
              value={(() => {
                const level = painDraft ?? selectedPainLevel;
                return level === 0 ? 'None' : `${level} of 10`;
              })()}
            >
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={painDraft ?? selectedPainLevel}
                onChange={(e) => handlePainDrag(Number(e.target.value))}
                onPointerUp={commitPainLevel}
                onTouchEnd={commitPainLevel}
                onKeyUp={commitPainLevel}
                onBlur={commitPainLevel}
                aria-label="Pain level from 0 to 10"
                data-vaul-no-drag
                className="h-11 w-full accent-brand-red"
              />
              <div className="-mt-1 flex justify-between text-xs text-gray-400">
                <span>None</span>
                <span>5</span>
                <span>10</span>
              </div>
            </SheetSection>

            {/* Physical symptoms */}
            <SheetSection title={SYMPTOM_CATEGORIES.physical.label}>
              <div className="flex flex-wrap gap-2">
                {SYMPTOM_CATEGORIES.physical.symptoms.map(({ type, label }) => (
                  <SymptomChip
                    key={type}
                    label={label}
                    selected={isSymptomSelected(type)}
                    onClick={() => handleToggleSymptom(type)}
                  />
                ))}
                {customSymptomsByCategory.physical.map((custom) => (
                  <SymptomChip
                    key={`custom-${custom.id}`}
                    label={custom.name}
                    selected={isSymptomSelected(`custom_${custom.id}`)}
                    onClick={() => handleToggleSymptom(`custom_${custom.id}`)}
                  />
                ))}
              </div>
            </SheetSection>

            {/* Mood symptoms */}
            <SheetSection title={SYMPTOM_CATEGORIES.mood.label}>
              <div className="flex flex-wrap gap-2">
                {SYMPTOM_CATEGORIES.mood.symptoms.map(({ type, label }) => (
                  <SymptomChip
                    key={type}
                    label={label}
                    selected={isSymptomSelected(type)}
                    onClick={() => handleToggleSymptom(type)}
                  />
                ))}
                {customSymptomsByCategory.mood.map((custom) => (
                  <SymptomChip
                    key={`custom-${custom.id}`}
                    label={custom.name}
                    selected={isSymptomSelected(`custom_${custom.id}`)}
                    onClick={() => handleToggleSymptom(`custom_${custom.id}`)}
                  />
                ))}
              </div>
            </SheetSection>

            {/* Add Custom Symptom Button / Form */}
            <div>
              {!isCreatingCustomSymptom ? (
                <button
                  onClick={() => setIsCreatingCustomSymptom(true)}
                  className="flex h-11 items-center gap-1 rounded-full border border-dashed border-brand-red/50 px-4 text-sm font-medium text-brand-red"
                >
                  <PlusIcon />
                  Add custom symptom
                </button>
              ) : (
                <div className="space-y-3 rounded-xl border border-gray-200 p-3">
                  {!newSymptomCategory ? (
                    <div>
                      <p className="mb-2 text-sm text-gray-600">Choose a category</p>
                      <div className="flex gap-2">
                        <SymptomChip label="Physical" selected={false} onClick={() => setNewSymptomCategory('physical')} />
                        <SymptomChip label="Mood" selected={false} onClick={() => setNewSymptomCategory('mood')} />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="mb-2 text-sm text-gray-600">
                        New {newSymptomCategory} symptom
                      </p>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          value={newSymptomName}
                          onChange={(e) => setNewSymptomName(e.target.value)}
                          placeholder="Symptom name"
                          className="h-11 flex-1 text-base"
                          autoFocus
                        />
                        <button
                          onClick={handleCreateCustomSymptom}
                          disabled={!newSymptomName.trim()}
                          className="h-11 rounded-lg bg-brand-red px-4 text-sm font-medium text-white disabled:opacity-50"
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
                    className="h-11 px-1 text-sm text-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Sport: any number of sports, plus how strong it felt */}
            <SheetSection title="Sport">
              <div className="flex flex-wrap gap-2">
                {SPORT_OPTIONS.map(({ type, label }) => (
                  <SymptomChip
                    key={type}
                    label={label}
                    selected={isSymptomSelected(type)}
                    onClick={() => handleToggleSport(type)}
                  />
                ))}
                {customSymptomsByCategory.sport.map((custom) => (
                  <SymptomChip
                    key={`custom-sport-${custom.id}`}
                    label={custom.name}
                    selected={isSymptomSelected(customSportType(custom.id))}
                    onClick={() => handleToggleSport(customSportType(custom.id))}
                  />
                ))}
              </div>

              {/* Add custom sport */}
              <div className="mt-2">
                {!isCreatingCustomSport ? (
                  <button
                    onClick={() => setIsCreatingCustomSport(true)}
                    className="flex h-11 items-center gap-1 rounded-full border border-dashed border-brand-red/50 px-4 text-sm font-medium text-brand-red"
                  >
                    <PlusIcon />
                    Add custom sport
                  </button>
                ) : (
                  <div className="rounded-xl border border-gray-200 p-3">
                    <p className="mb-2 text-sm text-gray-600">New sport</p>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={newSportName}
                        onChange={(e) => setNewSportName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateCustomSport()}
                        placeholder="Sport name"
                        className="h-11 flex-1 text-base"
                        autoFocus
                      />
                      <button
                        onClick={handleCreateCustomSport}
                        disabled={!newSportName.trim()}
                        className="h-11 rounded-lg bg-brand-red px-4 text-sm font-medium text-white disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        setIsCreatingCustomSport(false);
                        setNewSportName('');
                      }}
                      className="mt-1 h-11 px-1 text-sm text-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Strength score, only once a sport is logged */}
              {selectedSportCount > 0 && (
                <div className="mt-4">
                  <div className="mb-2 flex items-baseline justify-between">
                    <h4 className="text-sm font-medium text-gray-500">How strong did you feel?</h4>
                    {selectedSportScore > 0 && (
                      <span className="text-sm font-semibold text-gray-900">
                        {SPORT_SCORE_LABELS[selectedSportScore]}
                      </span>
                    )}
                  </div>
                  <div
                    className="grid grid-cols-5 overflow-hidden rounded-xl border border-gray-200"
                    role="group"
                    aria-label="Strength compared to usual, 1 weaker to 5 stronger"
                  >
                    {[1, 2, 3, 4, 5].map((score, index) => (
                      <button
                        key={score}
                        onClick={() => handleSportScoreChange(score)}
                        aria-pressed={selectedSportScore === score}
                        aria-label={`${score}: ${SPORT_SCORE_LABELS[score]}`}
                        className={`h-11 text-sm transition-colors ${index > 0 ? 'border-l border-gray-200' : ''} ${
                          selectedSportScore === score
                            ? 'bg-brand-red font-semibold text-white'
                            : 'bg-white text-gray-700'
                        }`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-gray-400">
                    <span>Weaker</span>
                    <span>Normal</span>
                    <span>Stronger</span>
                  </div>
                </div>
              )}
            </SheetSection>

            {/* Sexual activity */}
            <SheetSection title="Sex">
              <button
                onClick={() => handleToggleSymptom(SymptomType.SEX)}
                aria-pressed={isSymptomSelected(SymptomType.SEX)}
                className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors ${
                  isSymptomSelected(SymptomType.SEX)
                    ? 'border-brand-red bg-brand-red text-white'
                    : 'border-gray-200 text-gray-700'
                }`}
              >
                <Heart
                  className="h-5 w-5"
                  fill={isSymptomSelected(SymptomType.SEX) ? 'currentColor' : 'none'}
                />
                I had sex today
              </button>
            </SheetSection>

            {/* Notes Section */}
            <SheetSection title="Note">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onBlur={handleSaveNote}
                placeholder="Add a note for this day"
                className="w-full rounded-xl border border-gray-200 p-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                rows={3}
              />
            </SheetSection>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function SheetSection({
  title,
  value,
  children,
}: {
  title: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        {value && <span className="text-sm font-semibold text-gray-900">{value}</span>}
      </div>
      {children}
    </section>
  );
}

function DayTypeButton({
  icon,
  label,
  active,
  activeClass,
  disabled = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  activeClass: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex h-16 flex-col items-center justify-center gap-1 rounded-xl border text-sm font-medium transition-colors ${
        active
          ? activeClass
          : disabled
          ? 'cursor-not-allowed border-gray-100 text-gray-300'
          : 'border-gray-200 text-gray-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function SymptomChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`h-11 rounded-full px-4 text-sm transition-colors ${
        selected ? 'bg-brand-red font-medium text-white' : 'bg-gray-100 text-gray-700'
      }`}
    >
      {label}
    </button>
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
