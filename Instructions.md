\## Project: Offline Privacy-First Menstrual Cycle Tracker (v1)



\*\*Core Mission:\*\* Build a 100% local, offline menstrual tracking app with zero data exfiltration.

\*\*Target Platform:\*\* iOS \& Android (via Capacitor) + Web (PWA).



---



\## 1. Critical Rules (Non-Negotiable)



\* \*\*NO Network Requests:\*\* Do not use `fetch`, `axios`, or `XMLHttpRequest`. Do not add 3rd party SDKs that require internet.

\* \*\*NO Analytics/Telemetry:\*\* Strictly forbidden.

\* \*\*Local Storage Only:\*\* All data must persist in local SQLite (via Capacitor community plugin).

\* \*\*Privacy First:\*\* No login, no accounts. Encryption keys derived from user PIN.

\* \*\*Error Handling:\*\* Never show stack traces to the UI. Log errors to console only (dev) or local file (prod).



---



\## 2. Tech Stack \& Environment



\* \*\*Framework:\*\* Next.js 14+ (App Router), React, TypeScript.

\* \*\*Mobile Wrapper:\*\* Capacitor (Ionic).

\* \*\*UI Library:\*\* ShadCN UI (Tailwind CSS).

\* \*\*Database:\*\* SQLite (using `capacitor-sqlite`).

\* \*\*State:\*\* React Context / Hooks (no Redux/Zustand unless complex global state arises).

\* \*\*Styling:\*\* Tailwind CSS.



---



\## 3. Development Commands



\* `npm run dev` - Start Next.js development server.

\* `npm run build` - Build the web assets for export.

\* `npx cap sync` - Copy web build to native platforms.

\* `npx cap open ios` - Open Xcode project.

\* `npx cap open android` - Open Android Studio project.

\* `npx cap run android` - Run directly on Android device/emulator.



---



\## 4. Architecture \& Data Model



\### Database (SQLite)

\* \*\*Tables:\*\* `Cycle`, `Symptom`, `OvulationMarker`.

\* \*\*Indices:\*\* REQUIRED on `period\_start\_date` and `cycle\_id` for performance.

\* \*\*Encryption:\*\* Database must be encrypted using a key derived from the user's PIN.



\### Data Export (Backup)

\* \*\*Format:\*\* JSON (Plain text or Encrypted - user choice).

\* \*\*Mechanism:\*\* Save to device filesystem (Files/Downloads) via native sharing.

\* \*\*Restore:\*\* "Destructive Restore" (wipes DB, replaces with JSON content).



---



\## 5. Domain Logic (Cycle \& Phases)



\*\*Cycle Calculation:\*\*

\* `Average Cycle Length`: Mean of last 6 cycles (default 28 if < 2 cycles).

\* `Prediction`: Project 12 months into the future.

&nbsp;   \* Formula: $LastPeriod + (n \\times AverageLength)$



\*\*Phase Definitions (Visual Priority):\*\*

1\.  \*\*Menstrual:\*\* `period\\\_start` to `period\\\_end`. (If end unknown, assume 5 days).

2\.  \*\*Ovulation ($O\_{day}$):\*\*

    \* User marked: Explicit date.

    \* Estimated: `CycleLength - 14 days`.

3\.  \*\*Fertile Window:\*\* $O\_{day} - 5$ to $O\_{day} + 1$ (Includes day after).

4\.  \*\*Follicular:\*\* End of Menstrual to Start of Fertile.

5\.  \*\*Luteal:\*\* $O\_{day} + 2$ to next `period\\\_start`.



\*Conflict Rule:\* If "Fertile" overlaps with "Menstrual" (short cycle), \*\*Menstrual\*\* wins visually.





Here is how the logic maps to a standard 28-day cycle:

Days 1–5: Menstruation 🩸

Days 6–8: Follicular 🌑 (Infertile)

Days 9–13: Fertile Phase 🌿 (High Chance)

Day 14: Ovulation 🥚 (Peak)

Day 15: Fertile Phase 🌿 (Last Chance)

Days 16–28: Luteal 🍂 (Infertile)



---



\## 6. Coding Standards \& UI Guidelines



\### UI Components (ShadCN)

\* \*\*Mobile First:\*\*

&nbsp;   \* Touch targets must be ≥ 44px (`h-12` or `h-14` in Tailwind).

&nbsp;   \* Use \*\*Drawers (Bottom Sheets)\*\* instead of centered Modals/Dialogs for data entry.

&nbsp;   \* Font size ≥ 16px for inputs to prevent iOS auto-zoom.

\* \*\*Theme:\*\* "Calm" aesthetic. No jarring animations.


Color Scheme:
Red: #B3014F
Light_Pink: #FFABD4
White: #FFFFFF
Fuchsia: #FE68A7

\### TypeScript

\* \*\*Strict Mode:\*\* Enabled.

\* \*\*No `any`:\*\* define interfaces for all Cycle/Symptom data.

\* \*\*Dates:\*\* Use `date-fns` for all date manipulation. Store dates as ISO 8601 strings (`YYYY-MM-DD`) in DB.



\### File Structure

\* `src/components/ui` - ShadCN primitives.

\* `src/lib/db.ts` - SQLite connection singleton.

\* `src/lib/cycle-logic.ts` - Pure functions for phase calculations (testable).

\* `src/app/(tabs)` - Main app navigation (Calendar, Insights, Settings).



---



\## 7. Common Tasks \& Snippets



\*\*Adding a new Symptom Type:\*\*

1\.  Add to `SymptomType` enum in `types.ts`.

2\.  Update SQLite migration in `lib/db.ts` if needed (usually just data).

3\.  Add icon/label mapping in `components/SymptomPicker.tsx`.



\*\*Deploying a Fix:\*\*

1\.  `npm run build`

2\.  `npx cap sync`

3\.  (Test on device via Xcode/Android Studio).

