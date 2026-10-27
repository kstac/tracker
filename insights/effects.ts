import {addDays, dateRange, dayOfWeek, IsoDate, isWeekend} from '@/lib/dates';
import {formatMetricValue} from '@/lib/format';
import {METRIC_BY_ID} from '@/metrics/registry';
import {Activity, DailyData, MetricId, StatusPeriod, Tag, TagEntry} from '@/metrics/types';
import {dedupeActivities} from '@/insights/load';
import {benjaminiHochberg, cohensD, jaccard, mean, median, ols, quantile, round, tCritical95, tPValue, welch} from '@/insights/stats';

export const MIN_GROUP_SIZE = 5;
const MIN_EFFECT_SIZE = 0.3;
const MAX_TAG_CONFOUNDERS = 6;
const OVERLAP_SEPARATE = 0.8;
const OVERLAP_REPORT = 0.6;
const LATE_HOURS = 4;
const WINDOW_DAYS = 365;

export type TargetMetric = MetricId | 'sleep_score' | 'readiness';

export type EffectTarget = {key: string; metric: TargetMetric; lag: 0 | 1 | 2; label: string; phrase: string};

/** Sleep and overnight metrics are dated by wake-up day, so a factor on day D lines up with the night ending on D+1. */
export const EFFECT_TARGETS: EffectTarget[] = [
  {key: 'sleep_score@1', metric: 'sleep_score', lag: 1, label: 'Sleep score', phrase: 'your sleep score that night'},
  {key: 'sleep_total_min@1', metric: 'sleep_total_min', lag: 1, label: 'Total sleep', phrase: 'your sleep that night'},
  {key: 'resting_hr@1', metric: 'resting_hr', lag: 1, label: 'Resting heart rate', phrase: 'your resting heart rate that night'},
  {key: 'hrv_overnight@1', metric: 'hrv_overnight', lag: 1, label: 'Overnight HRV', phrase: 'your overnight HRV'},
  {key: 'sleep_stress@1', metric: 'sleep_stress', lag: 1, label: 'Overnight stress', phrase: 'your overnight stress'},
  {key: 'body_battery_wake@1', metric: 'body_battery_wake', lag: 1, label: 'Body Battery at wake', phrase: 'your Body Battery the next morning'},
  {key: 'readiness@1', metric: 'readiness', lag: 1, label: 'Readiness', phrase: 'your readiness the next morning'},
  {key: 'checkin_energy@1', metric: 'checkin_energy', lag: 1, label: 'Energy', phrase: 'how energetic you feel the next morning'},
  {key: 'sleep_score@2', metric: 'sleep_score', lag: 2, label: 'Sleep score', phrase: 'your sleep score two nights later'},
  {key: 'resting_hr@2', metric: 'resting_hr', lag: 2, label: 'Resting heart rate', phrase: 'your resting heart rate two nights later'},
  {key: 'body_battery_wake@2', metric: 'body_battery_wake', lag: 2, label: 'Body Battery at wake', phrase: 'your Body Battery two mornings later'},
  {key: 'readiness@2', metric: 'readiness', lag: 2, label: 'Readiness', phrase: 'your readiness two days later'},
  {key: 'stress_avg@0', metric: 'stress_avg', lag: 0, label: 'Average stress', phrase: 'your stress that day'},
  {key: 'steps@0', metric: 'steps', lag: 0, label: 'Steps', phrase: 'your steps that day'},
  {key: 'checkin_mood@0', metric: 'checkin_mood', lag: 0, label: 'Mood', phrase: 'your mood that day'},
];

type Confounder = 'weekend' | 'load' | 'prevSleep';

export type Factor = {
  id: string;
  name: string;
  kind: 'tag' | 'auto';
  /** Opens the summary sentence, e.g. "After you log Alcohol". */
  lead: string;
  description?: string;
  present: Set<IsoDate>;
  /** Days that count as either "with" or "without". */
  eligible: Set<IsoDate>;
  amounts?: Map<IsoDate, number>;
  unit?: string | null;
  times?: Map<IsoDate, number>;
  excludeTargets?: string[];
  excludeConfounders?: Confounder[];
};

export type Confidence = 'strong' | 'likely' | 'possible' | 'none';

export type DoseBucket = {label: string; mean: number; n: number};

export type TimingSplit = {thresholdHours: number; lateMean: number; earlyMean: number; nLate: number; nEarly: number};

export type Effect = {
  factorId: string;
  factorName: string;
  factorKind: 'tag' | 'auto';
  targetKey: string;
  metric: TargetMetric;
  targetLabel: string;
  lag: 0 | 1 | 2;
  withMean: number;
  withoutMean: number;
  rawDiff: number;
  /** After accounting for weekends, training load, the previous night's sleep and other tags. */
  adjustedDiff: number | null;
  /** The headline difference: adjusted when there was enough data, otherwise raw. */
  diff: number;
  pct: number | null;
  ciLow: number;
  ciHigh: number;
  p: number;
  q: number;
  cohensD: number;
  nWith: number;
  nWithout: number;
  confidence: Confidence;
  /** Whether the change is for the better; null when neither direction is better. */
  good: boolean | null;
  summary: string;
  dose: DoseBucket[] | null;
  timing: TimingSplit | null;
  /** Tags logged on almost the same days, so their effects can't be told apart. */
  sharedWith: string[];
};

export type FactorProgress = {factorId: string; nWith: number; nWithout: number; withNeeded: number; withoutNeeded: number};

export type Overlap = {a: string; b: string; aName: string; bName: string; jaccard: number};

export type EffectsReport = {effects: Effect[]; progress: FactorProgress[]; overlaps: Overlap[]; factors: Factor[]};

export type EffectsInput = {
  today: IsoDate;
  daily: DailyData;
  sleepScores: Map<IsoDate, number>;
  readiness: Map<IsoDate, number>;
  tags: Tag[];
  tagEntries: TagEntry[];
  loads?: Map<IsoDate, number>;
  activities?: Activity[];
  statuses?: StatusPeriod[];
  onlyJournaledDays?: boolean;
};

export function targetHigherIsBetter(metric: TargetMetric): boolean | null {
  if (metric === 'sleep_score' || metric === 'readiness') return true;
  return METRIC_BY_ID[metric].higherIsBetter;
}

function targetSeries(input: EffectsInput, metric: TargetMetric): Map<IsoDate, number> | undefined {
  if (metric === 'readiness') return input.readiness.size ? input.readiness : undefined;
  if (metric !== 'sleep_score') return input.daily[metric];
  const merged = new Map(input.daily.garmin_sleep_score ?? []);
  input.sleepScores.forEach((v, d) => merged.set(d, v));
  return merged.size > 0 ? merged : undefined;
}

export function describeDiff(metric: TargetMetric, diff: number): string {
  if (metric === 'sleep_score' || metric === 'readiness') {
    const n = Math.round(Math.abs(diff));
    return `${n} ${n === 1 ? 'point' : 'points'} ${diff > 0 ? 'higher' : 'lower'}`;
  }
  const def = METRIC_BY_ID[metric];
  if (def.min != null) return `${round(Math.abs(diff), 1)} ${diff > 0 ? 'higher' : 'lower'} out of 5`;
  const amount = formatMetricValue(def, Math.abs(diff));
  if (def.format === 'duration') return `${amount} ${diff > 0 ? 'longer' : 'shorter'}`;
  return `${amount} ${diff > 0 ? 'higher' : 'lower'}`;
}

function sickDays(statuses: StatusPeriod[] | undefined, today: IsoDate): Set<IsoDate> {
  const out = new Set<IsoDate>();
  for (const s of statuses ?? []) {
    if (s.kind !== 'sick' && s.kind !== 'injured') continue;
    for (const d of dateRange(s.start, s.end ?? today)) out.add(d);
  }
  return out;
}

export function tagFactors(input: EffectsInput): Factor[] {
  const {today} = input;
  const windowStart = addDays(today, -WINDOW_DAYS);
  const journaled = new Set<IsoDate>(input.tagEntries.filter((e) => e.value > 0).map((e) => e.date));
  for (const m of ['checkin_energy', 'checkin_mood', 'checkin_soreness'] as const) input.daily[m]?.forEach((_, d) => journaled.add(d));
  const sick = sickDays(input.statuses, today);

  const out: Factor[] = [];
  for (const tag of input.tags) {
    const entries = input.tagEntries.filter((e) => e.tagId === tag.id && e.value > 0);
    if (!entries.length) continue;
    const first = entries.reduce((min, e) => (e.date < min ? e.date : min), entries[0].date);
    const from = first > windowStart ? first : windowStart;
    const eligible = new Set(
      dateRange(from, today).filter((d) => !sick.has(d) && (!input.onlyJournaledDays || journaled.has(d))),
    );
    const amounts = new Map(entries.map((e) => [e.date, e.value]));
    const times = new Map(entries.filter((e) => e.timeMin != null).map((e) => [e.date, e.timeMin!]));
    out.push({
      id: tag.id,
      name: tag.name,
      kind: 'tag',
      lead: `After you log ${tag.name}`,
      present: new Set(entries.map((e) => e.date).filter((d) => eligible.has(d))),
      eligible,
      amounts,
      unit: tag.unit,
      times,
    });
  }
  return out;
}

export type AutoFactorId =
  | 'workout' | 'hard_day' | 'active_day' | 'low_activity' | 'stressful_day' | 'late_bed' | 'early_bed' | 'short_night' | 'nap' | 'weekend';

/** Patterns detected from your data, with no logging needed. Thresholds are personal (your own quartiles). */
export function autoFactors(input: EffectsInput): Factor[] {
  const {daily, today} = input;
  const windowStart = addDays(today, -WINDOW_DAYS);
  const sick = sickDays(input.statuses, today);
  const inWindow = (d: IsoDate) => d > windowStart && d <= today && !sick.has(d);
  const out: Factor[] = [];
  const add = (f: Omit<Factor, 'kind'>) => {
    if (f.present.size >= 1) out.push({...f, kind: 'auto'});
  };

  const loads = input.loads ?? new Map();
  // Readiness already scores the previous day's activity, stress and sleep, so these factors would "affect" it by construction.
  const circular = ['readiness@1', 'readiness@2'];
  const activityMin = new Map<IsoDate, number>();
  for (const a of dedupeActivities(input.activities ?? [])) activityMin.set(a.date, (activityMin.get(a.date) ?? 0) + a.durationMin);
  const loadDays = [...loads.keys()].filter(inWindow);
  if (loadDays.length) {
    add({
      id: 'workout', name: 'Workout days', lead: 'On workout days', description: 'Days with at least 20 minutes of exercise or a training load of 25+.',
      present: new Set(loadDays.filter((d) => (loads.get(d) ?? 0) >= 25 || (activityMin.get(d) ?? 0) >= 20)),
      eligible: new Set(loadDays), excludeTargets: ['steps@0', ...circular], excludeConfounders: ['load'],
    });
    const hard = new Set<IsoDate>();
    for (const d of loadDays) {
      const prior: number[] = [];
      for (let i = 1; i <= 28; i++) {
        const v = loads.get(addDays(d, -i));
        if (v != null) prior.push(v);
      }
      if (prior.length < 14) continue;
      const load = loads.get(d) ?? 0;
      if (load >= Math.max(50, 1.6 * mean(prior)!)) hard.add(d);
    }
    add({
      id: 'hard_day', name: 'Hard training days', lead: 'After a hard training day', description: 'Days with much more training load than your recent average.',
      present: hard, eligible: new Set(loadDays), excludeTargets: ['steps@0', ...circular], excludeConfounders: ['load'],
    });
  }

  const quartileFactor = (
    metric: MetricId, id: AutoFactorId, name: string, lead: string, description: string, high: boolean, exclude: string[], confounders: Confounder[],
  ) => {
    const days = [...(daily[metric]?.keys() ?? [])].filter(inWindow);
    if (days.length < 28) return;
    const values = days.map((d) => daily[metric]!.get(d)!);
    const cut = quantile(values, high ? 0.75 : 0.25)!;
    add({
      id, name, lead, description,
      present: new Set(days.filter((d) => (high ? daily[metric]!.get(d)! >= cut : daily[metric]!.get(d)! <= cut))),
      eligible: new Set(days), excludeTargets: [...exclude, ...circular], excludeConfounders: confounders,
    });
  };
  quartileFactor('steps', 'active_day', 'High-step days', 'On your most active days', 'Your top quarter of days by steps.', true, ['steps@0'], ['load']);
  quartileFactor('steps', 'low_activity', 'Low-step days', 'On your least active days', 'Your bottom quarter of days by steps.', false, ['steps@0'], ['load']);
  quartileFactor('stress_avg', 'stressful_day', 'Stressful days', 'On your most stressful days', 'Your top quarter of days by average stress.', true, ['stress_avg@0'], []);

  const starts = daily.sleep_start;
  if (starts && starts.size >= 28) {
    const nights = [...starts.keys()].map((wake) => addDays(wake, -1)).filter(inWindow);
    const usual = median(nights.map((d) => starts.get(addDays(d, 1))!))!;
    add({
      id: 'late_bed', name: 'Late nights', lead: 'When you go to sleep late', description: 'Nights you fell asleep 45+ minutes later than usual.',
      present: new Set(nights.filter((d) => starts.get(addDays(d, 1))! >= usual + 45)), eligible: new Set(nights),
    });
    add({
      id: 'early_bed', name: 'Early nights', lead: 'When you go to sleep early', description: 'Nights you fell asleep 45+ minutes earlier than usual.',
      present: new Set(nights.filter((d) => starts.get(addDays(d, 1))! <= usual - 45)), eligible: new Set(nights),
    });
  }

  const asleep = daily.sleep_total_min;
  if (asleep && asleep.size >= 28) {
    const days = [...asleep.keys()].filter(inWindow);
    add({
      id: 'short_night', name: 'After a short night', lead: 'After a short night', description: 'Days after you slept less than 6.5 hours.',
      present: new Set(days.filter((d) => asleep.get(d)! < 390)), eligible: new Set(days), excludeConfounders: ['prevSleep'],
      excludeTargets: ['sleep_score@2', 'resting_hr@2', 'body_battery_wake@2', ...circular],
    });
  }

  // Garmin may only report nap time on days with a nap, so any day with sleep data counts as a possible nap day.
  const naps = daily.nap_min;
  if (naps && naps.size >= MIN_GROUP_SIZE && daily.sleep_total_min) {
    const days = [...daily.sleep_total_min.keys()].filter(inWindow);
    add({
      id: 'nap', name: 'Naps', lead: 'On days you nap', description: 'Days with at least 10 minutes of napping.',
      present: new Set(days.filter((d) => (naps.get(d) ?? 0) >= 10)), eligible: new Set(days),
    });
  }

  const allDays = [...(daily.sleep_total_min?.keys() ?? [])].map((d) => addDays(d, -1)).filter(inWindow);
  if (allDays.length >= 28) {
    add({
      id: 'weekend', name: 'Friday and Saturday nights', lead: 'On Friday and Saturday nights', description: 'The nights before a weekend day.',
      present: new Set(allDays.filter((d) => dayOfWeek(d) === 5 || dayOfWeek(d) === 6)), eligible: new Set(allDays),
      excludeConfounders: ['weekend'], excludeTargets: ['stress_avg@0', 'steps@0', 'checkin_mood@0'],
    });
  }
  return out;
}

type Row = {date: IsoDate; y: number; x: number};

function doseBuckets(factor: Factor, rows: Row[]): DoseBucket[] | null {
  if (!factor.amounts) return null;
  const withRows = rows.filter((r) => r.x === 1 && factor.amounts!.has(r.date));
  const amounts = withRows.map((r) => factor.amounts!.get(r.date)!);
  if (new Set(amounts).size < 2) return null;
  let cut = median(amounts)!;
  if (!amounts.some((a) => a > cut)) cut = Math.max(...amounts.filter((a) => a < cut));
  const low = withRows.filter((r) => factor.amounts!.get(r.date)! <= cut);
  const high = withRows.filter((r) => factor.amounts!.get(r.date)! > cut);
  const none = rows.filter((r) => r.x === 0);
  if (low.length < 3 || high.length < 3) return null;
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const unit = factor.unit ? ` ${factor.unit}` : '';
  return [
    {label: 'None', mean: round(mean(none.map((r) => r.y))!, 1), n: none.length},
    {label: `Up to ${fmt(cut)}${unit}`, mean: round(mean(low.map((r) => r.y))!, 1), n: low.length},
    {label: `More than ${fmt(cut)}${unit}`, mean: round(mean(high.map((r) => r.y))!, 1), n: high.length},
  ];
}

function timingSplit(factor: Factor, rows: Row[], daily: DailyData): TimingSplit | null {
  if (!factor.times?.size) return null;
  const late: number[] = [];
  const early: number[] = [];
  for (const r of rows) {
    if (r.x !== 1) continue;
    const time = factor.times.get(r.date);
    const bed = daily.sleep_start?.get(addDays(r.date, 1));
    if (time == null || bed == null) continue;
    const hoursBefore = (bed - (time - 1440)) / 60;
    (hoursBefore < LATE_HOURS ? late : early).push(r.y);
  }
  if (late.length < 3 || early.length < 3) return null;
  return {thresholdHours: LATE_HOURS, lateMean: round(mean(late)!, 1), earlyMean: round(mean(early)!, 1), nLate: late.length, nEarly: early.length};
}

type Candidate = Omit<Effect, 'q' | 'confidence' | 'summary'>;

function analyse(input: EffectsInput, factor: Factor, target: EffectTarget, tagFactorList: Factor[]): Candidate | null {
  if (factor.excludeTargets?.includes(target.key)) return null;
  const series = targetSeries(input, target.metric);
  if (!series) return null;

  const rows: Row[] = [];
  for (const d of factor.eligible) {
    const y = series.get(addDays(d, target.lag));
    if (y == null) continue;
    rows.push({date: d, y, x: factor.present.has(d) ? 1 : 0});
  }
  const withY = rows.filter((r) => r.x === 1).map((r) => r.y);
  const withoutY = rows.filter((r) => r.x === 0).map((r) => r.y);
  if (withY.length < MIN_GROUP_SIZE || withoutY.length < MIN_GROUP_SIZE) return null;
  const raw = welch(withY, withoutY);
  const d = cohensD(withY, withoutY);
  if (!raw || d == null) return null;

  const exclude = new Set(factor.excludeConfounders ?? []);
  const columns: {name: string; values: (number | null)[]}[] = [];
  if (!exclude.has('weekend')) columns.push({name: 'weekend', values: rows.map((r) => (isWeekend(addDays(r.date, target.lag)) ? 1 : 0))});
  if (!exclude.has('load') && input.loads?.size) columns.push({name: 'load', values: rows.map((r) => input.loads!.get(r.date) ?? null)});
  if (!exclude.has('prevSleep') && target.lag > 0 && input.daily.sleep_total_min) {
    columns.push({name: 'prevSleep', values: rows.map((r) => input.daily.sleep_total_min!.get(r.date) ?? null)});
  }
  if (target.lag === 2) columns.push({name: 'nextDay', values: rows.map((r) => (factor.present.has(addDays(r.date, 1)) ? 1 : 0))});

  const sharedWith: string[] = [];
  const others = tagFactorList
    .filter((t) => t.id !== factor.id)
    .map((t) => ({t, n: rows.filter((r) => t.present.has(r.date)).length}))
    .filter((o) => o.n >= MIN_GROUP_SIZE)
    .sort((a, b) => b.n - a.n);
  let added = 0;
  for (const {t} of others) {
    if (factor.kind === 'tag' && jaccard(factor.present, t.present) >= OVERLAP_SEPARATE) {
      sharedWith.push(t.name);
      continue;
    }
    if (added++ >= MAX_TAG_CONFOUNDERS) break;
    columns.push({name: `tag:${t.id}`, values: rows.map((r) => (t.present.has(r.date) ? 1 : 0))});
  }

  let adjustedDiff: number | null = null;
  let adjSe: number | null = null;
  let adjDf = 0;
  const usable = columns
    .map((c) => {
      const known = c.values.filter((v): v is number => v != null);
      const m = mean(known) ?? 0;
      return {name: c.name, values: c.values.map((v) => v ?? m)};
    })
    .filter((c) => new Set(c.values).size > 1);
  if (rows.length >= usable.length + 2 + 10) {
    const X = rows.map((r, i) => [1, r.x, ...usable.map((c) => c.values[i])]);
    const fit = ols(X, rows.map((r) => r.y));
    if (fit && Number.isFinite(fit.se[1]) && fit.se[1] > 0) {
      adjustedDiff = fit.beta[1];
      adjSe = fit.se[1];
      adjDf = fit.df;
    }
  }

  const diff = adjustedDiff ?? raw.diff;
  let p = raw.p;
  let ciLow = raw.ciLow;
  let ciHigh = raw.ciHigh;
  if (adjustedDiff != null && adjSe != null) {
    const t = tCritical95(adjDf);
    p = tPValue(adjustedDiff / adjSe, adjDf);
    ciLow = adjustedDiff - t * adjSe;
    ciHigh = adjustedDiff + t * adjSe;
  }
  const withoutMean = mean(withoutY)!;
  const higher = targetHigherIsBetter(target.metric);
  const isTag = factor.kind === 'tag';
  return {
    factorId: factor.id,
    factorName: factor.name,
    factorKind: factor.kind,
    targetKey: target.key,
    metric: target.metric,
    targetLabel: target.label,
    lag: target.lag,
    withMean: round(mean(withY)!, 2),
    withoutMean: round(withoutMean, 2),
    rawDiff: round(raw.diff, 2),
    adjustedDiff: adjustedDiff == null ? null : round(adjustedDiff, 2),
    diff: round(diff, 2),
    pct: withoutMean > 0 ? round((diff / withoutMean) * 100) : null,
    ciLow: round(ciLow, 2),
    ciHigh: round(ciHigh, 2),
    p,
    cohensD: round(d, 2),
    nWith: withY.length,
    nWithout: withoutY.length,
    good: higher == null || Math.abs(diff) < 1e-9 ? null : (diff > 0) === higher,
    dose: isTag && target.lag <= 1 ? doseBuckets(factor, rows) : null,
    timing: isTag && target.lag === 1 ? timingSplit(factor, rows, input.daily) : null,
    sharedWith,
  };
}

/** The smallest change worth acting on, so a statistically solid but tiny difference isn't called a pattern. */
export const MEANINGFUL_CHANGE: Partial<Record<TargetMetric, number>> = {
  sleep_score: 3,
  readiness: 3,
  sleep_total_min: 10,
  resting_hr: 1.5,
  hrv_overnight: 3,
  sleep_stress: 2,
  body_battery_wake: 4,
  checkin_energy: 0.3,
  checkin_mood: 0.3,
  stress_avg: 2,
  steps: 800,
};

function confidenceFor(c: Candidate, q: number): Confidence {
  // Size is judged on the headline (adjusted) difference, scaled by the same spread as Cohen's d.
  const size = c.rawDiff !== 0 ? Math.abs(c.cohensD * (c.diff / c.rawDiff)) : Math.abs(c.cohensD);
  if (size < MIN_EFFECT_SIZE) return 'none';
  if (Math.abs(c.diff) < (MEANINGFUL_CHANGE[c.metric] ?? 0)) return 'none';
  // Hundreds of comparisons are run, so the labels that get surfaced use false-discovery-adjusted q-values.
  if (q < 0.05 && c.nWith >= 8) return 'strong';
  if (q < 0.2) return 'likely';
  if (c.p < 0.05) return 'possible';
  return 'none';
}

const CONFIDENCE_RANK: Record<Confidence, number> = {strong: 3, likely: 2, possible: 1, none: 0};

export function summarise(lead: string, target: {metric: TargetMetric; phrase: string}, diff: number, pct: number | null): string {
  const pctText = pct != null && Math.abs(pct) >= 1 && target.metric !== 'sleep_score' && target.metric !== 'readiness' ? ` (${pct > 0 ? '+' : '−'}${Math.abs(pct)}%)` : '';
  return `${lead}, ${target.phrase} tends to be ${describeDiff(target.metric, diff)}${pctText}.`;
}

export function computeEffects(input: EffectsInput): EffectsReport {
  const tagList = tagFactors(input);
  const factors = [...tagList, ...autoFactors(input)];
  const candidates: Candidate[] = [];
  for (const factor of factors) {
    for (const target of EFFECT_TARGETS) {
      const c = analyse(input, factor, target, tagList);
      if (c) candidates.push(c);
    }
  }
  const qs = benjaminiHochberg(candidates.map((c) => c.p));
  const effects: Effect[] = candidates.map((c, i) => {
    const target = EFFECT_TARGETS.find((t) => t.key === c.targetKey)!;
    const factor = factors.find((f) => f.id === c.factorId)!;
    return {...c, q: qs[i], confidence: confidenceFor(c, qs[i]), summary: summarise(factor.lead, target, c.diff, c.pct)};
  });
  effects.sort((a, b) => CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence] || Math.abs(b.cohensD) - Math.abs(a.cohensD));

  const sleepSeries = targetSeries(input, 'sleep_score') ?? input.daily.sleep_total_min;
  const progress: FactorProgress[] = tagList.map((f) => {
    let nWith = 0;
    let nWithout = 0;
    for (const d of f.eligible) {
      if (sleepSeries && !sleepSeries.has(addDays(d, 1))) continue;
      if (f.present.has(d)) nWith++;
      else nWithout++;
    }
    return {factorId: f.id, nWith, nWithout, withNeeded: Math.max(0, MIN_GROUP_SIZE - nWith), withoutNeeded: Math.max(0, MIN_GROUP_SIZE - nWithout)};
  });

  const overlaps: Overlap[] = [];
  for (let i = 0; i < tagList.length; i++) {
    for (let j = i + 1; j < tagList.length; j++) {
      const a = tagList[i];
      const b = tagList[j];
      if (a.present.size < MIN_GROUP_SIZE || b.present.size < MIN_GROUP_SIZE) continue;
      const jac = jaccard(a.present, b.present);
      if (jac >= OVERLAP_REPORT) overlaps.push({a: a.id, b: b.id, aName: a.name, bName: b.name, jaccard: round(jac, 2)});
    }
  }
  return {effects, progress, overlaps, factors};
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  strong: 'Strong pattern',
  likely: 'Likely pattern',
  possible: 'Possible pattern',
  none: 'No clear link',
};

/** The clearest effects first, keeping only the strongest target per factor so one factor doesn't dominate. */
export function topEffects(effects: Effect[], opts: {good?: boolean; minConfidence?: Confidence; limit?: number} = {}): Effect[] {
  const min = CONFIDENCE_RANK[opts.minConfidence ?? 'likely'];
  const seen = new Set<string>();
  const out: Effect[] = [];
  for (const e of effects) {
    if (CONFIDENCE_RANK[e.confidence] < min) continue;
    if (opts.good != null && e.good !== opts.good) continue;
    if (seen.has(e.factorId)) continue;
    seen.add(e.factorId);
    out.push(e);
    if (opts.limit && out.length >= opts.limit) break;
  }
  return out;
}
