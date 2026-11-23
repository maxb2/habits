import type { AppData, DateKey, Goal, Habit, Settings } from './types';
import { emptyData, serialize, validateData } from './lib/backup';
import { todayKey } from './lib/dates';

export const STORAGE_KEY = 'habit-tracker:v1';

type KV = Pick<Storage, 'getItem' | 'setItem'>;
type Listener = (data: AppData) => void;

export interface HabitInput {
  name: string;
  emoji: string;
  color: string;
  goal: Goal;
}

function newId(): string {
  // randomUUID needs a secure context; fall back for plain-http LAN testing.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID();
    } catch {
      /* fall through */
    }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createStore(storage: KV, defaultWeekStart: Settings['weekStart'] = 1) {
  let data: AppData = load();
  const listeners = new Set<Listener>();
  /** Set when the last save failed (e.g. storage full), so the UI can warn. */
  let saveError: string | null = null;

  function load(): AppData {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return emptyData(defaultWeekStart);
    try {
      return validateData(JSON.parse(raw));
    } catch {
      // Never silently destroy data: park the unreadable copy before starting fresh.
      storage.setItem(`${STORAGE_KEY}:corrupt-${Date.now()}`, raw);
      return emptyData(defaultWeekStart);
    }
  }

  function commit(next: AppData) {
    data = next;
    try {
      storage.setItem(STORAGE_KEY, serialize(data));
      saveError = null;
    } catch (e) {
      saveError = e instanceof Error ? e.message : String(e);
    }
    for (const l of listeners) l(data);
  }

  const habitsSorted = () => [...data.habits].sort((a, b) => a.order - b.order);

  return {
    get data(): AppData {
      return data;
    },
    get saveError() {
      return saveError;
    },
    subscribe(l: Listener): () => void {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    /** Re-read storage (e.g. another tab changed it). */
    reload() {
      data = load();
      for (const l of listeners) l(data);
    },
    replaceAll(next: AppData) {
      commit(next);
    },
    clearAll() {
      commit(emptyData(data.settings.weekStart));
    },

    activeHabits(): Habit[] {
      return habitsSorted().filter((h) => !h.archived);
    },
    archivedHabits(): Habit[] {
      return habitsSorted().filter((h) => h.archived);
    },
    habit(id: string): Habit | undefined {
      return data.habits.find((h) => h.id === id);
    },
    checkins(id: string) {
      return data.checkins[id] ?? {};
    },

    addHabit(input: HabitInput, today: DateKey = todayKey()): Habit {
      const order = data.habits.reduce((m, h) => Math.max(m, h.order), -1) + 1;
      const habit: Habit = { ...input, id: newId(), createdAt: today, archived: false, order };
      commit({ ...data, habits: [...data.habits, habit], checkins: { ...data.checkins, [habit.id]: {} } });
      return habit;
    },
    updateHabit(id: string, patch: Partial<HabitInput & Pick<Habit, 'archived'>>) {
      commit({ ...data, habits: data.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) });
    },
    deleteHabit(id: string) {
      const checkins = { ...data.checkins };
      delete checkins[id];
      commit({ ...data, habits: data.habits.filter((h) => h.id !== id), checkins });
    },
    /** Move a habit up (-1) or down (+1) among habits with the same archived state. */
    moveHabit(id: string, dir: -1 | 1) {
      const target = data.habits.find((h) => h.id === id);
      if (!target) return;
      const all = habitsSorted();
      const list = all.filter((h) => h.archived === target.archived);
      const i = list.findIndex((h) => h.id === id);
      const j = i + dir;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j]!, list[i]!];
      const ordered = [...list, ...all.filter((h) => h.archived !== target.archived)];
      const newOrder = new Map(ordered.map((h, idx) => [h.id, idx]));
      commit({ ...data, habits: data.habits.map((h) => ({ ...h, order: newOrder.get(h.id)! })) });
    },
    toggleCheckin(id: string, day: DateKey): boolean {
      const current = { ...(data.checkins[id] ?? {}) };
      const done = !current[day];
      if (done) current[day] = 1;
      else delete current[day];
      commit({ ...data, checkins: { ...data.checkins, [id]: current } });
      return done;
    },
    updateSettings(patch: Partial<Settings>) {
      commit({ ...data, settings: { ...data.settings, ...patch } });
    },
  };
}

export type Store = ReturnType<typeof createStore>;
