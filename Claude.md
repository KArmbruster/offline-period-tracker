# Offline Privacy-First Menstrual Cycle Tracker

## Project Overview
A 100% local, offline menstrual tracking application with zero data exfiltration. Built for iOS, Android (via Capacitor), and Web (PWA). Single user only.

## Tech Stack
- **Framework**: Next.js 16+ (App Router, static export), React, TypeScript
- **Mobile**: Capacitor (Ionic)
- **UI**: ShadCN UI + Tailwind CSS
- **Database**: SQLite with SQLCipher encryption (native) / localStorage (web)
- **State**: React Context/Hooks
- **Date Handling**: date-fns

## Critical Rules
1. **NO Network Requests** - No fetch, axios, XMLHttpRequest, or 3rd party SDKs requiring internet
2. **NO Analytics/Telemetry** - Strictly forbidden
3. **Local Storage Only** - All data in encrypted local SQLite (native) or localStorage (web)
4. **Privacy First** - No login, no accounts, no PIN lock (removed)
5. **Error Handling** - No stack traces in UI, console logging only

## Color Scheme
| Color | Hex | Usage |
|-------|-----|-------|
| Red | `#B3014F` | Primary accent, menstrual phase |
| Light Pink | `#ec66a7` | Secondary backgrounds |
| White | `#FFFFFF` | Backgrounds, text |
| Fuchsia | `#FE68A7` | Highlights, buttons |

## Calendar Phase Colors
Logged days are filled, predicted days have a dashed outline. Follicular and luteal use a soft fill with dark text so the day number stays readable.

| Phase | Color | Hex | Style |
|-------|-------|-----|-------|
| Menstrual | Red | `#B3014F` | Solid band joining the period days, white text |
| Follicular | Amber | `#F0B429` (fill `#FCEBC2`, text `#7A4A00`) | Soft fill circle |
| Fertile | Green | `#22C55E` | Ring/outline only (shown on underlying phase) |
| Ovulation | Green | `#15803D` | Solid circle, white text |
| Luteal | Teal | `#24b2c5` (fill `#D3F0F4`, text `#0B5560`) | Soft fill circle |
| Today | Ink | `#2A1420` | Dark ring with white gap + "Today" label |

All colors are tokens in `globals.css` (`bg-phase-luteal-soft`, `text-phase-luteal-ink`, `ring-ink`, ...).

## File Structure
```
src/
├── app/
│   ├── globals.css          # Tailwind + custom CSS variables
│   ├── layout.tsx           # Root layout with AppProvider
│   ├── page.tsx             # Main entry point
│   └── icon.svg             # App icon
├── components/
│   ├── ui/                  # ShadCN primitives (button, drawer, input)
│   ├── CalendarView.tsx     # Main calendar with phase display
│   ├── CycleStatusCard.tsx  # Cycle day, phase and next period, above the calendar
│   ├── InsightsView.tsx     # Statistics and symptom history
│   ├── SettingsView.tsx     # User guide, export/import, reset
│   ├── MainApp.tsx          # Tab navigation container
│   ├── OnboardingScreen.tsx # First-launch introduction slides
│   ├── PhaseSymptoms.tsx    # Common symptoms for today's phase
│   ├── UserGuide.tsx        # In-app user guide with privacy info
│   └── ServiceWorkerRegistration.tsx # PWA service worker
├── context/
│   └── AppContext.tsx       # Global app state (first launch)
├── lib/
│   ├── db.ts                # Database interface + SQLite implementation
│   ├── db-web.ts            # localStorage implementation for web/PWA
│   ├── cycle-logic.ts       # Pure functions for phase calculations
│   ├── symptom-utils.ts     # Symptom labels and pain helpers
│   └── utils.ts             # Utility functions (cn for classnames)
└── types.ts                 # TypeScript interfaces and enums
```

## First Launch Flow
1. Onboarding screens with app introduction and install instructions
2. Main calendar view with empty state message

There is no PIN lock or app lock; it was removed. `crypto.ts` and the PIN screens no longer exist.

## Database Schema

### Tables

#### `cycles`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| period_start_date | TEXT | ISO 8601 (YYYY-MM-DD) |
| period_end_date | TEXT | ISO 8601, nullable |
| ovulation_date | TEXT | ISO 8601, nullable (user-marked) |
| created_at | TEXT | Timestamp |

#### `symptoms`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| cycle_id | INTEGER | Foreign key to cycles, nullable |
| date | TEXT | ISO 8601 |
| symptom_type | TEXT | Symptom identifier |
| notes | TEXT | Optional notes |

#### `custom_symptom_types`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| name | TEXT | User-defined symptom name (unique) |
| category | TEXT | 'physical', 'mood' or 'sport' |
| created_at | TEXT | Timestamp |

#### `day_notes`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| date | TEXT | ISO 8601 (unique) |
| content | TEXT | Free-form note text |
| created_at | TEXT | Timestamp |
| updated_at | TEXT | Timestamp |

### Required Indices
- `idx_cycles_start_date` on `cycles(period_start_date)`
- `idx_symptoms_cycle_id` on `symptoms(cycle_id)`
- `idx_symptoms_date` on `symptoms(date)`
- `idx_day_notes_date` on `day_notes(date)`

## Default Symptom Types
```typescript
enum SymptomType {
  // Physical
  CRAMPS = 'cramps',
  HEADACHE = 'headache',
  BLOATING = 'bloating',
  BREAST_TENDERNESS = 'breast_tenderness',
  FATIGUE = 'fatigue',
  BACKACHE = 'backache',
  NAUSEA = 'nausea',
  ACNE = 'acne',
  INSOMNIA = 'insomnia',
  CRAVINGS = 'cravings',

  // Flow
  FLOW_LIGHT = 'flow_light',
  FLOW_MEDIUM = 'flow_medium',
  FLOW_HEAVY = 'flow_heavy',
  SPOTTING = 'spotting',

  // Mood
  MOOD_HAPPY = 'mood_happy',
  MOOD_SAD = 'mood_sad',
  MOOD_IRRITABLE = 'mood_irritable',
  MOOD_ANXIOUS = 'mood_anxious',
  MOOD_CALM = 'mood_calm',
  MOOD_HORNY = 'mood_horny',
}
```

## Cycle Logic

All phase calculations live in `createCycleModel()` in `cycle-logic.ts`. The calendar, the phase panel and the symptom statistics all read from it; do not compute phases anywhere else.

### Average Cycle Length
- Mean of last 6 completed cycles
- Default: 28 days (if < 2 cycles recorded)
- Gaps of 60+ days, or longer than 1.5x the median of the recent cycles, are ignored (a period that was not logged, not a real cycle)
- Predictions use the exact mean and round each projected date, so they do not drift

### Phase Definitions (in visual priority order)
1. **Menstrual**: `period_start` to `period_end` (default 5 days if end unknown, max 14 days can be logged)
2. **Ovulation**: User-marked date (stored in `cycles.ovulation_date`) OR estimated as cycle day `CycleLength - 14` (day 14 of a 28-day cycle)
   - Completed cycles use their own real length; the current cycle uses the average
   - A user-marked ovulation day in the current cycle moves the expected next period to 15 days after it
3. **Fertile Window**: `O_day - 5` to `O_day + 1` (displayed as green ring overlay on underlying phase)
4. **Follicular**: End of Menstrual to day before Ovulation
5. **Luteal**: Day after Ovulation to next `period_start`

### Standard 28-Day Cycle Example
| Days | Phase | Calendar Color |
|------|-------|----------------|
| 1-5 | Menstruation | Red (solid) |
| 6-8 | Follicular | Amber (soft) |
| 9-13 | Follicular + Fertile | Amber (soft) + Green ring |
| 14 | Ovulation | Green (solid) + Green ring |
| 15 | Luteal + Fertile | Teal (soft) + Green ring |
| 16-28 | Luteal | Teal (soft) |

### Conflict Resolution
- If "Fertile" overlaps with "Menstrual" (short cycles), **Menstrual wins**: no fertile ring on period days
- Fertile window is shown as a ring/outline overlay, not a separate background color
- The day after ovulation shows as Luteal (teal) but still has the fertile ring

### Late Period
- A period that is due or late and not logged is never drawn in the past: those days stay Luteal
- The predicted period slides forward and starts tomorrow at the earliest
- More than one full cycle length overdue: no phase is shown for the days beyond

## Predictions
- Project 12 months into the future, from the first logged cycle on
- Formula: `LastPeriodStart + (n × AverageCycleLength)`
- Predictions shown with a dashed outline instead of a solid fill

## Calendar View

### Layout
- Status card at the top: cycle day, current phase, next period (or how late it is), fertile hint
- Month name with a "Today" button and navigation arrows; the Today button is highlighted when another month is shown
- Monday as first day of week
- Day number in each cell
- Cell fill indicates phase (see Calendar Phase Colors)
- Today marked with a dark ring and a "Today" label
- Small dot on days with user entries (period start/end, ovulation, symptoms, notes)

### Day Drawer
Tap any non-future date to open the bottom sheet. Header shows the date plus "Today · Cycle day N · Phase".
- **Cycle** (three toggle buttons, tap the active one again to clear it):
  - Period start (asks for confirmation before removing a start that has an end or ovulation day)
  - Period end (only within 14 days of the period start)
  - Ovulation (only if within a cycle)
- **Flow**: segmented control, one choice per day (Spotting, Light, Medium, Heavy)
- **Pain**: slider from None to 10, saved when released (stored as `period_pain_N`)
- **Symptoms** (toggleable chips, 44px tall):
  - Physical symptoms (including custom)
  - Mood symptoms (including custom)
  - "Add custom symptom" option
- **Sport**: chips for built-in and custom sports (multi choice, "Add custom sport"); once a sport is selected, a 1-5 strength scale appears (1 weaker than usual, 3 normal, 5 stronger). Removing the last sport also clears the score
- **Sex**: one toggle, "I had sex today"
- **Notes**: Free-form text area for day notes
- Icons come from `lucide-react`; no emojis

### Empty State
When no data exists, show message:
> "Start tracking your periods as they come, or fill in historic data from the last 6 months."

### Phase Legend
Compact row below the calendar: Period, Follicular, Ovulation, Luteal, Fertile, Predicted

### Phase Symptoms
Below the legend: historical symptoms for today's current phase from last 6 cycles

## Insights View

Based on the last 6 cycles (gaps from unlogged periods are excluded, see Cycle Logic).

### Statistics Displayed
- **Cycle Length** and **Period Duration**: average, with shortest-longest range
- Neutral note when recent cycles fall outside 21-35 days or vary by more than 7 days
- **Cycle history**: one bar per cycle (current cycle first) showing its length and the period days; excluded gaps are marked "not counted"
- **Periods tracked**: total count

### Common Symptoms by Phase
For each phase (Menstrual, Follicular, Ovulation, Luteal):
- Shows ALL symptoms recorded during that phase
- Displays "X of N cycles": the number of the last 6 cycles in which the symptom was logged in that phase (several days in one cycle count once)
- Most common symptoms displayed first
- Average pain level per phase, shown as a ten-step bar (`PainBar.tsx`)
- Empty state message if no symptoms recorded

## Settings View

### Options
- User Guide (in-app help with privacy info)
- Export Data (JSON backup file)
- Import Data (destructive restore)
- Reset App (delete all data)

## User Guide

Accessible from Settings > User Guide. Contains:

### Privacy Information
- 100% Offline operation (no servers, no cloud)
- Local storage only (browser localStorage or encrypted SQLite)
- No recovery mechanism: regular exports are the only backup
- Zero analytics or tracking

### Feature Documentation
- Calendar View navigation
- Logging period start/end/ovulation
- Symptom tracking (default and custom)
- Daily notes
- Cycle predictions
- Insights and statistics
- Data export/import

### Visual Guides
- Calendar color legend (phase colors)
- Calendar marker meanings (today ring, dashed outline, dot)

## Data Export/Import

### Export Format
```json
{
  "version": 1,
  "exported_at": "2024-01-15T10:30:00Z",
  "cycles": [...],
  "symptoms": [...],
  "custom_symptom_types": [...],
  "day_notes": [...]
}
```

### Export Flow
1. User taps "Export Data"
2. JSON file generated with timestamp in filename
3. Download triggered via browser

### Import Flow
1. User taps "Import Data"
2. Warning: "This will delete all existing data"
3. User confirms
4. Select JSON file
5. Validate version and file shape (nothing is wiped if the file is not a backup)
6. Wipe database
7. Restore from JSON

## UI Guidelines
- **Mobile First**: Touch targets >= 44px (`h-12` or `h-14`)
- **Bottom Sheets**: Use Drawers instead of centered Modals for data entry
- **No browser dialogs**: Never use `alert()` or `confirm()`. Use `ConfirmSheet.tsx` for confirmations and notices; inside the day sheet, confirm inline (drawers must not be nested)
- **Font Size**: >= 16px for inputs (prevents iOS auto-zoom)
- **Theme**: Single color theme (Red/Pink/White/Fuchsia), calm aesthetic
- **Language**: English only
- **Notifications**: None
- **No Emojis**: Unless explicitly requested by user
- **Safe Areas**: Use `safe-area-top` and `safe-area-bottom` classes for mobile browser chrome
- **Viewport**: Uses `viewport-fit: cover` to enable safe area insets

## Development Commands
```bash
npm run dev              # Start development server
npm run build            # Build web assets (static export, GitHub Pages base path)
npm run build:mobile     # Build without base path and run cap sync (native app)
npm test                 # Run the cycle logic tests (Vitest)
npx cap sync             # Copy build to native platforms
npx cap open ios         # Open Xcode
npx cap open android     # Open Android Studio
npx cap run android      # Run on Android device/emulator
```

## Base Path
- The web build is served from `/offline-period-tracker` (GitHub Pages); development and the native build are served from the root
- `next.config.ts` decides this (`BUILD_TARGET=mobile` removes the prefix) and exposes it as `NEXT_PUBLIC_BASE_PATH`
- In app code always import `basePath` from `src/lib/base-path.ts`; never hard-code the repo path
- `public/manifest.json` uses relative URLs so it works under any base path

## Adding a New Symptom Type
1. Add to `SymptomType` enum in `types.ts`
2. Add label mapping in `CalendarView.tsx` `SYMPTOM_CATEGORIES`
3. Add label mapping in `InsightsView.tsx` `SYMPTOM_LABELS`

## Adding a Custom Symptom (User Flow)
1. Open day drawer
2. Click "Add custom symptom"
3. Select category (Physical or Mood)
4. Enter symptom name
5. Symptom appears in appropriate section

## Current Status
- [x] Project setup and scaffolding
- [x] Database layer (SQLite native + localStorage web)
- [x] Core cycle logic with phase calculations
- [x] Calendar view with phase colors
- [x] Period start/end/ovulation logging
- [x] Symptom tracking (default + custom)
- [x] Day notes
- [x] Insights view with statistics
- [x] Common symptoms by phase
- [x] Sport (with strength score) and sex tracking, averaged per phase in Insights
- [x] Cycle status card (cycle day, current phase, next period countdown) and phase symptoms
- [x] Settings page
- [x] User guide with privacy info
- [x] Data export/import
- [x] PWA configuration
- [x] Mobile safe area handling (browser chrome)
- [ ] Capacitor mobile builds (web bundle loads from the root; not yet run on a device)

## Sport and Sex Tracking
Stored as rows in the `symptoms` table, so export/import and the calendar dot work without schema changes:

| Entry | `symptom_type` |
|-------|----------------|
| Built-in sport | `sport_running`, `sport_cycling`, `sport_swimming`, `sport_strength_training`, `sport_yoga`, `sport_pilates`, `sport_hiking` (`SportType` enum) |
| Custom sport | `sport_custom_<id>` (id from `custom_symptom_types` with category `sport`) |
| Strength score | `sport_score_1` to `sport_score_5`, one per day |
| Sex | `sex` |

- `isActivityEntry()` in `symptom-utils.ts` identifies these; `getSymptomsForPhaseHistory` skips them so they never show up as symptoms
- Insights "Sport and sex by phase" uses `getActivityStatsByPhase()`: per phase, sport sessions per cycle, average strength score, and days with sex per cycle, across the last 6 cycles. Counts are divided by the number of cycles that have reached that phase, so the current cycle only counts for phases it has been through
