import type { DateKey, Habit, HabitCheckins, Period, WeekStart } from '../types';
import { addDays, nextPeriodStart, periodEnd, periodStart, prevPeriodStart } from './dates';

export interface PeriodResult {
  start: DateKey;
  end: DateKey;
  count: number;
  target: number;
  met: boolean;
  /** True for the period containing "today". */
  current: boolean;
}

/** Number of checked-in days between `start` and `end`, inclusive. */
export function countInRange(checkins: HabitCheckins, start: DateKey, end: DateKey): number {
  let n = 0;
  for (let k = start; k <= end; k = addDays(k, 1)) if (checkins[k]) n++;
  return n;
}

/** First day the habit "exists": its creation date, or an earlier backfilled check-in. */
export function habitStart(habit: Habit, checkins: HabitCheckins): DateKey {
  let start = habit.createdAt;
  for (const k of Object.keys(checkins)) if (k < start) start = k;
  return start;
}

function result(
  habit: Habit,
  checkins: HabitCheckins,
  start: DateKey,
  weekStart: WeekStart,
  today: DateKey,
): PeriodResult {
  const { period, count: target } = habit.goal;
  const end = periodEnd(period, start, weekStart);
  // Only count up to today; future days can't be checked anyway.
  const count = countInRange(checkins, start, end < today ? end : today);
  return { start, end, count, target, met: count >= target, current: start <= today && today <= end };
}

export function periodProgress(
  habit: Habit,
  checkins: HabitCheckins,
  today: DateKey,
  weekStart: WeekStart,
): PeriodResult {
  return result(habit, checkins, periodStart(habit.goal.period, today, weekStart), weekStart, today);
}

/** Results for every period from the habit's start through the current one, oldest first. */
export function allPeriods(
  habit: Habit,
  checkins: HabitCheckins,
  today: DateKey,
  weekStart: WeekStart,
): PeriodResult[] {
  const { period } = habit.goal;
  const first = periodStart(period, habitStart(habit, checkins), weekStart);
  const last = periodStart(period, today, weekStart);
  const out: PeriodResult[] = [];
  for (let s = first; s <= last; s = nextPeriodStart(period, s, weekStart)) {
    out.push(result(habit, checkins, s, weekStart, today));
  }
  return out;
}

/** The last `n` periods ending with the current one, oldest first. Includes periods before the habit started. */
export function recentPeriods(
  habit: Habit,
  checkins: HabitCheckins,
  today: DateKey,
  weekStart: WeekStart,
  n: number,
): (PeriodResult & { beforeStart: boolean })[] {
  const { period } = habit.goal;
  const firstStart = periodStart(period, habitStart(habit, checkins), weekStart);
  const starts: DateKey[] = [];
  let s = periodStart(period, today, weekStart);
  for (let i = 0; i < n; i++) {
    starts.unshift(s);
    s = prevPeriodStart(period, s, weekStart);
  }
  return starts.map((start) => ({
    ...result(habit, checkins, start, weekStart, today),
    beforeStart: start < firstStart,
  }));
}

/**
 * Consecutive goal periods met, counting back from now.
 * The current period adds to the streak once met, and never breaks it while still in progress.
 */
export function currentStreak(
  habit: Habit,
  checkins: HabitCheckins,
  today: DateKey,
  weekStart: WeekStart,
): number {
  const periods = allPeriods(habit, checkins, today, weekStart);
  let streak = 0;
  for (let i = periods.length - 1; i >= 0; i--) {
    const p = periods[i]!;
    if (p.met) streak++;
    else if (p.current) continue;
    else break;
  }
  return streak;
}

export function bestStreak(
  habit: Habit,
  checkins: HabitCheckins,
  today: DateKey,
  weekStart: WeekStart,
): number {
  let best = 0;
  let run = 0;
  for (const p of allPeriods(habit, checkins, today, weekStart)) {
    if (p.met) {
      run++;
      if (run > best) best = run;
    } else if (!p.current) {
      run = 0;
    }
  }
  return best;
}

export interface Completion {
  met: number;
  total: number;
  /** 0..1, or null when there are no finished periods yet. */
  rate: number | null;
}

/**
 * Share of periods where the goal was met. The current period is included only once met,
 * so an in-progress week doesn't drag the rate down. Optionally limited to the last `n` periods.
 */
export function completion(
  habit: Habit,
  checkins: HabitCheckins,
  today: DateKey,
  weekStart: WeekStart,
  n?: number,
): Completion {
  let periods = allPeriods(habit, checkins, today, weekStart);
  if (n !== undefined) periods = periods.slice(-n);
  const counted = periods.filter((p) => !p.current || p.met);
  const met = counted.filter((p) => p.met).length;
  return { met, total: counted.length, rate: counted.length ? met / counted.length : null };
}

export function totalCheckins(checkins: HabitCheckins): number {
  return Object.keys(checkins).length;
}

/** Streak unit label: "3 days", "1 week". */
export function streakUnit(period: Period, n: number): string {
  return `${n} ${period}${n === 1 ? '' : 's'}`;
}
