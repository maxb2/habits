/** Local calendar date in `YYYY-MM-DD` form. Never derived from UTC. */
export type DateKey = string;

export type Period = 'day' | 'week' | 'month' | 'year';

export const PERIODS: readonly Period[] = ['day', 'week', 'month', 'year'];

export interface Goal {
  /** How many days within each period the habit should be done. */
  count: number;
  period: Period;
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
