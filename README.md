# Habit Tracker

A small, phone-first habit tracker that runs entirely in your browser. No account, no server —
your data lives in the browser's local storage on your device.

- Define your own habits, each with a goal: every day, or _N_ times per week / month / year
- Or set a limit for things to cut back on: at most _N_ times per week / month / year, or never
- Tap to check off today, or step back to fill in earlier days
- Month calendar: see every habit at a glance, or pick one habit and tap days to fill in history
- Streaks, progress toward the current period's goal, a calendar history, and per-period charts
- Installable to your home screen and works offline (PWA)
- Export / import a JSON backup

## Development

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

To try it on your phone during development, run `npm run dev -- --host` and open the printed
network URL (same Wi-Fi).

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Every push to `main` runs `.github/workflows/deploy.yml`, which tests, builds with
   `BASE_PATH=/<repo-name>/`, and publishes `dist/`.

The app will be at `https://<user>.github.io/<repo-name>/`. On your phone, open it and use
**Share → Add to Home Screen** (iOS) or **Install app** (Android) for a full-screen, offline app.

If you serve it from a custom domain or a `<user>.github.io` repo (site root), drop the
`BASE_PATH` env from the workflow.

## Your data

- Stored in `localStorage` under `habit-tracker:v1`, on this device and browser only.
  Different browsers (or the home-screen app vs. the browser on iOS) keep separate copies.
- Browsers can clear site storage, especially for sites that aren't installed or haven't been
  opened in a while. Export a backup from **Settings** now and then.
- Backups are plain JSON and can be imported on any device.

## Project layout

```
src/
  main.ts            app shell, tabs, theme, service worker
  router.ts          hash router (#/, #/day/:date, #/calendar, #/habits, #/stats/:id, #/settings)
  store.ts           persisted state + mutations
  lib/dates.ts       local-date keys and week/month/year period maths
  lib/stats.ts       progress, streaks, completion rates
  lib/backup.ts      validation, export/import
  charts/            SVG bar chart and calendar heatmap
  views/             Today, Calendar, Habits (list + form), Stats, Settings
  ui/                DOM helpers, palette, tooltip, toast, icons
```

Icons are generated from `public/favicon.svg` with `npm run icons`.
