import { describe, expect, it } from 'vitest';
import type { Habit, HabitCheckins } from '../types';
import { addDays } from './dates';
import {
  allPeriods,
  bestStreak,
  completion,
  countInRange,
  currentStreak,
  habitStart,
  periodProgress,
  recentPeriods,
} from './stats';

const habit = (goal: Habit['goal'], createdAt = '2026-11-01'): Habit => ({
  id: 'h',
  name: 'Test',
  emoji: '',
  color: '#000000',
  goal,
  createdAt,
  archived: false,
  order: 0,
});

const days = (...keys: string[]): HabitCheckins => Object.fromEntries(keys.map((k) => [k, 1]));

// Monday
const TODAY = '2026-11-23';

describe('countInRange / habitStart', () => {
  it('counts inclusive', () => {
    const c = days('2026-11-01', '2026-11-05', '2026-11-06');
    expect(countInRange(c, '2026-11-01', '2026-11-05')).toBe(2);
  });

  it('starts at earliest backfilled check-in', () => {
    expect(habitStart(habit({ count: 1, period: 'day' }), days('2026-10-20'))).toBe('2026-10-20');
    expect(habitStart(habit({ count: 1, period: 'day' }), days('2026-11-20'))).toBe('2026-11-01');
  });
});

describe('periodProgress', () => {
  it('weekly progress', () => {
    const h = habit({ count: 3, period: 'week' });
    const c = days('2026-11-22', '2026-11-23'); // Sun (previous week w/ Mon start), Mon
    expect(periodProgress(h, c, TODAY, 1)).toMatchObject({ count: 1, target: 3, met: false, current: true });
    expect(periodProgress(h, c, TODAY, 0)).toMatchObject({ count: 2, start: '2026-11-22' });
  });

  it('monthly progress met', () => {
    const h = habit({ count: 2, period: 'month' });
    const c = days('2026-11-02', '2026-11-10');
    expect(periodProgress(h, c, TODAY, 1)).toMatchObject({ count: 2, met: true });
  });
});

describe('streaks', () => {
  it('daily: in-progress today does not break streak', () => {
    const h = habit({ count: 1, period: 'day' });
    const c = days('2026-11-20', '2026-11-21', '2026-11-22');
    expect(currentStreak(h, c, TODAY, 1)).toBe(3);
    expect(currentStreak(h, { ...c, [TODAY]: 1 }, TODAY, 1)).toBe(4);
  });

  it('daily: gap breaks streak', () => {
    const h = habit({ count: 1, period: 'day' });
    const c = days('2026-11-18', '2026-11-19', '2026-11-20', '2026-11-22');
    expect(currentStreak(h, c, TODAY, 1)).toBe(1);
    expect(bestStreak(h, c, TODAY, 1)).toBe(3);
  });

  it('weekly goal streak', () => {
    const h = habit({ count: 2, period: 'week' }, '2026-11-02');
    // Weeks (Mon start): 11-02 met, 11-09 met, 11-16 met, 11-23 current (1/2)
    const c = days('2026-11-02', '2026-11-03', '2026-11-10', '2026-11-12', '2026-11-16', '2026-11-20', TODAY);
    expect(currentStreak(h, c, TODAY, 1)).toBe(3);
    expect(bestStreak(h, c, TODAY, 1)).toBe(3);
    // Missing week 11-09 breaks it
    const c2 = days('2026-11-02', '2026-11-03', '2026-11-10', '2026-11-16', '2026-11-20');
    expect(currentStreak(h, c2, TODAY, 1)).toBe(1);
  });

  it('no check-ins = zero', () => {
    const h = habit({ count: 1, period: 'day' });
    expect(currentStreak(h, {}, TODAY, 1)).toBe(0);
    expect(bestStreak(h, {}, TODAY, 1)).toBe(0);
  });
});

describe('completion', () => {
  it('excludes unmet current period', () => {
    const h = habit({ count: 1, period: 'day' }, '2026-11-20');
    const c = days('2026-11-20', '2026-11-22');
    // 11-20 met, 11-21 missed, 11-22 met, 11-23 current & unmet -> excluded
    expect(completion(h, c, TODAY, 1)).toEqual({ met: 2, total: 3, rate: 2 / 3 });
    expect(completion(h, { ...c, [TODAY]: 1 }, TODAY, 1)).toEqual({ met: 3, total: 4, rate: 3 / 4 });
  });

  it('null rate when nothing finished', () => {
    const h = habit({ count: 1, period: 'day' }, TODAY);
    expect(completion(h, {}, TODAY, 1).rate).toBeNull();
  });

  it('limits to last n periods', () => {
    const h = habit({ count: 1, period: 'day' }, '2026-11-01');
    const c = days(...Array.from({ length: 5 }, (_, i) => addDays('2026-11-18', i)));
    expect(completion(h, c, TODAY, 1, 6)).toEqual({ met: 5, total: 5, rate: 1 });
  });
});

describe('period lists', () => {
  it('allPeriods spans from habit start through current', () => {
    const h = habit({ count: 1, period: 'month' }, '2026-09-15');
    const ps = allPeriods(h, {}, TODAY, 1);
    expect(ps.map((p) => p.start)).toEqual(['2026-09-01', '2026-10-01', '2026-11-01']);
    expect(ps[2]!.current).toBe(true);
  });

  it('recentPeriods marks periods before start', () => {
    const h = habit({ count: 1, period: 'week' }, '2026-11-10');
    const ps = recentPeriods(h, {}, TODAY, 1, 4);
    expect(ps.map((p) => p.start)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']);
    expect(ps.map((p) => p.beforeStart)).toEqual([true, false, false, false]);
  });

  it('does not count future days in current period', () => {
    const h = habit({ count: 3, period: 'week' });
    const c = days('2026-11-24'); // tomorrow (bad data)
    expect(periodProgress(h, c, TODAY, 1).count).toBe(0);
  });
});

describe('limit goals (atMost)', () => {
  const limit = (count: number, period: Habit['goal']['period'], createdAt?: string) =>
    habit({ count, period, kind: 'atMost' }, createdAt);

  it('current period within the limit is met but undecided', () => {
    const p = periodProgress(limit(2, 'week'), days(TODAY), TODAY, 1);
    expect(p).toMatchObject({ count: 1, target: 2, limit: true, met: true, over: false, decided: false });
  });

  it('clean periods build a streak; the in-progress one does not count yet', () => {
    // Weeks (Mon start) from Oct 26 to Nov 16 are finished, Nov 23 is current.
    const h = limit(2, 'week');
    expect(currentStreak(h, {}, TODAY, 1)).toBe(4);
    expect(completion(h, {}, TODAY, 1)).toEqual({ met: 4, total: 4, rate: 1 });
  });

  it('going over breaks streaks', () => {
    const h = limit(2, 'week');
    const c = days('2026-11-10', '2026-11-11', '2026-11-12'); // 3 in the week of Nov 9
    expect(currentStreak(h, c, TODAY, 1)).toBe(1);
    expect(bestStreak(h, c, TODAY, 1)).toBe(2);
    expect(completion(h, c, TODAY, 1)).toEqual({ met: 3, total: 4, rate: 3 / 4 });
  });

  it('going over in the current period is decided at once', () => {
    const h = limit(0, 'week');
    const p = periodProgress(h, days(TODAY), TODAY, 1);
    expect(p).toMatchObject({ met: false, over: true, decided: true });
    expect(currentStreak(h, days(TODAY), TODAY, 1)).toBe(0);
    expect(completion(h, days(TODAY), TODAY, 1)).toEqual({ met: 4, total: 5, rate: 4 / 5 });
  });

  it('daily "never" counts clean days', () => {
    const h = limit(0, 'day', '2026-11-20');
    const c = days('2026-11-21');
    expect(currentStreak(h, c, TODAY, 1)).toBe(1); // Nov 22; today still in progress
    expect(bestStreak(h, c, TODAY, 1)).toBe(1);
    expect(currentStreak(h, { ...c, [TODAY]: 1 }, TODAY, 1)).toBe(0);
  });
});
