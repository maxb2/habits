import { describe, expect, it } from 'vitest';
import { createStore, STORAGE_KEY } from './store';

function memory() {
  const m = new Map<string, string>();
  return {
    map: m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

const input = { name: 'Run', emoji: '🏃', color: '#16a34a', goal: { count: 3, period: 'week' as const } };

describe('store', () => {
  it('persists habits and check-ins', () => {
    const mem = memory();
    const s = createStore(mem);
    const h = s.addHabit(input, '2026-11-23');
    expect(s.toggleCheckin(h.id, '2026-11-23')).toBe(true);
    const s2 = createStore(mem);
    expect(s2.activeHabits().map((x) => x.name)).toEqual(['Run']);
    expect(s2.checkins(h.id)).toEqual({ '2026-11-23': 1 });
    expect(s2.toggleCheckin(h.id, '2026-11-23')).toBe(false);
    expect(createStore(mem).checkins(h.id)).toEqual({});
  });

  it('keeps corrupt data aside instead of discarding it', () => {
    const mem = memory();
    mem.setItem(STORAGE_KEY, '{broken');
    const s = createStore(mem);
    expect(s.data.habits).toEqual([]);
    const parked = [...mem.map.keys()].find((k) => k.startsWith(`${STORAGE_KEY}:corrupt-`));
    expect(parked && mem.map.get(parked)).toBe('{broken');
  });

  it('reorders within group and archives', () => {
    const s = createStore(memory());
    const a = s.addHabit({ ...input, name: 'A' });
    const b = s.addHabit({ ...input, name: 'B' });
    const c = s.addHabit({ ...input, name: 'C' });
    s.moveHabit(c.id, -1);
    expect(s.activeHabits().map((h) => h.name)).toEqual(['A', 'C', 'B']);
    s.moveHabit(a.id, -1); // no-op at top
    expect(s.activeHabits().map((h) => h.name)).toEqual(['A', 'C', 'B']);
    s.updateHabit(b.id, { archived: true });
    expect(s.activeHabits().map((h) => h.name)).toEqual(['A', 'C']);
    expect(s.archivedHabits().map((h) => h.name)).toEqual(['B']);
  });

  it('deletes habit with its check-ins', () => {
    const s = createStore(memory());
    const a = s.addHabit(input);
    s.toggleCheckin(a.id, '2026-11-20');
    s.deleteHabit(a.id);
    expect(s.data.habits).toEqual([]);
    expect(s.data.checkins).toEqual({});
  });

  it('reports save failure without losing in-memory state', () => {
    const s = createStore({
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    s.addHabit(input);
    expect(s.saveError).toBe('QuotaExceededError');
    expect(s.data.habits).toHaveLength(1);
  });
});
