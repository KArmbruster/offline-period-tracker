# Offline Period Tracker

A private menstrual cycle tracker that runs entirely on your device. No account, no server, no analytics: your data never leaves your phone.

- Calendar with cycle phases, fertile window and predictions for the next 12 months
- Log period start and end, ovulation, flow, pain, symptoms, mood and notes
- Insights: cycle length, period duration, cycle history and common symptoms per phase
- Export and import your data as a backup file

The fertile window and all predictions are estimates. They are not suitable as contraception.

## Get the app onto your phone

The app is a web app that you install from the browser. Once installed it has its own icon, opens full screen and works without an internet connection.

Open this address on your phone:

**https://karmbruster.github.io/offline-period-tracker/**

### Android (Chrome)

1. Open the address above in Chrome.
2. Tap the menu (three dots) in the top right.
3. Tap **Install app** or **Add to Home screen**.
4. Tap **Install** to confirm.

### iPhone or iPad (Safari)

1. Open the address above in Safari. Other browsers on iOS cannot install the app.
2. Tap the **Share** button (the square with an arrow).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add** to confirm.

Open the app from its new home screen icon from now on. On iPhone this matters: data entered in the Safari tab is separate from the installed app, and Safari may delete data of websites that are not installed after a few weeks without use.

### Keep a backup

Your data is stored only in the app on that one phone. There is no cloud copy and no way to recover it if the phone is lost, the app is removed, or the browser's site data is cleared.

- Go to **Settings > Export data** regularly and keep the file somewhere safe.
- To move to a new phone, install the app there and use **Settings > Import data** with your latest export. Importing replaces everything on that device.

### Updates

The installed app updates itself the next time it is opened with an internet connection. Your data stays in place.

## Native Android app (not working yet)

The repository contains a Capacitor Android project in `android/`, with the launcher icons and an encrypted SQLite database prepared. It has not been built or tested on a device.

One known blocker: the production build is configured for the GitHub Pages address, so every asset path starts with `/offline-period-tracker`. A native app serves its files from the root, so a build made with `npm run build` will not load correctly inside the Android app until the base path is made configurable. The affected places are `next.config.ts`, `src/app/layout.tsx`, `ServiceWorkerRegistration.tsx`, `OnboardingScreen.tsx`, `SettingsView.tsx`, `scripts/generate-sw.js` and `public/manifest.json`.

Once that is solved, the steps are:

```bash
npm run build
npx cap sync android
npx cap open android
```

Then build and run from Android Studio on a connected phone or an emulator. Signing keys (`*.jks`, `*.keystore`) are git-ignored and must never be committed.

## Development

Requires Node.js 20 or newer.

```bash
npm install
npm run dev      # start the development server on http://localhost:3000
npm test         # run the cycle logic tests
npm run lint     # lint
npm run build    # static export to out/ plus the service worker
```

Pushing to `main` builds the app and publishes it to GitHub Pages (see `.github/workflows/deploy_pages.yml`).

### How it is built

- Next.js (App Router, static export), React, TypeScript, Tailwind CSS
- Data is stored in the browser's `localStorage`; the native project uses SQLite with SQLCipher
- All cycle calculations live in `src/lib/cycle-logic.ts` and are covered by `src/lib/cycle-logic.test.ts`
- `Claude.md` is the detailed specification: cycle logic, colours, screens and data format

### Rules for contributors

- No network requests, analytics or third-party services that need the internet
- No accounts or logins
- All data stays on the device
