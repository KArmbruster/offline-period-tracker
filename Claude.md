# Offline Privacy-First Menstrual Cycle Tracker

## Project Overview
A 100% local, offline menstrual tracking application with zero data exfiltration. Built for iOS, Android (via Capacitor), and Web (PWA). Single user only.

## Tech Stack
- **Framework**: Next.js 14+ (App Router), React, TypeScript
- **Mobile**: Capacitor (Ionic)
- **UI**: ShadCN UI + Tailwind CSS
- **Database**: SQLite with SQLCipher encryption (capacitor-sqlite)
- **State**: React Context/Hooks
- **Date Handling**: date-fns

## Critical Rules
1. **NO Network Requests** - No fetch, axios, XMLHttpRequest, or 3rd party SDKs requiring internet
2. **NO Analytics/Telemetry** - Strictly forbidden
3. **Local Storage Only** - All data in encrypted local SQLite
4. **Privacy First** - No login, no accounts, PIN-derived encryption keys
5. **Error Handling** - No stack traces in UI, console logging only

## Color Scheme
| Color | Hex | Usage |
|-------|-----|-------|
| Red | `#B3014F` | Primary accent, menstrual phase |
| Light Pink | `#FFABD4` | Secondary backgrounds |
| White | `#FFFFFF` | Backgrounds, text |
| Fuchsia | `#FE68A7` | Highlights, buttons |

## Calendar Phase Colors
| Phase | Color | Style |
|-------|-------|-------|
| Menstrual | Red | Solid fill |
| Follicular | Teal | Solid fill |
| Fertile | Green | Outline only |
| Ovulation | Green | Solid fill |
| Luteal | Blue | Solid fill |

## File Structure
```
src/
├── app/
│   ├── (tabs)/           # Main navigation (Calendar, Insights, Settings)
│   └── pin/              # PIN entry/setup screens
├── components/
│   └── ui/               # ShadCN primitives
├── lib/
│   ├── db.ts             # SQLite connection singleton
│   ├── cycle-logic.ts    # Pure functions for phase calculations
│   └── crypto.ts         # PIN-based key derivation
└── types.ts              # TypeScript interfaces and enums
```

## Security

### PIN Protection
- **Format**: 4 digits only
- **Encryption**: SQLCipher with key derived from PIN
- **Auto-lock**: App locks immediately when put in background
- **No Recovery**: Forgotten PIN = data lost forever
- **Reset Option**: User can reset app (deletes all data) to start fresh

### First Launch Flow
1. Mandatory 4-digit PIN setup
2. PIN confirmation
3. Main calendar view with empty state message

## Database Schema

### Tables

#### `cycles`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| period_start_date | TEXT | ISO 8601 (YYYY-MM-DD) |
| period_end_date | TEXT | ISO 8601, nullable |
| created_at | TEXT | Timestamp |

#### `symptoms`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| cycle_id | INTEGER | Foreign key to cycles |
| date | TEXT | ISO 8601 |
| symptom_type | TEXT | Symptom identifier |
| notes | TEXT | Optional notes |

#### `custom_symptom_types`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| name | TEXT | User-defined symptom name (unique) |
| created_at | TEXT | Timestamp |

#### `ovulation_markers`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| cycle_id | INTEGER | Foreign key to cycles |
| date | TEXT | ISO 8601 |
| is_confirmed | INTEGER | 0 = estimated, 1 = user-marked |

### Required Indices
- `idx_cycles_start_date` on `cycles(period_start_date)`
- `idx_symptoms_cycle_id` on `symptoms(cycle_id)`
- `idx_symptoms_date` on `symptoms(date)`

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

  // Other
  ACNE = 'acne',
  INSOMNIA = 'insomnia',
  CRAVINGS = 'cravings',
}
```

## Cycle Logic

### Average Cycle Length
- Mean of last 6 completed cycles
- Default: 28 days (if < 2 cycles recorded)
- No special handling for outliers - simple average

### Phase Definitions (in visual priority order)
1. **Menstrual**: `period_start` to `period_end` (default 5 days if end unknown)
2. **Ovulation**: User-marked date OR `CycleLength - 14 days`
3. **Fertile Window**: `O_day - 5` to `O_day + 1`
4. **Follicular**: End of Menstrual to Start of Fertile
5. **Luteal**: `O_day + 2` to next `period_start`

### Standard 28-Day Cycle Example
| Days | Phase | Calendar Color |
|------|-------|----------------|
| 1-5 | Menstruation | Red (solid) |
| 6-8 | Follicular | Teal (solid) |
| 9-13 | Fertile | Green (outline) |
| 14 | Ovulation | Green (solid) |
| 15 | Fertile | Green (outline) |
| 16-28 | Luteal | Blue (solid) |

### Conflict Resolution
If "Fertile" overlaps with "Menstrual" (short cycles), **Menstrual wins** visually.

## Predictions
- Project 12 months into the future
- Formula: `LastPeriodStart + (n × AverageCycleLength)`

## Calendar View

### Layout
- Month name displayed at top
- Monday as first day of week
- Day number in each box
- Box background color indicates phase

### Interaction
- Tap any date to open bottom sheet
- Bottom sheet shows two buttons:
  - "Start of Period"
  - "End of Period"
- Can also log symptoms for that date

### Empty State
When no data exists, show message:
> "Start tracking your periods as they come, or fill in historic data from the last 6 months."

## Insights View

### Statistics Displayed (simple numbers, no charts)
- Average cycle length (days)
- Cycle length variation (shortest/longest)
- Average period duration (days)
- Most common symptoms
- Next predicted period date
- Next predicted ovulation date

## Settings View

### Options
- Change PIN
- Export Data (JSON, encrypted with app PIN)
- Import Data (destructive restore)
- Reset App (delete all data)

## Data Export/Import

### Export Format
```json
{
  "version": 1,
  "exported_at": "2024-01-15T10:30:00Z",
  "cycles": [...],
  "symptoms": [...],
  "custom_symptom_types": [...],
  "ovulation_markers": [...]
}
```

### Export Flow
1. User taps "Export Data"
2. Data encrypted with app PIN using SQLCipher-compatible method
3. Save to device filesystem via native sharing

### Import Flow
1. User taps "Import Data"
2. Warning: "This will delete all existing data"
3. User confirms
4. Select file
5. Decrypt with current PIN
6. Wipe database
7. Restore from JSON

## UI Guidelines
- **Mobile First**: Touch targets ≥ 44px (`h-12` or `h-14`)
- **Bottom Sheets**: Use Drawers instead of centered Modals for data entry
- **Font Size**: ≥ 16px for inputs (prevents iOS auto-zoom)
- **Theme**: Single color theme (Red/Pink/White/Fuchsia), calm aesthetic
- **Language**: English only
- **Notifications**: None

## Development Commands
```bash
npm run dev              # Start development server
npm run build            # Build web assets
npx cap sync             # Copy build to native platforms
npx cap open ios         # Open Xcode
npx cap open android     # Open Android Studio
npx cap run android      # Run on Android device/emulator
```

## Adding a New Symptom Type
1. Add to `SymptomType` enum in `types.ts`
2. Update SQLite migration in `lib/db.ts` if needed
3. Add icon/label mapping in `components/SymptomPicker.tsx`

## Current Status
- [ ] Project setup and scaffolding
- [ ] Database layer with SQLCipher
- [ ] PIN setup and lock screen
- [ ] Core cycle logic
- [ ] Calendar view with phase colors
- [ ] Period start/end logging
- [ ] Symptom tracking (default + custom)
- [ ] Insights view
- [ ] Settings page
- [ ] Data export/import
- [ ] PWA configuration
- [ ] Capacitor mobile builds
