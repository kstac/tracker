import {addDays, daysBetween, IsoDate, parseIsoDate} from '@/lib/dates';
import {Activity, DailyData, StatusKind} from '@/metrics/types';
import {InsightSettings, ReadinessAction, Sex} from '@/insights/types';
import {windowValues} from '@/insights/baseline';
import {mean, median, quantile, round} from '@/insights/stats';

export const ACUTE_DAYS = 7;
export const CHRONIC_DAYS = 28;
const ATL_DAYS = 7;
const CTL_DAYS = 42;
const MIN_DAYS_FOR_STATUS = 21;
const DEFAULT_MAX_HR = 185;
const DEFAULT_RESTING_HR = 60;

/** Rough load per minute for activities without heart rate, on the same scale as TRIMP. */
const LOAD_PER_MIN: Record<string, number> = {
  walking: 0.5,
  hiking: 0.8,
  running: 1.3,
  treadmill_running: 1.3,
  trail_running: 1.4,
  cycling: 1.0,
  indoor_cycling: 1.0,
  swimming: 1.1,
  strength_training: 0.7,
  hiit: 1.4,
  yoga: 0.3,
  pilates: 0.4,
  stretching: 0.2,
  breathwork: 0.1,
};

export type HrProfile = {restingHr: number; maxHr: number; maxHrSource: 'setting' | 'observed' | 'age' | 'default'; sex: Sex | null};

export function hrProfile(daily: DailyData, today: IsoDate, settings: InsightSettings = {}): HrProfile {
  const rests = windowValues(daily.resting_hr, today, 30);
  const restingHr = median(rests) ?? DEFAULT_RESTING_HR;
  const sex = settings.sex ?? null;
  if (settings.maxHr) return {restingHr, maxHr: settings.maxHr, maxHrSource: 'setting', sex};
  const age = settings.birthYear ? parseIsoDate(today).getFullYear() - settings.birthYear : null;
  const agePredicted = age != null && age > 10 && age < 100 ? Math.round(208 - 0.7 * age) : null;
  const highs = windowValues(daily.hr_max, today, 365).filter((v) => v > 100 && v < 225);
  const observed = highs.length >= 14 ? Math.round(quantile(highs, 0.98)!) : null;
  if (observed != null && observed > (agePredicted ?? DEFAULT_MAX_HR)) return {restingHr, maxHr: observed, maxHrSource: 'observed', sex};
  if (agePredicted != null) return {restingHr, maxHr: agePredicted, maxHrSource: 'age', sex};
  return {restingHr, maxHr: DEFAULT_MAX_HR, maxHrSource: 'default', sex};
}

/** Banister TRIMP: minutes weighted by how far average heart rate sits between resting and max. */
export function trimp(durationMin: number, avgHr: number, profile: HrProfile): number {
  const reserve = profile.maxHr - profile.restingHr;
  if (reserve <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, (avgHr - profile.restingHr) / reserve));
  const [a, b] = profile.sex === 'female' ? [0.86, 1.67] : [0.64, 1.92];
  return durationMin * ratio * a * Math.exp(b * ratio);
}

export function activityLoad(a: Activity, profile: HrProfile): number {
  if (a.avgHr != null && a.avgHr > profile.restingHr) return round(trimp(a.durationMin, a.avgHr, profile), 1);
  return round(a.durationMin * (LOAD_PER_MIN[a.type] ?? 0.8), 1);
}

/**
 * Garmin's workouts also appear in Health Connect, and several apps can record the same session, so overlapping
 * sessions are kept once, preferring Garmin's copy.
 */
export function dedupeActivities(activities: Activity[]): Activity[] {
  const overlaps = (a: Activity, b: Activity) => {
    const aEnd = a.startTs + a.durationMin * 60_000;
    const bEnd = b.startTs + b.durationMin * 60_000;
    const overlap = Math.min(aEnd, bEnd) - Math.max(a.startTs, b.startTs);
    return overlap > 0.5 * Math.min(a.durationMin, b.durationMin) * 60_000;
  };
  const ordered = [...activities].sort((a, b) => (a.source === 'garmin' ? 0 : 1) - (b.source === 'garmin' ? 0 : 1) || a.startTs - b.startTs);
  const kept: Activity[] = [];
  for (const a of ordered) {
    if (a.source === 'garmin' || !kept.some((k) => overlaps(a, k))) kept.push(a);
  }
  return kept.sort((a, b) => a.startTs - b.startTs);
}

/**
 * Training load per day. Garmin intensity minutes (vigorous counted double) land on roughly the same scale as TRIMP,
 * so the larger of the two is used: workouts get their heart-rate load, and short bursts outside workouts still count.
 * Days with no data at all (watch off, sync gap) are left out rather than counted as rest.
 */
export function dailyLoads(daily: DailyData, activities: Activity[], profile: HrProfile, today: IsoDate): Map<IsoDate, number> {
  const fromActivities = new Map<IsoDate, number>();
  for (const a of dedupeActivities(activities)) fromActivities.set(a.date, (fromActivities.get(a.date) ?? 0) + activityLoad(a, profile));

  const dates = new Set<IsoDate>([...fromActivities.keys()]);
  for (const m of ['intensity_min', 'exercise_min', 'steps'] as const) daily[m]?.forEach((_, d) => dates.add(d));
  const out = new Map<IsoDate, number>();
  for (const d of [...dates].filter((x) => x <= today).sort()) {
    const minutes = daily.intensity_min?.get(d) ?? daily.exercise_min?.get(d) ?? 0;
    out.set(d, round(Math.max(fromActivities.get(d) ?? 0, minutes), 1));
  }
  return out;
}

export type LoadDay = {date: IsoDate; load: number; fitness: number; fatigue: number; form: number; acwr: number | null};

export type LoadStatus = 'calibrating' | 'overreaching' | 'high' | 'building' | 'maintaining' | 'recovering' | 'detraining';

export type FormZone = 'transition' | 'fresh' | 'grey' | 'optimal' | 'high_risk';

export type LoadTarget = {low: number; high: number; reason: string};

export type LoadReport = {
  days: LoadDay[];
  today: LoadDay | null;
  status: LoadStatus;
  statusText: string;
  formZone: FormZone | null;
  /** Form as a percentage of fitness, the basis for the zone. */
  formPct: number | null;
  acute: number | null;
  chronic: number | null;
  weekLoad: number;
  prevWeekLoad: number;
  target: LoadTarget | null;
  profile: HrProfile;
};

export const STATUS_TEXT: Record<LoadStatus, string> = {
  calibrating: 'Needs about 3 weeks of data to judge your training load.',
  overreaching: 'Your load this week is far above what you are used to, which raises injury and illness risk.',
  high: 'Your load this week is well above your usual. Fine for a short push, but plan some easier days.',
  building: 'You are steadily building fitness at a sustainable rate.',
  maintaining: 'Your training is steady and in line with what you are used to.',
  recovering: 'This week is lighter than usual, which lets your body recover.',
  detraining: 'Your load has been low for a while, so fitness is starting to slip.',
};

export const FORM_ZONE_TEXT: Record<FormZone, {label: string; detail: string}> = {
  transition: {label: 'Very fresh', detail: 'Well rested, but you may be losing fitness if this lasts.'},
  fresh: {label: 'Fresh', detail: 'Rested and ready for a hard effort.'},
  grey: {label: 'Neutral', detail: 'Neither tired nor especially fresh.'},
  optimal: {label: 'Productive', detail: 'Tired in the way that builds fitness.'},
  high_risk: {label: 'Overloaded', detail: 'Carrying a lot of fatigue. Ease off soon.'},
};

export function formZoneFor(formPct: number): FormZone {
  if (formPct > 25) return 'transition';
  if (formPct > 5) return 'fresh';
  if (formPct > -10) return 'grey';
  if (formPct > -30) return 'optimal';
  return 'high_risk';
}

/** Multiples of your usual daily load that suit today, by readiness. */
const TARGET_RANGES: Record<ReadinessAction, [number, number]> = {
  go: [0.9, 1.6],
  ready: [0.7, 1.2],
  pace: [0.4, 0.8],
  recover: [0, 0.4],
};

const roundTo5 = (v: number) => Math.round(v / 5) * 5;

export function loadTarget(chronic: number, action: ReadinessAction | null, status: StatusKind | null): LoadTarget | null {
  if (chronic <= 0) return null;
  const base = Math.max(15, chronic);
  if (status === 'sick' || status === 'injured') {
    return {low: 0, high: roundTo5(base * 0.3), reason: status === 'sick' ? 'You are marked as sick, so keep it to gentle movement.' : 'You are marked as injured, so keep it light.'};
  }
  if (!action) return null;
  const [lo, hi] = TARGET_RANGES[action];
  const reason = {
    go: 'You are well recovered, so a hard session suits today.',
    ready: 'A normal training day suits you today.',
    pace: 'Recovery is a little low, so keep the effort moderate.',
    recover: 'Your body needs rest, so stick to light movement.',
  }[action];
  return {low: roundTo5(base * lo), high: Math.max(5, roundTo5(base * hi)), reason};
}

export function computeLoad(
  daily: DailyData,
  activities: Activity[],
  today: IsoDate,
  settings: InsightSettings = {},
  action: ReadinessAction | null = null,
  userStatus: StatusKind | null = null,
): LoadReport {
  const profile = hrProfile(daily, today, settings);
  const loads = dailyLoads(daily, activities, profile, today);
  const days: LoadDay[] = [];
  const series = [...loads.entries()];
  // Starting from zero would read the first weeks as a huge build-up, so seed both averages with the early mean.
  const seed = mean(series.slice(0, CHRONIC_DAYS).map(([, v]) => v)) ?? 0;
  let fitness = seed;
  let fatigue = seed;
  const kFit = 1 - Math.exp(-1 / CTL_DAYS);
  const kFat = 1 - Math.exp(-1 / ATL_DAYS);
  const windowMean = (end: IsoDate, n: number) => {
    const vals: number[] = [];
    for (let i = 0; i < n; i++) {
      const v = loads.get(addDays(end, -i));
      if (v != null) vals.push(v);
    }
    return vals.length ? {mean: mean(vals)!, n: vals.length} : null;
  };
  const first = series[0]?.[0];
  for (const [date, load] of series) {
    fitness += (load - fitness) * kFit;
    fatigue += (load - fatigue) * kFat;
    const acute = windowMean(date, ACUTE_DAYS);
    const chronic = windowMean(date, CHRONIC_DAYS);
    const enoughHistory = first != null && daysBetween(first, date) + 1 >= MIN_DAYS_FOR_STATUS && (chronic?.n ?? 0) >= 14;
    const acwr = enoughHistory && acute && chronic && chronic.mean > 0 ? acute.mean / chronic.mean : null;
    days.push({date, load, fitness: round(fitness, 1), fatigue: round(fatigue, 1), form: round(fitness - fatigue, 1), acwr: acwr == null ? null : round(acwr, 2)});
  }

  const todayDay = days.at(-1)?.date === today ? days.at(-1)! : null;
  // Today is still in progress (near zero in the morning), so status, form and targets are judged on the last full day.
  const ref = days.filter((d) => d.date < today).at(-1) ?? null;
  const sum = (from: IsoDate, to: IsoDate) => days.filter((d) => d.date >= from && d.date <= to).reduce((a, d) => a + d.load, 0);
  const weekLoad = round(sum(addDays(today, -6), today));
  const prevWeekLoad = round(sum(addDays(today, -13), addDays(today, -7)));

  const enough = ref?.acwr != null;
  const acute = enough ? round(windowMean(ref!.date, ACUTE_DAYS)!.mean, 1) : null;
  const chronic = enough ? round(windowMean(ref!.date, CHRONIC_DAYS)!.mean, 1) : null;

  let status: LoadStatus = 'calibrating';
  if (enough && ref) {
    const acwr = ref.acwr!;
    const fitnessAgo = (n: number) => days.filter((d) => d.date <= addDays(ref.date, -n)).at(-1)?.fitness ?? null;
    const fourWeeksAgo = fitnessAgo(28);
    const twoWeeksAgo = fitnessAgo(14);
    if (acwr > 1.5) status = 'overreaching';
    else if (acwr > 1.3) status = 'high';
    else if (acwr >= 0.8) status = twoWeeksAgo != null && twoWeeksAgo > 0 && ref.fitness > twoWeeksAgo * 1.1 ? 'building' : 'maintaining';
    else status = fourWeeksAgo != null && fourWeeksAgo > 0 && ref.fitness < fourWeeksAgo * 0.8 ? 'detraining' : 'recovering';
  }

  const formPct = enough && ref && ref.fitness > 1 ? round((ref.form / ref.fitness) * 100) : null;
  return {
    days,
    today: todayDay,
    status,
    statusText: STATUS_TEXT[status],
    formZone: formPct == null ? null : formZoneFor(formPct),
    formPct,
    acute,
    chronic,
    weekLoad,
    prevWeekLoad,
    target: chronic != null ? loadTarget(chronic, action, userStatus) : null,
    profile,
  };
}
