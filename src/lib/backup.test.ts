import { describe, expect, it } from 'vitest';
import { emptyData, exportJSON, parseImport } from './backup';
import type { AppData } from '../types';

const sample: AppData = {
  version: 1,
  habits: [
    {
      id: 'a',
      name: 'Read',
      emoji: '📚',
      color: '#2563eb',
      goal: { count: 3, period: 'week' },
      createdAt: '2026-11-01',
      archived: false,
      order: 0,
    },
  ],
  checkins: { a: { '2026-11-02': 1, '2026-11-03': 1 } },
  settings: { weekStart: 0, theme: 'dark' },
};

describe('export/import', () => {
  it('round-trips', () => {
    const r = parseImport(exportJSON(sample));
    expect(r).toEqual({ ok: true, data: sample });
  });

  it('round-trips empty data', () => {
    expect(parseImport(exportJSON(emptyData()))).toEqual({ ok: true, data: emptyData() });
  });

  it('rejects non-JSON', () => {
    expect(parseImport('nope')).toEqual({ ok: false, error: 'File is not valid JSON' });
  });

  it('rejects wrong shapes', () => {
    expect(parseImport('[]').ok).toBe(false);
    expect(parseImport('{"version":1}').ok).toBe(false);
    expect(parseImport(JSON.stringify({ ...sample, version: 2 }))).toEqual({
      ok: false,
      error: 'Backup is from a newer version of the app',
    });
  });

  it('rejects invalid habits', () => {
    const bad = (patch: object) =>
      parseImport(JSON.stringify({ ...sample, habits: [{ ...sample.habits[0], ...patch }] }));
    expect(bad({ name: '  ' }).ok).toBe(false);
    expect(bad({ goal: { count: 8, period: 'week' } }).ok).toBe(false);
    expect(bad({ goal: { count: 2, period: 'day' } }).ok).toBe(false);
    expect(bad({ goal: { count: 1, period: 'fortnight' } }).ok).toBe(false);
    expect(bad({ createdAt: '2026-02-30' }).ok).toBe(false);
    expect(bad({ goal: { count: 0, period: 'week' } }).ok).toBe(false);
    expect(bad({ goal: { count: 2, period: 'week', kind: 'sometimes' } }).ok).toBe(false);
    expect(bad({ goal: { count: 7, period: 'week', kind: 'atMost' } }).ok).toBe(false);
    expect(bad({ goal: { count: 1, period: 'day', kind: 'atMost' } }).ok).toBe(false);
  });

  it('keeps limit goals and normalises explicit atLeast', () => {
    const withGoal = (goal: object) =>
      parseImport(JSON.stringify({ ...sample, habits: [{ ...sample.habits[0], goal }] }));
    const limit = { count: 0, period: 'day', kind: 'atMost' };
    const r = withGoal(limit);
    expect(r.ok && r.data.habits[0]!.goal).toEqual(limit);
    const r2 = withGoal({ count: 3, period: 'week', kind: 'atLeast' });
    expect(r2.ok && r2.data.habits[0]!.goal).toEqual({ count: 3, period: 'week' });
  });

  it('rejects duplicate ids and bad dates', () => {
    expect(parseImport(JSON.stringify({ ...sample, habits: [sample.habits[0], sample.habits[0]] })).ok).toBe(false);
    expect(parseImport(JSON.stringify({ ...sample, checkins: { a: { 'not-a-date': 1 } } })).ok).toBe(false);
  });

  it('drops orphaned check-ins and fills defaults', () => {
    const r = parseImport(
      JSON.stringify({ version: 1, habits: sample.habits, checkins: { zzz: { '2026-11-01': 1 } } }),
    );
    expect(r.ok && r.data.checkins).toEqual({ a: {} });
    expect(r.ok && r.data.settings).toEqual({ weekStart: 1, theme: 'auto' });
  });
});
