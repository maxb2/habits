import type { View } from '../router';
import { navigate } from '../router';
import { store } from '../state';
import type { DateKey, Habit } from '../types';
import { addDays, diffDays, formatLongDay, isValidKey, periodTitle, todayKey } from '../lib/dates';
import { currentStreak, periodProgress, streakUnit } from '../lib/stats';
import { h, svgIcon } from '../ui/dom';
import { ICONS } from '../ui/icons';
import { hueStyle } from '../ui/palette';

function dayTitle(day: DateKey, today: DateKey): string {
  const d = diffDays(day, today);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  return formatLongDay(day).split(',')[0]!; // weekday name
}

/** Text + "met" flag describing progress toward the habit's goal for the period containing `day`. */
function progressText(habit: Habit, day: DateKey, today: DateKey) {
  const { weekStart } = store.data.settings;
  const p = periodProgress(habit, store.checkins(habit.id), day, weekStart);
  const { period } = habit.goal;
  if (period === 'day') return null;
  const when =
    p.current && day === today
      ? `this ${period}`
      : period === 'week'
        ? `wk of ${periodTitle('week', p.start, weekStart).split(' – ')[0]}`
        : periodTitle(period, p.start, weekStart);
  return { text: `${p.count}/${p.target} ${when}`, met: p.met };
}

export const todayView: View = (root, [param]) => {
  const today = todayKey();
  let day = param && isValidKey(param) && param <= today ? param : today;
  if (param && day !== param) navigate('/', { replace: true });

  const goDay = (d: DateKey) => navigate(d === today ? '/' : `/day/${d}`, { replace: true });

  const prev = h(
    'button',
    { class: 'icon-btn filled', 'aria-label': 'Previous day', onClick: () => goDay(addDays(day, -1)) },
    svgIcon(ICONS.chevronLeft),
  );
  const next = h(
    'button',
    {
      class: 'icon-btn filled',
      'aria-label': 'Next day',
      disabled: day >= today,
      onClick: () => goDay(addDays(day, 1)),
    },
    svgIcon(ICONS.chevronRight),
  );

  const header = h(
    'header',
    { class: 'page-head' },
    h(
      'h1',
      null,
      dayTitle(day, today),
      h('span', { class: 'sub' }, formatLongDay(day)),
    ),
    h('div', { class: 'day-nav' }, prev, next),
  );

  const summaryText = h('span');
  const summaryBar = h('span');
  const summary = h('div', { class: 'summary' }, summaryText, h('div', { class: 'meter' }, summaryBar));
  const list = h('div', { class: 'habit-list' });
  const backToday =
    day !== today
      ? h(
          'p',
          { style: 'text-align:center;margin-top:20px' },
          h('a', { class: 'btn', href: '#/' }, 'Back to today'),
        )
      : null;

  root.append(header, summary, list);
  if (backToday) root.append(backToday);

  const cards = new Map<string, { el: HTMLButtonElement; meta: HTMLElement }>();

  function cardFor(habit: Habit) {
    const meta = h('div', { class: 'meta' });
    const el = h(
      'button',
      {
        class: 'check-card',
        role: 'checkbox',
        style: hueStyle(habit.color),
        onClick: () => {
          const done = store.toggleCheckin(habit.id, day);
          if (done) navigator.vibrate?.(10);
        },
      },
      h('span', { class: 'avatar', 'aria-hidden': 'true' }, habit.emoji || h('span', { class: 'dot' })),
      h('span', { class: 'body' }, h('div', { class: 'name' }, habit.name), meta),
      h('span', { class: 'checkbox', 'aria-hidden': 'true' }, svgIcon(ICONS.check)),
    );
    return { el, meta };
  }

  function update(habit: Habit, card: { el: HTMLButtonElement; meta: HTMLElement }) {
    const done = !!store.checkins(habit.id)[day];
    card.el.setAttribute('aria-checked', String(done));
    const parts: (HTMLElement | string)[] = [];
    const prog = progressText(habit, day, today);
    if (prog) parts.push(h('span', { class: prog.met ? 'met' : '' }, prog.text + (prog.met ? ' ✓' : '')));
    else parts.push(h('span', null, 'Daily'));
    if (day === today) {
      const streak = currentStreak(habit, store.checkins(habit.id), today, store.data.settings.weekStart);
      if (streak > 0) {
        parts.push(
          h(
            'span',
            { class: 'streak', title: 'Current streak' },
            svgIcon(ICONS.flame),
            streakUnit(habit.goal.period, streak),
          ),
        );
      }
    }
    card.meta.replaceChildren(...parts);
  }

  let signature: string | null = null;
  function render() {
    const habits = store.activeHabits();
    const sig = habits.map((x) => `${x.id}|${x.name}|${x.emoji}|${x.color}`).join(',');
    if (sig !== signature) {
      signature = sig;
      cards.clear();
      list.replaceChildren();
      if (!habits.length) {
        summary.hidden = true;
        list.append(
          h(
            'div',
            { class: 'empty' },
            h('div', { class: 'big' }, '🌱'),
            h('p', null, 'No habits yet. Add the activities you want to do regularly.'),
            h('a', { class: 'btn primary', href: '#/habits/new' }, svgIcon(ICONS.plus), 'Add a habit'),
          ),
        );
        return;
      }
      summary.hidden = false;
      for (const habit of habits) {
        const card = cardFor(habit);
        cards.set(habit.id, card);
        list.append(card.el);
      }
    }
    let done = 0;
    for (const habit of habits) {
      update(habit, cards.get(habit.id)!);
      if (store.checkins(habit.id)[day]) done++;
    }
    summaryText.textContent = `${done} of ${habits.length} done`;
    summaryBar.style.width = `${(done / habits.length) * 100}%`;
  }

  render();
  return store.subscribe(render);
};
