import {addDays, dateRange, dayOfWeek, formatMinutes, IsoDate, parseIsoDate, toIsoDate} from '@/lib/dates';
import {Activity, DailyData, Tag, TagEntry} from '@/metrics/types';
import {ScoreHistoryDay} from '@/insights/history';
import {dedupeActivities} from '@/insights/load';
import {Effect, topEffects} from '@/insights/effects';
import {mean, round, sd} from '@/insights/stats';
import {RadarLevel} from '@/insights/vitals';

export type MonthStats = {
  from: IsoDate;
  to: IsoDate;
  readiness: number | null;
  sleepScore: number | null;
  activity: number | null;
  sleepMin: number | null;
  bedtimeSd: number | null;
  steps: number | null;
  restingHr: number | null;
  stress: number | null;
  bodyBatteryHigh: number | null;
  load: number | null;
  weight: number | null;
  workouts: number;
  workoutMin: number;
};

export type MonthTag = {tagId: string; name: string; unit: string | null; total: number; days: number; prevTotal: number};

export type MonthReport = {
  month: IsoDate;
  label: string;
  partial: boolean;
  cur: MonthStats;
  prev: MonthStats;
  highlights: string[];
  /** Average readiness, sleep score and steps by weekday, Monday first. */
  weekday: {readiness: (number | null)[]; sleep: (number | null)[]; steps: (number | null)[]};
  calendar: {date: IsoDate; readiness: number | null; sleep: number | null}[];
  best: {date: IsoDate; value: number} | null;
  worst: {date: IsoDate; value: number} | null;
  tags: MonthTag[];
  strainDays: number;
  helps: Effect[];
  hurts: Effect[];
};

export function monthStart(date: IsoDate): IsoDate {
  const d = parseIsoDate(date);
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function monthEnd(date: IsoDate): IsoDate {
  const d = parseIsoDate(date);
  return toIsoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function shiftMonth(month: IsoDate, by: number): IsoDate {
  const d = parseIsoDate(month);
  return toIsoDate(new Date(d.getFullYear(), d.getMonth() + by, 1));
}

export function monthLabel(month: IsoDate): string {
  return parseIsoDate(month).toLocaleDateString(undefined, {month: 'long', year: 'numeric'});
}

export type MonthInput = {
  today: IsoDate;
  daily: DailyData;
  history: ScoreHistoryDay[];
  loads: Map<IsoDate, number>;
  activities: Activity[];
  tags: Tag[];
  tagEntries: TagEntry[];
  radarHistory?: Map<IsoDate, RadarLevel>;
  effects?: Effect[];
};

function stats(input: MonthInput, from: IsoDate, to: IsoDate): MonthStats {
  const days = dateRange(from, to);
  const vals = (m: keyof DailyData) => days.flatMap((d) => (input.daily[m]?.has(d) ? [input.daily[m]!.get(d)!] : []));
  const avg = (m: keyof DailyData) => mean(vals(m));
  const hist = input.history.filter((h) => h.date >= from && h.date <= to);
  const score = (k: 'readiness' | 'sleep' | 'activity') => mean(hist.flatMap((h) => (h[k] ? [h[k]!.value] : [])));
  const loads = days.flatMap((d) => (input.loads.has(d) ? [input.loads.get(d)!] : []));
  const workouts = dedupeActivities(input.activities).filter((a) => a.date >= from && a.date <= to);
  const bedtimes = vals('sleep_start');
  const r = (v: number | null, dp = 0) => (v == null ? null : round(v, dp));
  return {
    from,
    to,
    readiness: r(score('readiness')),
    sleepScore: r(score('sleep')),
    activity: r(score('activity')),
    sleepMin: r(avg('sleep_total_min')),
    bedtimeSd: bedtimes.length >= 5 ? r(sd(bedtimes)) : null,
    steps: r(avg('steps')),
    restingHr: r(avg('resting_hr'), 1),
    stress: r(avg('stress_avg')),
    bodyBatteryHigh: r(avg('body_battery_high')),
    load: r(mean(loads)),
    weight: r(avg('weight_kg'), 1),
    workouts: workouts.length,
    workoutMin: Math.round(workouts.reduce((a, w) => a + w.durationMin, 0)),
  };
}

type Highlight = {weight: number; text: string};

function highlights(a: MonthStats, b: MonthStats): string[] {
  const out: Highlight[] = [];
  const both = (x: number | null, y: number | null): x is number => x != null && y != null;
  if (both(a.sleepMin, b.sleepMin) && Math.abs(a.sleepMin - b.sleepMin!) >= 10) {
    const diff = a.sleepMin - b.sleepMin!;
    out.push({weight: Math.abs(diff) / 10, text: `You slept ${formatMinutes(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} a night than the month before (${formatMinutes(a.sleepMin)}).`});
  }
  if (both(a.readiness, b.readiness) && Math.abs(a.readiness - b.readiness!) >= 3) {
    const diff = a.readiness - b.readiness!;
    out.push({weight: Math.abs(diff) / 3, text: `Readiness averaged ${a.readiness}, ${Math.abs(diff)} points ${diff > 0 ? 'higher' : 'lower'} than last month.`});
  }
  if (both(a.restingHr, b.restingHr) && Math.abs(a.restingHr - b.restingHr!) >= 1.5) {
    const diff = a.restingHr - b.restingHr!;
    out.push({weight: Math.abs(diff) / 1.5, text: `Resting heart rate ${diff > 0 ? 'rose' : 'fell'} ${round(Math.abs(diff), 1)} bpm to ${a.restingHr} bpm.`});
  }
  if (both(a.steps, b.steps) && b.steps! > 0) {
    const pct = ((a.steps - b.steps!) / b.steps!) * 100;
    if (Math.abs(pct) >= 10) out.push({weight: Math.abs(pct) / 10, text: `You averaged ${Math.round(a.steps).toLocaleString()} steps a day, ${Math.round(Math.abs(pct))}% ${pct > 0 ? 'more' : 'fewer'} than last month.`});
  }
  if (both(a.stress, b.stress) && Math.abs(a.stress - b.stress!) >= 3) {
    const diff = a.stress - b.stress!;
    out.push({weight: Math.abs(diff) / 3, text: `Average stress was ${diff > 0 ? 'up' : 'down'} ${Math.abs(diff)} points.`});
  }
  if (both(a.bedtimeSd, b.bedtimeSd) && Math.abs(a.bedtimeSd - b.bedtimeSd!) >= 10) {
    const diff = a.bedtimeSd - b.bedtimeSd!;
    out.push({weight: Math.abs(diff) / 15, text: `Your bedtime was ${diff < 0 ? 'more' : 'less'} regular, varying by about ${formatMinutes(a.bedtimeSd)}.`});
  }
  if (a.workouts > 0 || b.workouts > 0) {
    const diff = a.workouts - b.workouts;
    out.push({weight: 0.9, text: `${a.workouts} ${a.workouts === 1 ? 'workout' : 'workouts'} (${formatMinutes(a.workoutMin)})${diff ? `, ${Math.abs(diff)} ${diff > 0 ? 'more' : 'fewer'} than last month` : ''}.`});
  }
  if (both(a.weight, b.weight) && Math.abs(a.weight - b.weight!) >= 0.5) {
    const diff = a.weight - b.weight!;
    out.push({weight: 0.8, text: `Weight ${diff > 0 ? 'up' : 'down'} ${round(Math.abs(diff), 1)} kg to ${a.weight} kg.`});
  }
  return out.sort((x, y) => y.weight - x.weight).slice(0, 5).map((h) => h.text);
}

export function computeMonthReport(input: MonthInput, month: IsoDate): MonthReport {
  const from = monthStart(month);
  const fullEnd = monthEnd(month);
  const partial = input.today < fullEnd;
  const to = partial ? input.today : fullEnd;
  const prevFrom = shiftMonth(from, -1);
  // A month in progress is compared with the same number of days at the start of last month.
  const prevTo = partial ? [addDays(prevFrom, Math.max(0, dateRange(from, to).length - 1)), monthEnd(prevFrom)].sort()[0] : monthEnd(prevFrom);
  const cur = stats(input, from, to);
  const prev = stats(input, prevFrom, prevTo);

  const days = input.history.filter((h) => h.date >= from && h.date <= to);
  const byWeekday = (pick: (h: ScoreHistoryDay) => number | null | undefined) => {
    const buckets: number[][] = [[], [], [], [], [], [], []];
    for (const h of days) {
      const v = pick(h);
      if (v != null) buckets[(dayOfWeek(h.date) + 6) % 7].push(v);
    }
    return buckets.map((b) => (b.length ? round(mean(b)!) : null));
  };
  const readinessDays = days.flatMap((h) => (h.readiness ? [{date: h.date, value: h.readiness.value}] : []));
  const best = readinessDays.reduce<{date: IsoDate; value: number} | null>((b, d) => (!b || d.value > b.value ? d : b), null);
  const worst = readinessDays.reduce<{date: IsoDate; value: number} | null>((w, d) => (!w || d.value < w.value ? d : w), null);

  const tagTotals = (tagId: string, a: IsoDate, b: IsoDate) => {
    const list = input.tagEntries.filter((e) => e.tagId === tagId && e.value > 0 && e.date >= a && e.date <= b);
    return {total: list.reduce((s, e) => s + e.value, 0), days: list.length};
  };
  const tags = input.tags
    .map((t) => {
      const c = tagTotals(t.id, from, to);
      return {tagId: t.id, name: t.name, unit: t.unit, total: c.total, days: c.days, prevTotal: tagTotals(t.id, prevFrom, prevTo).total};
    })
    .filter((t) => t.total > 0 || t.prevTotal > 0);

  const strainDays = dateRange(from, to).filter((d) => {
    const level = input.radarHistory?.get(d);
    return level === 'minor' || level === 'major';
  }).length;

  return {
    month: from,
    label: monthLabel(from),
    partial,
    cur,
    prev,
    highlights: highlights(cur, prev),
    weekday: {
      readiness: byWeekday((h) => h.readiness?.value),
      sleep: byWeekday((h) => h.sleep?.value),
      steps: (() => {
        const buckets: number[][] = [[], [], [], [], [], [], []];
        for (const d of dateRange(from, to)) {
          const v = input.daily.steps?.get(d);
          if (v != null) buckets[(dayOfWeek(d) + 6) % 7].push(v);
        }
        return buckets.map((b) => (b.length ? Math.round(mean(b)!) : null));
      })(),
    },
    calendar: dateRange(from, fullEnd).map((date) => {
      const h = input.history.find((x) => x.date === date);
      return {date, readiness: h?.readiness?.value ?? null, sleep: h?.sleep?.value ?? null};
    }),
    best,
    worst,
    tags,
    strainDays,
    helps: topEffects(input.effects ?? [], {good: true, limit: 3}),
    hurts: topEffects(input.effects ?? [], {good: false, limit: 3}),
  };
}
