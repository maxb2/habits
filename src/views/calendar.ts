import type { View } from '../router';
import { navigate } from '../router';
import { store } from '../state';
import type { DateKey, Habit } from '../types';
import {
  addDays,
  addMonths,
  diffDays,
  formatLongDay,
  formatMonthYear,
  fromKey,
  goalText,
  isValidKey,
  periodEnd,
  periodStart,
  todayKey,
} from '../lib/dates';
import { countInRange } from '../lib/stats';
import { h, svgIcon } from '../ui/dom';
import type { Child } from '../ui/dom';
import { ICONS } from '../ui/icons';
import { hueStyle } from '../ui/palette';

/** Selected filter: 'all' or a habit id. Kept for the session so switching tabs doesn't reset it. */
let filter = 'all';

const MAX_DOTS = 6;

export const calendarView: View = (root, [param]) => {
  const today = todayKey();
  const thisMonth = `${today.slice(0, 7)}-01`;
  let month = param && isValidKey(`${param}-01`) ? `${param}-01` : thisMonth;
  if (month > thisMonth) month = thisMonth;

  const goMonth = (m: DateKey) =>
    navigate(m >= thisMonth ? '/calendar' : `/calendar/${m.slice(0, 7)}`, { replace: true });

  root.append(
    h(
      'header',
      { class: 'page-head' },
      h('h1', null, formatMonthYear(month)),
      h(
        'div',
        { class: 'day-nav' },
        h(
          'button',
          { class: 'icon-btn filled', 'aria-label': 'Previous month', onClick: () => goMonth(addMonths(month, -1)) },
          svgIcon(ICONS.chevronLeft),
        ),
        h(
          'button',
          {
            class: 'icon-btn filled',
            'aria-label': 'Next month',
            disabled: month >= thisMonth,
            onClick: () => goMonth(addMonths(month, 1)),
          },
          svgIcon(ICONS.chevronRight),
        ),
      ),
    ),
  );

  const habits = store.activeHabits();
  if (!habits.length) {
    root.append(
      h(
        'div',
        { class: 'empty' },
        h('div', { class: 'big' }, '🗓️'),
        h('p', null, 'Add a habit to see it on the calendar.'),
        h('a', { class: 'btn primary', href: '#/habits/new' }, svgIcon(ICONS.plus), 'Add a habit'),
      ),
    );
    return;
  }
  if (filter !== 'all' && !habits.some((x) => x.id === filter)) filter = 'all';

  // --- filter chips (rendered once so their scroll position survives updates)
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Show' });
  const chipEls: HTMLButtonElement[] = [];
  const addChip = (id: string, label: Child, style?: string) => {
    const el = h(
      'button',
      {
        type: 'button',
        class: 'chip',
        style,
        'aria-pressed': String(filter === id),
        onClick: () => {
          filter = id;
          for (const c of chipEls) c.setAttribute('aria-pressed', String(c === el));
          render();
        },
      },
      label,
    );
    chipEls.push(el);
    chips.append(el);
  };
  addChip('all', 'All habits');
  for (const x of habits) {
    addChip(
      x.id,
      [x.emoji ? h('span', { 'aria-hidden': 'true' }, x.emoji) : h('span', { class: 'dot', 'aria-hidden': 'true' }), x.name],
      hueStyle(x.color),
    );
  }

  const gridCard = h('div', { class: 'card cal' });
  const summary = h('div');
  root.append(chips, gridCard, summary);
  // Keep the selected chip visible (e.g. after changing month re-renders the view).
  requestAnimationFrame(() => {
    const sel = chipEls.find((c) => c.getAttribute('aria-pressed') === 'true');
    if (sel && sel.offsetLeft + sel.offsetWidth > chips.clientWidth) {
      chips.scrollLeft = sel.offsetLeft - (chips.clientWidth - sel.offsetWidth) / 2;
    }
  });

  // --- swipe left/right to change month
  let startX = 0;
  let startY = 0;
  let swiped = false;
  gridCard.addEventListener('pointerdown', (e) => {
    startX = e.clientX;
    startY = e.clientY;
    swiped = false;
  });
  gridCard.addEventListener('pointerup', (e) => {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) {
      swiped = true;
      if (dx < 0 && month < thisMonth) goMonth(addMonths(month, 1));
      else if (dx > 0) goMonth(addMonths(month, -1));
    }
  });
  // A swipe ending on a day shouldn't also count as a tap on it.
  gridCard.addEventListener(
    'click',
    (e) => {
      if (swiped) {
        e.stopPropagation();
        e.preventDefault();
        swiped = false;
      }
    },
    true,
  );

  function render() {
    const { weekStart } = store.data.settings;
    const active = store.activeHabits();
    const single: Habit | undefined = filter === 'all' ? undefined : store.habit(filter);
    const showWeeks = single?.goal.period === 'week';
    const monthEnd = periodEnd('month', month, weekStart);
    const gridStart = periodStart('week', month, weekStart);
    const gridEnd = periodEnd('week', monthEnd, weekStart);

    const grid = h('div', { class: `cal-grid${showWeeks ? ' with-weeks' : ''}`, style: single ? hueStyle(single.color) : undefined });

    // Weekday header
    const wdFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
    for (let i = 0; i < 7; i++) {
      grid.append(h('div', { class: 'cal-wd', 'aria-hidden': 'true' }, wdFmt.format(fromKey(addDays(gridStart, i)))));
    }
    if (showWeeks) grid.append(h('div', { class: 'cal-wd', 'aria-hidden': 'true' }, 'Wk'));

    for (let ws = gridStart; ws <= gridEnd; ws = addDays(ws, 7)) {
      for (let i = 0; i < 7; i++) {
        const key = addDays(ws, i);
        if (key.slice(0, 7) !== month.slice(0, 7)) {
          grid.append(h('div', { class: 'cal-blank' }));
          continue;
        }
        grid.append(single ? singleDay(single, key, today) : allDay(active, key, today));
      }
      if (showWeeks && single) {
        if (ws > today) {
          grid.append(h('div', { class: 'cal-week' }));
        } else {
          const we = addDays(ws, 6);
          const n = countInRange(store.checkins(single.id), ws, we < today ? we : today);
          const met = n >= single.goal.count;
          grid.append(
            h(
              'div',
              { class: `cal-week${met ? ' met' : ''}`, title: `Week of ${formatLongDay(ws)}` },
              `${n}/${single.goal.count}`,
            ),
          );
        }
      }
    }
    gridCard.replaceChildren(grid);

    // --- month summary (also serves as the legend for the dots)
    const last = monthEnd < today ? monthEnd : today;
    const elapsed = diffDays(month, last) + 1;
    const monthName = formatMonthYear(month).split(' ')[0];
    if (single) {
      const c = store.checkins(single.id);
      const n = countInRange(c, month, last);
      const lines: Node[] = [
        h('div', { class: 'sum-row' }, h('span', null, `Days done in ${monthName}`), h('strong', null, `${n} / ${elapsed}`)),
      ];
      if (single.goal.period === 'month') {
        const met = n >= single.goal.count;
        lines.push(
          h(
            'div',
            { class: 'sum-row' },
            h('span', null, 'Monthly goal'),
            h('strong', { class: met ? 'met' : '' }, `${n} / ${single.goal.count}${met ? ' ✓' : ''}`),
          ),
        );
      }
      if (single.goal.period === 'year') {
        const ys = `${month.slice(0, 4)}-01-01`;
        const ye = `${month.slice(0, 4)}-12-31`;
        const yn = countInRange(c, ys, ye < today ? ye : today);
        const met = yn >= single.goal.count;
        lines.push(
          h(
            'div',
            { class: 'sum-row' },
            h('span', null, `${month.slice(0, 4)} so far`),
            h('strong', { class: met ? 'met' : '' }, `${yn} / ${single.goal.count}${met ? ' ✓' : ''}`),
          ),
        );
      }
      summary.replaceChildren(
        h(
          'div',
          { class: 'card' },
          h('h2', null, single.name, ' ', h('span', { class: 'muted' }, goalText(single.goal.count, single.goal.period))),
          lines,
          h('p', { class: 'small muted', style: 'margin:12px 0 0' }, 'Tap a day to mark it done or not done.'),
          h(
            'a',
            { class: 'btn block', style: 'margin-top:12px', href: `#/stats/${encodeURIComponent(single.id)}` },
            'View stats',
          ),
        ),
      );
    } else {
      summary.replaceChildren(
        h(
          'div',
          { class: 'card' },
          h('h2', null, `${monthName} `, h('span', { class: 'muted' }, 'days done')),
          active.map((x) =>
            h(
              'div',
              { class: 'sum-row', style: hueStyle(x.color) },
              h('span', { class: 'sum-name' }, h('i', { class: 'dot', 'aria-hidden': 'true' }), x.emoji ? `${x.emoji} ${x.name}` : x.name),
              h('strong', null, String(countInRange(store.checkins(x.id), month, last))),
            ),
          ),
          h('p', { class: 'small muted', style: 'margin:12px 0 0' }, 'Tap a day to open it and check things off.'),
        ),
      );
    }
  }

  function dayLabel(key: DateKey, today: DateKey) {
    return h(
      'span',
      { class: 'num' },
      String(Number(key.slice(8))),
      key === today ? h('span', { class: 'sr-only' }, ' (today)') : null,
    );
  }

  function allDay(active: Habit[], key: DateKey, today: DateKey) {
    const done = active.filter((x) => store.checkins(x.id)[key]);
    const shown = done.length > MAX_DOTS ? done.slice(0, MAX_DOTS - 1) : done;
    const future = key > today;
    return h(
      'button',
      {
        type: 'button',
        class: `cal-day${key === today ? ' today' : ''}`,
        disabled: future,
        'aria-label': `${formatLongDay(key)}: ${done.length ? done.map((x) => x.name).join(', ') : 'nothing done'}`,
        onClick: () => navigate(key === today ? '/' : `/day/${key}`),
      },
      dayLabel(key, today),
      h(
        'span',
        { class: 'dots', 'aria-hidden': 'true' },
        shown.map((x) => h('i', { style: hueStyle(x.color) })),
        done.length > shown.length ? h('span', { class: 'more' }, `+${done.length - shown.length}`) : null,
      ),
    );
  }

  function singleDay(habit: Habit, key: DateKey, today: DateKey) {
    const done = !!store.checkins(habit.id)[key];
    const future = key > today;
    return h(
      'button',
      {
        type: 'button',
        class: `cal-day single${done ? ' done' : future ? '' : ' track'}${key === today ? ' today' : ''}`,
        disabled: future,
        'aria-pressed': String(done),
        'aria-label': `${formatLongDay(key)}: ${habit.name}`,
        onClick: () => {
          if (store.toggleCheckin(habit.id, key)) navigator.vibrate?.(10);
        },
      },
      dayLabel(key, today),
    );
  }

  render();
  return store.subscribe(render);
};
