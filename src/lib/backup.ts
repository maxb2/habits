import { DATA_VERSION, PERIODS } from '../types';
import type { AppData, Habit, HabitCheckins, Settings } from '../types';
import { isValidKey, maxGoalCount } from './dates';

export class DataError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function defaultSettings(weekStart: Settings['weekStart'] = 1): Settings {
  return { weekStart, theme: 'auto' };
}

export function emptyData(weekStart: Settings['weekStart'] = 1): AppData {
  return { version: DATA_VERSION, habits: [], checkins: {}, settings: defaultSettings(weekStart) };
}

function validateHabit(raw: unknown, i: number): Habit {
  const where = `habit #${i + 1}`;
  if (!isObj(raw)) throw new DataError(`${where} is not an object`);
  const { id, name, emoji, color, goal, createdAt, archived, order } = raw;
  if (typeof id !== 'string' || !id) throw new DataError(`${where} has no id`);
  if (typeof name !== 'string' || !name.trim()) throw new DataError(`${where} has no name`);
  if (!isObj(goal)) throw new DataError(`${where} has no goal`);
  const period = goal.period;
  if (typeof period !== 'string' || !(PERIODS as readonly string[]).includes(period)) {
    throw new DataError(`${where} has an invalid goal period`);
  }
  const p = period as Habit['goal']['period'];
  const count = goal.count;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > maxGoalCount(p)) {
    throw new DataError(`${where} has an invalid goal count`);
  }
  if (!isValidKey(createdAt)) throw new DataError(`${where} has an invalid creation date`);
  return {
    id,
    name: name.trim(),
    emoji: typeof emoji === 'string' ? emoji : '',
    color: typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color) ? color : '#0f766e',
    goal: { count, period: p },
    createdAt,
    archived: archived === true,
    order: typeof order === 'number' && Number.isFinite(order) ? order : i,
  };
}

/**
 * Validate and normalise unknown input (stored data or an imported file) into AppData.
 * Throws DataError describing the first problem found.
 */
export function validateData(raw: unknown): AppData {
  if (!isObj(raw)) throw new DataError('Not a habit tracker backup');
  if (raw.version !== DATA_VERSION) {
    throw new DataError(
      typeof raw.version === 'number' && raw.version > DATA_VERSION
        ? 'Backup is from a newer version of the app'
        : 'Unknown backup version',
    );
  }
  if (!Array.isArray(raw.habits)) throw new DataError('Backup has no habits list');
  const habits = raw.habits.map(validateHabit);
  const ids = new Set(habits.map((h) => h.id));
  if (ids.size !== habits.length) throw new DataError('Backup has duplicate habit ids');

  const checkins: Record<string, HabitCheckins> = {};
  for (const h of habits) checkins[h.id] = {};
  if (raw.checkins !== undefined) {
    if (!isObj(raw.checkins)) throw new DataError('Backup check-ins are malformed');
    for (const [id, days] of Object.entries(raw.checkins)) {
      if (!ids.has(id)) continue; // orphaned check-ins: drop
      if (!isObj(days)) throw new DataError('Backup check-ins are malformed');
      for (const [day, v] of Object.entries(days)) {
        if (!isValidKey(day)) throw new DataError(`Backup has an invalid date: ${day}`);
        if (v) checkins[id]![day] = 1;
      }
    }
  }

  const s = isObj(raw.settings) ? raw.settings : {};
  const settings: Settings = {
    weekStart: s.weekStart === 0 ? 0 : 1,
    theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : 'auto',
  };

  return { version: DATA_VERSION, habits, checkins, settings };
}

export function serialize(data: AppData): string {
  return JSON.stringify(data);
}

export function exportJSON(data: AppData, now: Date = new Date()): string {
  return JSON.stringify({ app: 'habit-tracker', exportedAt: now.toISOString(), ...data }, null, 2);
}

export type ImportResult = { ok: true; data: AppData } | { ok: false; error: string };

export function parseImport(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File is not valid JSON' };
  }
  try {
    return { ok: true, data: validateData(raw) };
  } catch (e) {
    return { ok: false, error: e instanceof DataError ? e.message : 'Could not read backup' };
  }
}
