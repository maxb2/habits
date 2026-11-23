import type { DateKey, Period, WeekStart } from '../types';

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date of `d` as a key. */
export function toKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse a key into a local Date at noon (noon keeps DST shifts from changing the day). */
export function fromKey(key: DateKey): Date {
  const m = KEY_RE.exec(key);
  if (!m) throw new Error(`Invalid date key: ${key}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
}

export function isValidKey(key: unknown): key is DateKey {
  if (typeof key !== 'string') return false;
  const m = KEY_RE.exec(key);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return toKey(d) === key;
}

export function todayKey(now: Date = new Date()): DateKey {
  return toKey(now);
}

export function addDays(key: DateKey, n: number): DateKey {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

/** Whole days from `a` to `b` (positive when b is later). DST-safe. */
export function diffDays(a: DateKey, b: DateKey): number {
  const [ay, am, ad] = a.split('-').map(Number) as [number, number, number];
  const [by, bm, bd] = b.split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** Day of week, 0 = Sunday. */
export function weekday(key: DateKey): number {
  return fromKey(key).getDay();
}

export function periodStart(period: Period, key: DateKey, weekStart: WeekStart): DateKey {
  switch (period) {
    case 'day':
      return key;
    case 'week': {
      const back = (weekday(key) - weekStart + 7) % 7;
      return addDays(key, -back);
    }
    case 'month':
      return `${key.slice(0, 7)}-01`;
    case 'year':
      return `${key.slice(0, 4)}-01-01`;
  }
}

/** Last day (inclusive) of the period containing `key`. */
export function periodEnd(period: Period, key: DateKey, weekStart: WeekStart): DateKey {
  switch (period) {
    case 'day':
      return key;
    case 'week':
      return addDays(periodStart('week', key, weekStart), 6);
    case 'month': {
      const d = fromKey(key);
      return toKey(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
    }
    case 'year':
      return `${key.slice(0, 4)}-12-31`;
  }
}

export function prevPeriodStart(period: Period, key: DateKey, weekStart: WeekStart): DateKey {
  return periodStart(period, addDays(periodStart(period, key, weekStart), -1), weekStart);
}

export function nextPeriodStart(period: Period, key: DateKey, weekStart: WeekStart): DateKey {
  return addDays(periodEnd(period, key, weekStart), 1);
}

/** Number of days in the period containing `key`. */
export function periodLength(period: Period, key: DateKey, weekStart: WeekStart): number {
  return diffDays(periodStart(period, key, weekStart), periodEnd(period, key, weekStart)) + 1;
}

/** Largest sensible goal count for a period. */
export function maxGoalCount(period: Period): number {
  return { day: 1, week: 7, month: 31, year: 366 }[period];
}

/** Inclusive list of day keys from `start` to `end`. */
export function daysInRange(start: DateKey, end: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let k = start; k <= end; k = addDays(k, 1)) out.push(k);
  return out;
}

/** Default week start from the user's locale, falling back to Monday. */
export function localeWeekStart(): WeekStart {
  try {
    const locale = new Intl.Locale(navigator.language) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const info = locale.getWeekInfo?.() ?? locale.weekInfo;
    if (info) return info.firstDay === 7 ? 0 : 1;
  } catch {
    /* ignore */
  }
  return 1;
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, opts);
const longDay = fmt({ weekday: 'long', month: 'long', day: 'numeric' });
const shortDay = fmt({ month: 'short', day: 'numeric' });
const monthOnly = fmt({ month: 'short' });
const monthYear = fmt({ month: 'long', year: 'numeric' });

export function formatLongDay(key: DateKey): string {
  return longDay.format(fromKey(key));
}

export function formatShortDay(key: DateKey): string {
  return shortDay.format(fromKey(key));
}

export function formatMonth(key: DateKey): string {
  return monthOnly.format(fromKey(key));
}

/** Short axis label for a period starting at `start`. */
export function periodLabel(period: Period, start: DateKey): string {
  switch (period) {
    case 'day':
      return formatShortDay(start);
    case 'week':
      return formatShortDay(start);
    case 'month':
      return monthOnly.format(fromKey(start));
    case 'year':
      return start.slice(0, 4);
  }
}

/** Longer label for a period, e.g. tooltips. */
export function periodTitle(period: Period, start: DateKey, weekStart: WeekStart): string {
  switch (period) {
    case 'day':
      return formatLongDay(start);
    case 'week':
      return `${formatShortDay(start)} – ${formatShortDay(periodEnd('week', start, weekStart))}`;
    case 'month':
      return monthYear.format(fromKey(start));
    case 'year':
      return start.slice(0, 4);
  }
}

/** "this week", "today", ... */
export function currentPeriodName(period: Period): string {
  return { day: 'today', week: 'this week', month: 'this month', year: 'this year' }[period];
}

/** "1× per day", "3× per week" */
export function goalText(count: number, period: Period): string {
  return period === 'day' ? 'Every day' : `${count}× per ${period}`;
}

export function formatMonthYear(key: DateKey): string {
  return monthYear.format(fromKey(key));
}

/** First day of the month `n` months after the month containing `key`. */
export function addMonths(key: DateKey, n: number): DateKey {
  const d = fromKey(key);
  return toKey(new Date(d.getFullYear(), d.getMonth() + n, 1, 12));
}
