# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Phone-first habit tracker PWA. Vite + TypeScript, **no framework**, fully client-side, deployed to GitHub Pages. All data lives in the browser's `localStorage`.

## Commands

```sh
npm run dev                          # dev server (add `-- --host` to test on a phone over LAN)
npm test                             # all unit tests (vitest run)
npx vitest run src/lib/stats.test.ts # one test file
npx vitest run -t "streak"           # tests whose name matches
npm run typecheck                    # tsc --noEmit
npm run build                        # typecheck + vite build into dist/
BASE_PATH=/habits/ npm run build && npm run preview   # build as served on Pages
npm run icons                        # regenerate public/ PNG icons from public/favicon.svg
```

There is no linter. Tests cover pure logic only (`src/lib/*`, `src/store.ts`); the UI has no tests and runs in the Vitest `node` environment.

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main`: `npm ci` → `npm test` → build with `BASE_PATH=/<repo-name>/` → publish to GitHub Pages. The repo is `maxb2/habits`, served at https://manderscience.com/habits/ (custom domain on the user's `<user>.github.io` site). The asset paths in `vite.config.ts` and the manifest's `start_url`/`scope: '.'` depend on `BASE_PATH`, so keep URLs relative to the base and never hard-code `/`.

## Architecture

**Data flow.** `src/store.ts` (`createStore(storage, defaultWeekStart)`) owns the single `AppData` object (`src/types.ts`). Every mutation builds a new object, goes through `commit()` (which writes JSON to `localStorage` key `habit-tracker:v1`), and then notifies subscribers. `src/state.ts` exports the app-wide `store` instance. Views read from `store` and call its mutation methods directly. Nothing else touches `localStorage`, except Settings' `habit-tracker:last-export` timestamp.

**Persistence safety.** `AppData` has a `version` field. `src/lib/backup.ts#validateData` is the one gate for stored data and imports: it validates strictly, drops orphaned check-ins, fills in default settings, and rejects newer versions. If stored data is unreadable, it is copied to `habit-tracker:v1:corrupt-<ts>` rather than discarded. If you change the schema, bump `DATA_VERSION` and add migration in `validateData`.

**Routing.** `src/router.ts` is a hash router, so deep links work on Pages without a 404 fallback. Routes are registered in `src/main.ts` as `route(regex, tabName, view)`. A `View` is `(root, params, { width }) => cleanup?`. It renders into an empty `root`, and if it subscribes to the store it must return the unsubscribe as cleanup. The router tags each history entry with `{ idx }` so `goBack(fallback)` never leaves the app. Use `navigate(path, { replace: true })` for in-page stepping (day arrows, month arrows) so it doesn't fill up history. On width change the router re-renders the view and keeps scroll, and charts size themselves from `ctx.width`.

**Rendering.** Plain DOM through `h()`/`s()` in `src/ui/dom.ts` (HTML/SVG element builders with `onClick`-style event props). Most views rebuild their content on each store change. The Today view updates check-cards in place to keep tap feedback smooth.

**Dates (the main pitfall).** Days are local-date strings `YYYY-MM-DD` (`DateKey`) and never UTC. `fromKey` parses at local noon so DST can't shift the day. Use the helpers in `src/lib/dates.ts` (`addDays`, `diffDays`, `periodStart/End`, `addMonths`, …) and avoid ad-hoc `Date` arithmetic or `toISOString()`. Weeks start on Sunday (0) or Monday (1) according to `settings.weekStart`. `dates.test.ts` runs under `TZ=America/New_York` to exercise DST.

**Stats semantics** (`src/lib/stats.ts`). A habit has a goal of `count` check-ins per `day|week|month|year`, and a check-in is a boolean per day. A habit "starts" at the earlier of `createdAt` and its earliest check-in. A streak is the number of consecutive *goal periods* met. The current, in-progress period adds to the streak once met but never breaks it. Completion rates count the current period only once it is met.

**Styling & charts.** `src/styles.css` holds design tokens for light and dark (driven by `prefers-color-scheme` or `[data-theme]`). Habit colours are indices into an 8-hue palette (`src/ui/palette.ts`, `hueStyle()` sets `--c`/`--c-ink`), with separate dark-mode steps. Charts (`src/charts/`) are hand-built SVG with no chart library. They follow the dataviz skill's rules: thin rounded bars, a goal reference line, a tooltip on every mark (`data-tip` + `attachTooltips`), and a table view alongside. Load the `dataviz` skill before changing chart code.

**PWA.** `vite-plugin-pwa` (generateSW, `autoUpdate`) precaches everything for offline use. It is registered in `main.ts` with `registerSW({ immediate: true })`. Manifest `short_name` is "Habits". DuckDuckGo's Android "Add to Home" ignores the manifest and names the shortcut after the domain, and the app cannot change that.
