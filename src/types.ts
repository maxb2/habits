/** Local calendar date in `YYYY-MM-DD` form. Never derived from UTC. */
export type DateKey = string;

export type Period = 'day' | 'week' | 'month' | 'year';

export const PERIODS: readonly Period[] = ['day', 'week', 'month', 'year'];

/**
 * `atLeast` (the default): do it on at least `count` days per period.
 * `atMost`: a limit — do it on no more than `count` days per period (0 = avoid entirely).
 */
export type GoalKind = 'atLeast' | 'atMost';

export interface Goal {
  /** Days within each period: the target for `atLeast`, the limit for `atMost`. */
  count: number;
  period: Period;
  /** Omitted means `atLeast`, so data saved before limits existed stays valid. */
  kind?: GoalKind;
}

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  goal: Goal;
  createdAt: DateKey;
  archived: boolean;
  order: number;
}

/** Days a habit was done, as a set keyed by date. */
export type HabitCheckins = Record<DateKey, 1>;

/** 0 = Sunday, 1 = Monday. */
export type WeekStart = 0 | 1;

export type Theme = 'auto' | 'light' | 'dark';

export interface Settings {
  weekStart: WeekStart;
  theme: Theme;
}

export interface AppData {
  version: 1;
  habits: Habit[];
  checkins: Record<string, HabitCheckins>;
  settings: Settings;
}

export const DATA_VERSION = 1 as const;
