import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addMonths,
  addDays,
  daysInRange,
  diffDays,
  isValidKey,
  nextPeriodStart,
  periodEnd,
  periodLength,
  periodStart,
  prevPeriodStart,
  toKey,
} from './dates';

// Run with a DST-observing zone so day arithmetic across transitions is exercised.
const originalTZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'America/New_York';
});
afterAll(() => {
  process.env.TZ = originalTZ;
});

describe('keys', () => {
  it('formats local dates', () => {
    expect(toKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(toKey(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31');
  });

  it('validates keys', () => {
    expect(isValidKey('2026-02-28')).toBe(true);
    expect(isValidKey('2028-02-29')).toBe(true);
    expect(isValidKey('2026-02-29')).toBe(false);
    expect(isValidKey('2026-13-01')).toBe(false);
    expect(isValidKey('2026-1-01')).toBe(false);
    expect(isValidKey(20260101)).toBe(false);
  });
});

describe('addDays / diffDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('is unaffected by DST transitions', () => {
    // US DST starts 2026-03-08, ends 2026-11-01
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
    expect(diffDays('2026-03-01', '2026-03-15')).toBe(14);
    expect(diffDays('2026-10-25', '2026-11-08')).toBe(14);
    expect(daysInRange('2026-03-07', '2026-03-10')).toEqual([
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
    ]);
  });
});

describe('periods', () => {
  // 2026-11-23 is a Monday
  it('week start Monday', () => {
    expect(periodStart('week', '2026-11-23', 1)).toBe('2026-11-23');
    expect(periodStart('week', '2026-11-29', 1)).toBe('2026-11-23');
    expect(periodEnd('week', '2026-11-25', 1)).toBe('2026-11-29');
  });

  it('week start Sunday', () => {
    expect(periodStart('week', '2026-11-23', 0)).toBe('2026-11-22');
    expect(periodStart('week', '2026-11-22', 0)).toBe('2026-11-22');
    expect(periodEnd('week', '2026-11-22', 0)).toBe('2026-11-28');
  });

  it('weeks spanning a year boundary', () => {
    expect(periodStart('week', '2027-01-01', 1)).toBe('2026-12-28');
    expect(nextPeriodStart('week', '2026-12-28', 1)).toBe('2027-01-04');
  });

  it('months and years', () => {
    expect(periodStart('month', '2026-02-17', 1)).toBe('2026-02-01');
    expect(periodEnd('month', '2026-02-17', 1)).toBe('2026-02-28');
    expect(periodEnd('month', '2028-02-03', 1)).toBe('2028-02-29');
    expect(periodEnd('month', '2026-12-03', 1)).toBe('2026-12-31');
    expect(periodStart('year', '2026-07-04', 1)).toBe('2026-01-01');
    expect(periodEnd('year', '2026-07-04', 1)).toBe('2026-12-31');
    expect(periodLength('year', '2028-07-04', 1)).toBe(366);
  });

  it('prev/next', () => {
    expect(prevPeriodStart('month', '2026-03-15', 1)).toBe('2026-02-01');
    expect(prevPeriodStart('month', '2026-01-15', 1)).toBe('2025-12-01');
    expect(nextPeriodStart('month', '2026-12-01', 1)).toBe('2027-01-01');
    expect(prevPeriodStart('day', '2026-03-01', 1)).toBe('2026-02-28');
    expect(prevPeriodStart('week', '2026-11-25', 1)).toBe('2026-11-16');
    expect(nextPeriodStart('year', '2026-05-05', 1)).toBe('2027-01-01');
  });
});

describe('addMonths', () => {
  it('returns the first of the target month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-01');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-01');
    expect(addMonths('2026-03-31', -13)).toBe('2025-02-01');
  });
});
