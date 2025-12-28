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
4. **Privacy First** - No login, no accounts, PIN-derived encryption keys
5. **Error Handling** - No stack traces in UI, console logging only

## Color Scheme
| Color | Hex | Usage |
|-------|-----|-------|
| Red | `#B3014F` | Primary accent, menstrual phase |
| Light Pink | `#ec66a7` | Secondary backgrounds |
| White | `#FFFFFF` | Backgrounds, text |
| Fuchsia | `#FE68A7` | Highlights, buttons |

## Calendar Phase Colors
| Phase | Color | Hex | Style |
|-------|-------|-----|-------|
| Menstrual | Red | `#B3014F` | Solid fill |
| Follicular | Teal | `#24b2c5` | Solid fill |
| Fertile | Green | `#22C55E` | Ring/outline only (shown on underlying phase) |
| Ovulation | Green | `#22C55E` | Solid fill |
| Luteal | Blue | `#3B82F6` | Solid fill |

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
│   ├── InsightsView.tsx     # Statistics and symptom history
│   ├── SettingsView.tsx     # PIN change, export/import, reset
│   ├── MainApp.tsx          # Tab navigation container
│   ├── OnboardingScreen.tsx # First-launch introduction slides
│   ├── PinScreen.tsx        # PIN entry for unlock/setup
│   ├── PhaseSymptoms.tsx    # Today's phase symptom display
│   ├── UserGuide.tsx        # In-app user guide with privacy info
│   └── ServiceWorkerRegistration.tsx # PWA service worker
├── context/
│   └── AppContext.tsx       # Global app state (unlock, first launch)
├── lib/
│   ├── db.ts                # Database interface + SQLite implementation
│   ├── db-web.ts            # localStorage implementation for web/PWA
│   ├── cycle-logic.ts       # Pure functions for phase calculations
│   ├── crypto.ts            # PIN-based key derivation and verification
│   └── utils.ts             # Utility functions (cn for classnames)
└── types.ts                 # TypeScript interfaces and enums
```

## Security

### PIN Protection
- **Format**: 4 digits only
- **Encryption**: SQLCipher with key derived from PIN (native) / localStorage (web)
- **Auto-lock**: App locks immediately when put in background
- **No Recovery**: Forgotten PIN = data lost forever
- **Reset Option**: User can reset app (deletes all data) to start fresh

### First Launch Flow
1. Onboarding screen with app introduction
2. Mandatory 4-digit PIN setup
3. PIN confirmation
4. Main calendar view with empty state message

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
| category | TEXT | 'physical' or 'mood' |
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

### Average Cycle Length
- Mean of last 6 completed cycles
- Default: 28 days (if < 2 cycles recorded)
- No special handling for outliers - simple average

### Phase Definitions (in visual priority order)
1. **Menstrual**: `period_start` to `period_end` (default 5 days if end unknown)
2. **Ovulation**: User-marked date (stored in `cycles.ovulation_date`) OR estimated as `CycleLength - 14 days`
3. **Fertile Window**: `O_day - 4` to `O_day + 1` (displayed as green ring overlay on underlying phase)
4. **Follicular**: End of Menstrual to day before Ovulation
5. **Luteal**: Day after Ovulation to next `period_start`

### Standard 28-Day Cycle Example
| Days | Phase | Calendar Color |
|------|-------|----------------|
| 1-5 | Menstruation | Red (solid) |
| 6-9 | Follicular | Teal (solid) |
| 10-14 | Follicular + Fertile | Teal (solid) + Green ring |
| 14 | Ovulation | Green (solid) |
| 15 | Luteal + Fertile | Blue (solid) + Green ring |
| 16-28 | Luteal | Blue (solid) |

### Conflict Resolution
- If "Fertile" overlaps with "Menstrual" (short cycles), **Menstrual wins** visually
- Fertile window is shown as a ring/outline overlay, not a separate background color
- The day after ovulation shows as Luteal (blue) but still has the fertile ring

## Predictions
- Project 12 months into the future
- Formula: `LastPeriodStart + (n × AverageCycleLength)`
- Predictions shown with reduced opacity (70%)

## Calendar View

### Layout
- Month name displayed at top with navigation arrows
- Monday as first day of week
- Day number in each cell
- Cell background color indicates phase
- Today highlighted with a ring in phase-contrasting color
- Pen icon on days with user entries (period start/end, ovulation, symptoms)

### Day Drawer
Tap any non-future date to open bottom drawer with:
- **Day Type Selection** (radio buttons):
  - None
  - Period Start
  - Period End (only if within a cycle)
  - Ovulation (only if within a cycle)
- **Symptoms** (toggleable buttons):
  - Physical symptoms (including custom)
  - Flow indicators
  - Mood symptoms (including custom)
  - "Add custom symptom" option
- **Notes**: Free-form text area for day notes

### Empty State
When no data exists, show message:
> "Start tracking your periods as they come, or fill in historic data from the last 6 months."

### Phase Legend
Displayed below calendar showing all phase colors

### Phase Symptoms
Shows historical symptoms for today's current phase from last 6 cycles

## Insights View

### Statistics Displayed
Based on last 6 cycles:
- **Cycle Length**: Average, Shortest, Longest (days)
- **Period Duration**: Average, Shortest, Longest (days)
- **Days Until Ovulation**: Average, Shortest, Longest (days)
- **History**: Total periods tracked

### Common Symptoms by Phase
For each phase (Menstrual, Follicular, Ovulation, Luteal):
- Shows ALL symptoms recorded during that phase
- Displays occurrence count as "X/6" (X out of last 6 cycles)
- Most common symptoms displayed first
- Empty state message if no symptoms recorded

## Settings View

### Options
- User Guide (in-app help with privacy info)
- Change PIN
- Export Data (JSON backup file)
- Import Data (destructive restore)
- Reset App (delete all data)

## User Guide

Accessible from Settings > User Guide. Contains:

### Privacy Information
- 100% Offline operation (no servers, no cloud)
- Local storage only (browser localStorage or encrypted SQLite)
- PIN protection encrypts data
- No recovery mechanism (intentional for privacy)
- Zero analytics or tracking

### Feature Documentation
- Calendar View navigation
- Logging period start/end/ovulation
- Symptom tracking (default and custom)
- Daily notes
- Cycle predictions
- Insights and statistics
- Data export/import
- PIN management

### Visual Guides
- Calendar color legend (phase colors)
- Calendar icon meanings (circle, star, pen)

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
5. Validate version
6. Wipe database
7. Restore from JSON

## UI Guidelines
- **Mobile First**: Touch targets >= 44px (`h-12` or `h-14`)
- **Bottom Sheets**: Use Drawers instead of centered Modals for data entry
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
npm run build            # Build web assets (static export)
npx cap sync             # Copy build to native platforms
npx cap open ios         # Open Xcode
npx cap open android     # Open Android Studio
npx cap run android      # Run on Android device/emulator
```

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
- [x] PIN setup and lock screen
- [x] Core cycle logic with phase calculations
- [x] Calendar view with phase colors
- [x] Period start/end/ovulation logging
- [x] Symptom tracking (default + custom)
- [x] Day notes
- [x] Insights view with statistics
- [x] Common symptoms by phase
- [x] Phase symptoms display (current phase, common symptoms, next period countdown)
- [x] Settings page
- [x] User guide with privacy info
- [x] Data export/import
- [x] PWA configuration
- [x] Mobile safe area handling (browser chrome)
- [ ] Capacitor mobile builds (not yet tested)
