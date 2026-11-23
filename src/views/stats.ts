import type { View } from '../router';
import { store } from '../state';
import type { DateKey, Habit, HabitCheckins, Period, WeekStart } from '../types';
import type { PeriodResult } from '../lib/stats';
import {
  addDays,
  diffDays,
  formatShortDay,
  fromKey,
  goalText,
  isLimit,
  periodLabel,
  periodTitle,
  todayKey,
} from '../lib/dates';
import {
  allPeriods,
  bestStreak,
  completion,
  countInRange,
  currentStreak,
  habitStart,
  periodProgress,
  recentPeriods,
  totalCheckins,
} from '../lib/stats';
import { barChart } from '../charts/bars';
import { heatmap } from '../charts/heatmap';
import { h, svgIcon } from '../ui/dom';
import { ICONS } from '../ui/icons';
import { hueStyle } from '../ui/palette';
import { attachTooltips, hideTooltip } from '../ui/tooltip';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const pct = (r: number | null) => (r === null ? '–' : `${Math.round(r * 100)}%`);

function avatar(habit: Habit) {
  return h('span', { class: 'avatar', 'aria-hidden': 'true' }, habit.emoji || h('span', { class: 'dot' }));
}

function tile(label: string, value: string | Node, note?: string) {
  return h(
    'div',
    { class: 'tile' },
    h('div', { class: 'label' }, label),
    h('div', { class: 'value' }, value),
    note ? h('div', { class: 'note' }, note) : null,
  );
}

function valueWithUnit(n: number, unit: string) {
  return h('span', null, String(n), ' ', h('small', null, unit));
}

/** "2 / 3 ✓", or "2 / 3 max" for a limit. */
function progressValue(p: PeriodResult): string {
  if (p.limit) return `${p.count} / ${p.target} max`;
  return `${p.count} / ${p.target}${p.met ? ' ✓' : ''}`;
}

/** Progress meter; for a limit it shows how much of the allowance is used, turning red when over. */
function meter(p: PeriodResult) {
  const share = p.target ? p.count / p.target : p.count ? 1 : 0;
  return h('div', { class: `meter${p.over ? ' over' : ''}` }, h('span', { style: `width:${Math.min(100, share * 100)}%` }));
}

/** Last `n` periods as a strip of small cells (met / partial / missed / before start). */
function strip(habit: Habit, checkins: HabitCheckins, today: DateKey, weekStart: WeekStart, n: number) {
  const periods = recentPeriods(habit, checkins, today, weekStart, n);
  return h(
    'div',
    { class: 'strip', 'aria-hidden': 'true' },
    periods.map((p) =>
      h('span', {
        // A limit still within bounds shows as partial until its period is over.
        class: p.beforeStart
          ? 'pre'
          : p.decided && p.met
            ? 'met'
            : p.limit
              ? p.decided ? '' : 'partial'
              : p.count > 0 ? 'partial' : '',
      }),
    ),
  );
}

export const statsView: View = (root) => {
  const today = todayKey();
  const { weekStart } = store.data.settings;
  const habits = store.activeHabits();

  root.append(h('header', { class: 'page-head' }, h('h1', null, 'Stats')));

  if (!habits.length) {
    root.append(
      h(
        'div',
        { class: 'empty' },
        h('div', { class: 'big' }, '📊'),
        h('p', null, 'Stats appear once you have habits to track.'),
        h('a', { class: 'btn primary', href: '#/habits/new' }, svgIcon(ICONS.plus), 'Add a habit'),
      ),
    );
    return;
  }

  // Summary tiles. "Done" counts habits to build; checking off a limited habit isn't progress.
  const builds = habits.filter((x) => !isLimit(x.goal));
  const doneToday = builds.filter((x) => store.checkins(x.id)[today]).length;
  const last7 = builds.reduce((sum, x) => sum + countInRange(store.checkins(x.id), addDays(today, -6), today), 0);
  const metNow = habits.filter((x) => periodProgress(x, store.checkins(x.id), today, weekStart).met).length;
  root.append(
    h(
      'div',
      { class: 'tiles' },
      tile('Today', valueWithUnit(doneToday, `/ ${builds.length}`), 'habits done'),
      tile('Last 7 days', String(last7), plural(last7, 'check-in').replace(/^\d+ /, '')),
      tile('On track', valueWithUnit(metNow, `/ ${habits.length}`), 'this period'),
    ),
  );

  for (const habit of habits) {
    const c = store.checkins(habit.id);
    const p = periodProgress(habit, c, today, weekStart);
    const streak = currentStreak(habit, c, today, weekStart);
    const best = bestStreak(habit, c, today, weekStart);
    const recent = completion(habit, c, today, weekStart, 12);
    const { period } = habit.goal;
    const stripN = period === 'day' ? 14 : period === 'year' ? 5 : 12;
    root.append(
      h(
        'a',
        { class: 'card stat-card', href: `#/stats/${encodeURIComponent(habit.id)}`, style: hueStyle(habit.color) },
        h(
          'div',
          { class: 'head' },
          avatar(habit),
          h(
            'span',
            { class: 'text' },
            h('div', { class: 'name' }, habit.name),
            h('div', { class: 'goal' }, goalText(habit.goal)),
          ),
          svgIcon(ICONS.chevronRight),
        ),
        period === 'day'
          ? null
          : [
              h(
                'div',
                { class: 'progress-line' },
                h('span', null, `This ${period}`),
                h('span', { class: p.over ? 'over' : '' }, progressValue(p)),
              ),
              meter(p),
            ],
        strip(habit, c, today, weekStart, stripN),
        h(
          'div',
          { class: 'mini-stats' },
          h('div', null, h('div', { class: 'v' }, String(streak)), h('div', { class: 'l' }, `${period} streak`)),
          h('div', null, h('div', { class: 'v' }, String(best)), h('div', { class: 'l' }, 'best streak')),
          h('div', null, h('div', { class: 'v' }, pct(recent.rate)), h('div', { class: 'l' }, `last ${recent.total || 12} ${period}s`)),
        ),
      ),
    );
  }

  const archived = store.archivedHabits();
  if (archived.length) {
    root.append(
      h('div', { class: 'section-title' }, 'Archived'),
      h(
        'div',
        { class: 'row-list' },
        archived.map((x) =>
          h(
            'div',
            { class: 'row' },
            h(
              'a',
              { class: 'row-main', href: `#/stats/${encodeURIComponent(x.id)}`, style: hueStyle(x.color) },
              avatar(x),
              h('span', { class: 'text' }, h('div', { class: 'name' }, x.name), h('div', { class: 'goal' }, goalText(x.goal))),
            ),
          ),
        ),
      ),
    );
  }
};

/** Bar-chart grain: daily habits are summarised per week (goal 7, or limit 0), others per goal period. */
function chartSpec(habit: Habit): { habit: Habit; period: Period } {
  if (habit.goal.period === 'day') {
    return { habit: { ...habit, goal: { ...habit.goal, count: habit.goal.count * 7, period: 'week' } }, period: 'week' };
  }
  return { habit, period: habit.goal.period };
}

export const habitStatsView: View = (root, [id], { width }) => {
  const habit = id ? store.habit(id) : undefined;
  root.append(h('a', { class: 'back', href: '#/stats' }, svgIcon(ICONS.chevronLeft), 'Stats'));
  if (!habit) {
    root.append(h('div', { class: 'empty' }, h('p', null, 'That habit no longer exists.')));
    return;
  }
  const today = todayKey();
  const { weekStart } = store.data.settings;
  const c = store.checkins(habit.id);
  const start = habitStart(habit, c);
  const { period } = habit.goal;
  const cardInner = width - 34; // card padding + border

  const wrap = h('div', { style: hueStyle(habit.color) });
  root.append(wrap);
  attachTooltips(wrap);

  wrap.append(
    h(
      'header',
      { class: 'page-head' },
      avatar(habit),
      h('h1', null, habit.name, h('span', { class: 'sub' }, goalText(habit.goal) + (habit.archived ? ' · archived' : ''))),
      h('a', { class: 'btn', href: `#/habits/${encodeURIComponent(habit.id)}` }, 'Edit'),
    ),
  );

  // Tiles
  const streak = currentStreak(habit, c, today, weekStart);
  const best = bestStreak(habit, c, today, weekStart);
  const all = completion(habit, c, today, weekStart);
  const total = totalCheckins(c);
  wrap.append(
    h(
      'div',
      { class: 'tiles', style: 'grid-template-columns: repeat(2, 1fr)' },
      tile('Current streak', valueWithUnit(streak, plural(streak, period).replace(/^\d+ /, ''))),
      tile('Best streak', valueWithUnit(best, plural(best, period).replace(/^\d+ /, ''))),
      tile('Goal met', pct(all.rate), all.total ? `${all.met} of ${plural(all.total, period)}` : 'no full periods yet'),
      tile('Check-ins', String(total), `since ${formatShortDay(start)}${start.slice(0, 4) !== today.slice(0, 4) ? ` ${start.slice(0, 4)}` : ''}`),
    ),
  );

  // Current period meter
  if (period !== 'day') {
    const p = periodProgress(habit, c, today, weekStart);
    const daysLeft = diffDays(today, p.end);
    const left = plural(daysLeft + 1, 'day');
    const status = p.limit
      ? p.over
        ? `Over the limit by ${p.count - p.target}`
        : `${p.target - p.count} more allowed · ${left} left`
      : p.met
        ? 'Goal met ✓'
        : `${p.target - p.count} more to go · ${left} left`;
    wrap.append(
      h(
        'div',
        { class: 'card' },
        h('h2', null, `This ${period} `, h('span', { class: 'muted' }, periodTitle(period, p.start, weekStart))),
        h('div', { class: 'progress-line' }, h('span', { class: p.over ? 'over' : '' }, status), h('span', null, progressValue(p))),
        meter(p),
      ),
    );
  }

  // Heatmap
  const map = heatmap({
    checkins: c,
    start,
    today,
    weekStart,
    width: cardInner,
    ariaLabel: `Calendar of days ${habit.name} was done`,
  });
  const { scroller } = map;
  scroller.addEventListener('scroll', hideTooltip, { passive: true });
  wrap.append(
    h(
      'div',
      { class: 'card' },
      h('h2', null, 'History'),
      map.el,
      h('div', { class: 'key' }, h('span', null, h('i', { class: 'done' }), 'Done'), h('span', null, h('i'), 'Not done')),
    ),
  );
  requestAnimationFrame(() => (scroller.scrollLeft = scroller.scrollWidth));

  // Per-period bar chart
  const spec = chartSpec(habit);
  const yearsSince = Number(today.slice(0, 4)) - Number(start.slice(0, 4)) + 1;
  // Show history since the habit started, within sensible bounds.
  const sinceStart = allPeriods(spec.habit, c, today, weekStart).length;
  const n = spec.period === 'year' ? Math.min(10, Math.max(3, yearsSince)) : Math.min(12, Math.max(6, sinceStart));
  const periods = recentPeriods(spec.habit, c, today, weekStart, n);
  const target = spec.habit.goal.count;
  const limit = isLimit(habit.goal);
  const goalWord = limit ? 'Limit' : 'Goal';
  const bars = periods.map((p) => ({
    label: spec.period === 'week' ? formatShortDay(p.start).replace(/\s+/, ' ') : periodLabel(spec.period, p.start),
    value: p.count,
    muted: !p.met,
    skip: p.beforeStart,
    tip: `${periodTitle(spec.period, p.start, weekStart)}: ${p.count} ${limit ? 'of max' : 'of'} ${target}${
      !p.decided ? ' (so far)' : p.met ? ' ✓' : limit ? ' · over' : ''
    }`,
  }));
  wrap.append(
    h(
      'div',
      { class: 'card' },
      h('h2', null, `Days per ${spec.period}`),
      barChart({
        bars,
        width: cardInner,
        goal: target,
        ariaLabel: `Days done per ${spec.period} for the last ${n} ${spec.period}s, ${goalWord.toLowerCase()} ${target}`,
      }),
      h(
        'div',
        { class: 'key' },
        h('span', null, h('i', { class: 'done' }), limit ? 'Within limit' : 'Goal met'),
        h('span', null, h('i', { class: 'unmet' }), limit ? 'Over limit' : 'Not met'),
        // A limit of 0 sits on the baseline, so the chart draws no line for it.
        target ? h('span', null, h('i', { class: 'line' }), `${goalWord} (${target})`) : null,
      ),
      h(
        'details',
        { class: 'table-view' },
        h('summary', null, 'Show as table'),
        h(
          'table',
          { class: 'data-table' },
          h('thead', null, h('tr', null, h('th', null, spec.period[0]!.toUpperCase() + spec.period.slice(1)), h('th', { class: 'num' }, 'Days'), h('th', { class: 'num' }, goalWord))),
          h(
            'tbody',
            null,
            [...periods]
              .reverse()
              .filter((p) => !p.beforeStart)
              .map((p) =>
                h(
                  'tr',
                  null,
                  h('td', null, periodTitle(spec.period, p.start, weekStart)),
                  h('td', { class: 'num' }, String(p.count)),
                  h('td', { class: 'num' }, !p.decided ? '…' : p.met ? '✓' : '✗'),
                ),
              ),
          ),
        ),
      ),
    ),
  );

  // Weekday distribution
  if (total > 0) {
    const counts = Array.from({ length: 7 }, () => 0);
    for (const k of Object.keys(c)) counts[fromKey(k).getDay()]!++;
    const wdFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
    const longFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long' });
    // Any week works for naming days; 2026-11-22 is a Sunday.
    const order = Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7);
    const wdBars = order.map((wd) => {
      const d = fromKey(addDays('2026-11-22', wd));
      return { label: wdFmt.format(d), value: counts[wd]!, tip: `${longFmt.format(d)}s: ${plural(counts[wd]!, 'check-in')}` };
    });
    const maxI = wdBars.reduce((m, b, i, arr) => (b.value > arr[m]!.value ? i : m), 0);
    wrap.append(
      h(
        'div',
        { class: 'card' },
        h('h2', null, 'By weekday ', h('span', { class: 'muted' }, 'all time')),
        barChart({
          bars: wdBars,
          width: cardInner,
          height: 150,
          labelIndex: maxI,
          ariaLabel: `Check-ins by weekday: ${wdBars.map((b) => `${b.label} ${b.value}`).join(', ')}`,
        }),
      ),
    );
  }

  return hideTooltip;
};
