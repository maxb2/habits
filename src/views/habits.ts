import type { View } from '../router';
import { goBack, navigate } from '../router';
import { store } from '../state';
import { PERIODS } from '../types';
import type { Habit, Period } from '../types';
import { goalText, maxGoalCount } from '../lib/dates';
import { h, svgIcon } from '../ui/dom';
import { ICONS } from '../ui/icons';
import { HUES, hueStyle, nextHue } from '../ui/palette';
import { toast } from '../ui/toast';

function avatar(habit: Pick<Habit, 'emoji' | 'color'>) {
  return h(
    'span',
    { class: 'avatar', style: hueStyle(habit.color), 'aria-hidden': 'true' },
    habit.emoji || h('span', { class: 'dot' }),
  );
}

function habitRow(habit: Habit, index: number, total: number) {
  return h(
    'div',
    { class: 'row' },
    h(
      'a',
      { class: 'row-main', href: `#/habits/${encodeURIComponent(habit.id)}` },
      avatar(habit),
      h(
        'span',
        { class: 'text' },
        h('div', { class: 'name' }, habit.name),
        h('div', { class: 'goal' }, goalText(habit.goal.count, habit.goal.period)),
      ),
    ),
    h(
      'button',
      {
        class: 'icon-btn',
        'aria-label': `Move ${habit.name} up`,
        disabled: index === 0,
        onClick: () => store.moveHabit(habit.id, -1),
      },
      svgIcon(ICONS.chevronUp),
    ),
    h(
      'button',
      {
        class: 'icon-btn',
        'aria-label': `Move ${habit.name} down`,
        disabled: index === total - 1,
        onClick: () => store.moveHabit(habit.id, 1),
      },
      svgIcon(ICONS.chevronDown),
    ),
  );
}

export const habitsView: View = (root) => {
  const body = h('div');
  root.append(
    h(
      'header',
      { class: 'page-head' },
      h('h1', null, 'Habits'),
      h('a', { class: 'btn primary', href: '#/habits/new' }, svgIcon(ICONS.plus), 'New'),
    ),
    body,
  );

  let archivedOpen = false;
  function render() {
    const active = store.activeHabits();
    const archived = store.archivedHabits();
    body.replaceChildren();
    if (!active.length && !archived.length) {
      body.append(
        h(
          'div',
          { class: 'empty' },
          h('div', { class: 'big' }, '📝'),
          h('p', null, 'Create your first habit — anything you want to do daily, weekly, or monthly.'),
          h('a', { class: 'btn primary', href: '#/habits/new' }, svgIcon(ICONS.plus), 'Add a habit'),
        ),
      );
      return;
    }
    if (active.length) {
      body.append(h('div', { class: 'row-list' }, active.map((x, i) => habitRow(x, i, active.length))));
    } else {
      body.append(h('p', { class: 'empty' }, 'All habits are archived.'));
    }
    if (archived.length) {
      const details = h(
        'details',
        { class: 'archived', open: archivedOpen, onToggle: () => (archivedOpen = details.open) },
        h('summary', { class: 'section-title' }, `Archived (${archived.length})`),
        h('div', { class: 'row-list' }, archived.map((x, i) => habitRow(x, i, archived.length))),
      );
      body.append(details);
    }
  }
  render();
  return store.subscribe(render);
};

const EMOJIS = ['💧', '🏃', '📚', '🧘', '💪', '🥗', '😴', '✍️', '🎸', '🧹', '💊', '🚶', '🦷', '📵', '🌿', '🙏'];
const PERIOD_LABEL: Record<Period, string> = { day: 'Day', week: 'Week', month: 'Month', year: 'Year' };

export const habitFormView: View = (root, [id]) => {
  const existing = id ? store.habit(id) : undefined;
  if (id && !existing) {
    root.append(
      h('a', { class: 'back', href: '#/habits' }, svgIcon(ICONS.chevronLeft), 'Habits'),
      h('div', { class: 'empty' }, h('p', null, 'That habit no longer exists.')),
    );
    return;
  }

  const state = {
    name: existing?.name ?? '',
    emoji: existing?.emoji ?? '',
    color: existing?.color ?? nextHue(store.data.habits.map((x) => x.color)),
    count: existing?.goal.count ?? 1,
    period: existing?.goal.period ?? ('day' as Period),
  };

  // --- name
  const nameInput = h('input', {
    class: 'input',
    id: 'name',
    type: 'text',
    value: state.name,
    maxLength: 60,
    autocomplete: 'off',
    enterKeyHint: 'done',
    placeholder: 'e.g. Read 20 pages',
    onInput: () => {
      state.name = nameInput.value;
      nameError.hidden = true;
    },
  });
  const nameError = h('div', { class: 'error-text', hidden: true }, 'Give the habit a name.');

  // --- emoji
  const emojiInput = h('input', {
    class: 'input',
    id: 'emoji',
    type: 'text',
    value: state.emoji,
    'aria-label': 'Emoji',
    placeholder: '🙂',
    autocomplete: 'off',
    onInput: () => {
      // Keep only the first grapheme so the avatar stays tidy.
      const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      const first = [...seg.segment(emojiInput.value.trim())][0]?.segment ?? '';
      state.emoji = first;
      if (emojiInput.value !== first) emojiInput.value = first;
      renderEmojiPicks();
    },
  });
  const emojiPicks = h('div', { class: 'emoji-picks', role: 'group', 'aria-label': 'Suggestions' });
  function renderEmojiPicks() {
    emojiPicks.replaceChildren(
      ...EMOJIS.map((e) =>
        h(
          'button',
          {
            type: 'button',
            'aria-pressed': String(state.emoji === e),
            onClick: () => {
              state.emoji = state.emoji === e ? '' : e;
              emojiInput.value = state.emoji;
              renderEmojiPicks();
            },
          },
          e,
        ),
      ),
    );
  }
  renderEmojiPicks();

  // --- colour
  const swatches = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Colour' });
  function renderSwatches() {
    swatches.replaceChildren(
      ...HUES.map((hue) =>
        h(
          'button',
          {
            type: 'button',
            class: 'swatch',
            role: 'radio',
            'aria-label': hue.name,
            'aria-checked': String(state.color === hue.light),
            style: hueStyle(hue.light),
            onClick: () => {
              state.color = hue.light;
              renderSwatches();
            },
          },
          svgIcon(ICONS.check),
        ),
      ),
    );
  }
  renderSwatches();

  // --- goal
  const countEl = h('span', { class: 'count', 'aria-live': 'polite' });
  const unitEl = h('span', { class: 'unit' });
  const minus = h(
    'button',
    { type: 'button', class: 'icon-btn filled', 'aria-label': 'Fewer', onClick: () => setCount(state.count - 1) },
    svgIcon(ICONS.minus),
  );
  const plus = h(
    'button',
    { type: 'button', class: 'icon-btn filled', 'aria-label': 'More', onClick: () => setCount(state.count + 1) },
    svgIcon(ICONS.plus),
  );
  const stepper = h('div', { class: 'stepper' }, minus, countEl, plus, unitEl);
  const periodSeg = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Per' });
  const goalHint = h('div', { class: 'hint' });

  function setCount(n: number) {
    state.count = Math.max(1, Math.min(maxGoalCount(state.period), n));
    renderGoal();
  }
  function renderGoal() {
    const max = maxGoalCount(state.period);
    state.count = Math.min(state.count, max);
    stepper.hidden = state.period === 'day';
    countEl.textContent = String(state.count);
    unitEl.textContent = `${state.count === 1 ? 'time' : 'times'} per ${state.period}`;
    minus.disabled = state.count <= 1;
    plus.disabled = state.count >= max;
    periodSeg.replaceChildren(
      ...PERIODS.map((p) =>
        h(
          'button',
          {
            type: 'button',
            role: 'radio',
            'aria-checked': String(state.period === p),
            onClick: () => {
              state.period = p;
              renderGoal();
            },
          },
          PERIOD_LABEL[p],
        ),
      ),
    );
    goalHint.textContent =
      state.period === 'day'
        ? 'Do it every day.'
        : `Do it on ${state.count} ${state.count === 1 ? 'day' : 'different days'} each ${state.period}.`;
    if (existing && (existing.goal.period !== state.period || existing.goal.count !== state.count)) {
      goalHint.textContent += ' Changing the goal recalculates past stats.';
    }
  }
  renderGoal();

  function save(e: Event) {
    e.preventDefault();
    const name = state.name.trim();
    if (!name) {
      nameError.hidden = false;
      nameInput.focus();
      return;
    }
    const input = {
      name,
      emoji: state.emoji,
      color: state.color,
      goal: { count: state.period === 'day' ? 1 : state.count, period: state.period },
    };
    if (existing) {
      store.updateHabit(existing.id, input);
      toast('Saved');
    } else {
      store.addHabit(input);
      toast(`Added “${name}”`);
    }
    goBack('/habits');
  }

  const form = h(
    'form',
    { onSubmit: save, novalidate: true },
    h('div', { class: 'field' }, h('label', { for: 'name' }, 'Name'), nameInput, nameError),
    h(
      'div',
      { class: 'field' },
      h('label', { for: 'emoji' }, 'Icon'),
      h('div', { class: 'emoji-row' }, emojiInput, emojiPicks),
    ),
    h('div', { class: 'field' }, h('div', { class: 'label' }, 'Colour'), swatches),
    h('div', { class: 'field' }, h('div', { class: 'label' }, 'Goal'), stepper, periodSeg, goalHint),
    h(
      'div',
      { class: 'form-actions' },
      h('a', { class: 'btn', href: '#/habits' }, 'Cancel'),
      h('button', { class: 'btn primary', type: 'submit' }, existing ? 'Save' : 'Add habit'),
    ),
  );

  root.append(
    h('a', { class: 'back', href: '#/habits' }, svgIcon(ICONS.chevronLeft), 'Habits'),
    h('header', { class: 'page-head' }, h('h1', null, existing ? 'Edit habit' : 'New habit')),
    h('div', { class: 'card' }, form),
  );

  if (existing) {
    const archived = existing.archived;
    root.append(
      h(
        'div',
        { class: 'card' },
        h(
          'div',
          { class: 'setting' },
          h('div', { class: 'label' }, archived ? 'Restore' : 'Archive'),
          h(
            'p',
            null,
            archived
              ? 'Bring this habit back to your daily list.'
              : 'Hide it from your daily list but keep its history and stats.',
          ),
          h(
            'button',
            {
              class: 'btn block',
              type: 'button',
              onClick: () => {
                store.updateHabit(existing.id, { archived: !archived });
                toast(archived ? 'Restored' : 'Archived');
                navigate('/habits');
              },
            },
            archived ? 'Unarchive habit' : 'Archive habit',
          ),
        ),
        h(
          'div',
          { class: 'setting' },
          h('div', { class: 'label' }, 'Delete'),
          h('p', null, 'Permanently removes this habit and all its check-ins.'),
          h(
            'button',
            {
              class: 'btn danger block',
              type: 'button',
              onClick: () => {
                const n = Object.keys(store.checkins(existing.id)).length;
                if (!confirm(`Delete “${existing.name}” and its ${n} check-in${n === 1 ? '' : 's'}? This can't be undone.`))
                  return;
                store.deleteHabit(existing.id);
                toast('Deleted');
                navigate('/habits');
              },
            },
            'Delete habit',
          ),
        ),
      ),
    );
  } else {
    // Focus the name field for new habits (brings up the keyboard on phones).
    requestAnimationFrame(() => nameInput.focus());
  }
};
