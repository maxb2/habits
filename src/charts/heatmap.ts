import type { DateKey, HabitCheckins, WeekStart } from '../types';
import { addDays, diffDays, formatLongDay, formatMonth, fromKey, periodStart } from '../lib/dates';
import { h, s } from '../ui/dom';

export interface HeatmapOptions {
  checkins: HabitCheckins;
  /** First day the habit existed; earlier days are drawn empty. */
  start: DateKey;
  today: DateKey;
  weekStart: WeekStart;
  /** Visible width; the map is at least this many weeks wide so it fills the card. */
  width: number;
  ariaLabel: string;
}

const CELL = 13;
const GAP = 3;
const STEP = CELL + GAP;
const LEFT = 30;
const TOP = 18;
const MAX_WEEKS = 156;

/**
 * Calendar grid: one column per week, one row per weekday; done days are filled.
 * Weekday labels sit in a fixed column; the grid scrolls horizontally when history is long.
 */
export function heatmap(o: HeatmapOptions): { el: HTMLElement; scroller: HTMLElement } {
  const lastCol = periodStart('week', o.today, o.weekStart);
  const fitWeeks = Math.max(1, Math.floor((o.width - LEFT + GAP) / STEP));
  const historyWeeks = Math.floor(diffDays(periodStart('week', o.start, o.weekStart), lastCol) / 7) + 1;
  const weeks = Math.min(MAX_WEEKS, Math.max(fitWeeks, historyWeeks));
  const firstCol = addDays(lastCol, -(weeks - 1) * 7);
  const height = TOP + 7 * STEP - GAP;

  // Weekday labels (Mon / Wed / Fri)
  const labels = s('svg', { class: 'chart', width: LEFT, height, 'aria-hidden': 'true' });
  const wdFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
  for (let row = 0; row < 7; row++) {
    const d = fromKey(addDays(firstCol, row));
    const wd = d.getDay();
    if (wd === 1 || wd === 3 || wd === 5) {
      labels.append(s('text', { x: 0, y: TOP + row * STEP + CELL - 2 }, wdFmt.format(d)));
    }
  }

  const width = weeks * STEP - GAP;
  const grid = s('svg', {
    class: 'chart heatmap',
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': o.ariaLabel,
  });

  let lastLabelCol = -10;
  let prevMonth = '';
  for (let col = 0; col < weeks; col++) {
    const colStart = addDays(firstCol, col * 7);
    const x = col * STEP;

    // Month label on the first column, and wherever a new month starts (if there's room).
    const month = addDays(colStart, 6).slice(0, 7);
    if (month !== prevMonth) {
      if (col - lastLabelCol >= 3 && col <= weeks - 2) {
        grid.append(s('text', { x, y: 11 }, formatMonth(`${month}-01`)));
        lastLabelCol = col;
      }
      prevMonth = month;
    }

    for (let row = 0; row < 7; row++) {
      const key = addDays(colStart, row);
      if (key > o.today) continue;
      const done = !!o.checkins[key];
      const out = !done && key < o.start;
      const y = TOP + row * STEP;
      grid.append(
        s('rect', {
          class: `cell${done ? ' done' : out ? ' out' : ''}`,
          x,
          y,
          width: CELL,
          height: CELL,
          rx: 2,
          'data-tip': out ? undefined : `${formatLongDay(key)} — ${done ? 'done' : 'not done'}`,
        }),
      );
      if (key === o.today) {
        grid.append(s('rect', { class: 'today', x: x - 1.5, y: y - 1.5, width: CELL + 3, height: CELL + 3, rx: 3.5 }));
      }
    }
  }

  const scroller = h('div', { class: 'heatmap-scroll' }, grid);
  return { el: h('div', { class: 'heatmap-wrap' }, labels, scroller), scroller };
}
