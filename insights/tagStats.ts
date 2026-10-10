import {addDays, dateRange, daysBetween, dayOfWeek, IsoDate, parseIsoDate, toIsoDate} from '@/lib/dates';
import {TagEntry} from '@/metrics/types';

export type TagPeriodTotal = {start: IsoDate; total: number; days: number};

export type TagStats = {
  total: number;
  daysLogged: number;
  firstDate: IsoDate | null;
  lastDate: IsoDate | null;
  daysSinceLast: number | null;
  currentStreakWithout: number | null;
  longestStreakWithout: number | null;
  thisWeek: {start: IsoDate; total: number; limit: number | null; fraction: number | null};
  fourWeekAvg: number;
  previousFourWeekAvg: number | null;
  fourWeekChange: number | null;
  /** Average amount per weekday, Monday first. */
  weekdayAverages: number[];
};

export function weekStart(date: IsoDate): IsoDate {
  return addDays(date, -((dayOfWeek(date) + 6) % 7));
}

export function monthStart(date: IsoDate): IsoDate {
  const d = parseIsoDate(date);
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

function nextMonth(date: IsoDate): IsoDate {
  const d = parseIsoDate(date);
  return toIsoDate(new Date(d.getFullYear(), d.getMonth() + 1, 1));
}

function positive(entries: TagEntry[]) {
  return entries.filter((e) => e.value > 0).sort((a, b) => a.date.localeCompare(b.date));
}

function totals(entries: TagEntry[], starts: IsoDate[], keyOf: (d: IsoDate) => IsoDate): TagPeriodTotal[] {
  const map = new Map<IsoDate, TagPeriodTotal>(starts.map((s) => [s, {start: s, total: 0, days: 0}]));
  for (const e of positive(entries)) {
    const bucket = map.get(keyOf(e.date));
    if (!bucket) continue;
    bucket.total += e.value;
    bucket.days += 1;
  }
  return starts.map((s) => map.get(s)!);
}

/** Totals for every Monday-start week overlapping [from, to], including empty weeks. */
export function weeklyTotals(entries: TagEntry[], from: IsoDate, to: IsoDate): TagPeriodTotal[] {
  const starts: IsoDate[] = [];
  for (let w = weekStart(from); w <= to; w = addDays(w, 7)) starts.push(w);
  return totals(entries.filter((e) => e.date >= from && e.date <= to), starts, weekStart);
}

export function monthlyTotals(entries: TagEntry[], from: IsoDate, to: IsoDate): TagPeriodTotal[] {
  const starts: IsoDate[] = [];
  for (let m = monthStart(from); m <= to; m = nextMonth(m)) starts.push(m);
  return totals(entries.filter((e) => e.date >= from && e.date <= to), starts, monthStart);
}

const sum = (entries: TagEntry[], from: IsoDate, to: IsoDate) =>
  entries.filter((e) => e.date >= from && e.date <= to).reduce((a, e) => a + e.value, 0);

export function computeTagStats(entries: TagEntry[], today: IsoDate, weeklyLimit: number | null = null): TagStats {
  const logged = positive(entries).filter((e) => e.date <= today);
  const firstDate = logged[0]?.date ?? null;
  const lastDate = logged[logged.length - 1]?.date ?? null;
  const daysSinceLast = lastDate ? daysBetween(lastDate, today) : null;

  let longest: number | null = null;
  for (let i = 1; i < logged.length; i++) {
    const gap = daysBetween(logged[i - 1].date, logged[i].date) - 1;
    longest = Math.max(longest ?? 0, gap);
  }
  if (daysSinceLast != null) longest = Math.max(longest ?? 0, daysSinceLast);

  const week = weekStart(today);
  const weekTotal = sum(logged, week, today);

  const recentFrom = addDays(today, -27);
  const previousFrom = addDays(today, -55);
  const fourWeekAvg = sum(logged, recentFrom, today) / 4;
  const hasPreviousWindow = firstDate != null && firstDate <= addDays(recentFrom, -1);
  const previousFourWeekAvg = hasPreviousWindow ? sum(logged, previousFrom, addDays(recentFrom, -1)) / 4 : null;

  const weekdayTotals = [0, 0, 0, 0, 0, 0, 0];
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  if (firstDate) {
    for (const d of dateRange(firstDate, today)) weekdayCounts[(dayOfWeek(d) + 6) % 7]++;
    for (const e of logged) weekdayTotals[(dayOfWeek(e.date) + 6) % 7] += e.value;
  }

  return {
    total: logged.reduce((a, e) => a + e.value, 0),
    daysLogged: logged.length,
    firstDate,
    lastDate,
    daysSinceLast,
    currentStreakWithout: daysSinceLast,
    longestStreakWithout: longest,
    thisWeek: {
      start: week,
      total: weekTotal,
      limit: weeklyLimit,
      fraction: weeklyLimit != null && weeklyLimit > 0 ? weekTotal / weeklyLimit : null,
    },
    fourWeekAvg,
    previousFourWeekAvg,
    fourWeekChange: previousFourWeekAvg == null ? null : fourWeekAvg - previousFourWeekAvg,
    weekdayAverages: weekdayTotals.map((t, i) => (weekdayCounts[i] ? t / weekdayCounts[i] : 0)),
  };
}

/** Suggests a unit from a trailing parenthetical, e.g. "Nicotine (mg)" → "mg". */
export function unitFromName(name: string): string | null {
  const m = name.trim().match(/\(([^()]{1,12})\)$/);
  return m ? m[1].trim() : null;
}

export function formatTagAmount(value: number, unit: string | null): string {
  const n = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return unit ? `${n} ${unit}` : n;
}
