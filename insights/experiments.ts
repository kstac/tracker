import {addDays, daysBetween, IsoDate} from '@/lib/dates';
import {DailyData, Experiment, Tag, TagEntry} from '@/metrics/types';
import {describeDiff, MEANINGFUL_CHANGE, targetHigherIsBetter, TargetMetric} from '@/insights/effects';
import {mean, round, welch} from '@/insights/stats';

export type ExperimentMetric = {key: string; metric: TargetMetric; label: string; lag: 0 | 1};

/** What an experiment can measure. Overnight metrics are read the morning after each experiment day. */
export const EXPERIMENT_METRICS: ExperimentMetric[] = [
  {key: 'sleep_score', metric: 'sleep_score', label: 'Sleep score', lag: 1},
  {key: 'sleep_total_min', metric: 'sleep_total_min', label: 'Total sleep', lag: 1},
  {key: 'readiness', metric: 'readiness', label: 'Readiness', lag: 1},
  {key: 'resting_hr', metric: 'resting_hr', label: 'Resting heart rate', lag: 1},
  {key: 'sleep_stress', metric: 'sleep_stress', label: 'Overnight stress', lag: 1},
  {key: 'body_battery_wake', metric: 'body_battery_wake', label: 'Body Battery at wake', lag: 1},
  {key: 'hrv_overnight', metric: 'hrv_overnight', label: 'Overnight HRV', lag: 1},
  {key: 'stress_avg', metric: 'stress_avg', label: 'Daytime stress', lag: 0},
  {key: 'steps', metric: 'steps', label: 'Steps', lag: 0},
  {key: 'checkin_energy', metric: 'checkin_energy', label: 'Energy', lag: 1},
  {key: 'checkin_mood', metric: 'checkin_mood', label: 'Mood', lag: 0},
];

export const DEFAULT_EXPERIMENT_METRICS = ['sleep_score', 'readiness', 'resting_hr', 'body_battery_wake'];

export type ExperimentMetricResult = {
  key: string;
  label: string;
  metric: TargetMetric;
  during: number | null;
  before: number | null;
  nDuring: number;
  nBefore: number;
  diff: number | null;
  ciLow: number | null;
  ciHigh: number | null;
  p: number | null;
  /** True when the change is for the better and unlikely to be chance. */
  improved: boolean | null;
  text: string;
};

export type ExperimentResult = {
  experiment: Experiment;
  state: 'upcoming' | 'running' | 'done';
  end: IsoDate;
  daysElapsed: number;
  compliance: {kept: number; logged: number} | null;
  metrics: ExperimentMetricResult[];
  verdict: string | null;
  /** Whether the main metric moved the way you predicted, once there's a result. */
  predictionMatched: boolean | null;
};

export type ExperimentInput = {
  today: IsoDate;
  daily: DailyData;
  sleepScores: Map<IsoDate, number>;
  readiness: Map<IsoDate, number>;
  tags: Tag[];
  tagEntries: TagEntry[];
};

function seriesFor(input: ExperimentInput, metric: TargetMetric): Map<IsoDate, number> | undefined {
  if (metric === 'readiness') return input.readiness;
  if (metric === 'sleep_score') {
    const merged = new Map(input.daily.garmin_sleep_score ?? []);
    input.sleepScores.forEach((v, d) => merged.set(d, v));
    return merged;
  }
  return input.daily[metric];
}

function values(series: Map<IsoDate, number> | undefined, from: IsoDate, to: IsoDate, lag: number): number[] {
  if (!series || from > to) return [];
  const out: number[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const v = series.get(addDays(d, lag));
    if (v != null) out.push(v);
  }
  return out;
}

/** Compares the experiment days with an equally long stretch just before it (at least two weeks, at most four). */
export function evaluateExperiment(input: ExperimentInput, experiment: Experiment): ExperimentResult {
  const plannedEnd = addDays(experiment.start, experiment.days - 1);
  const end = experiment.endedAt && experiment.endedAt < plannedEnd ? experiment.endedAt : plannedEnd;
  const state = input.today < experiment.start ? 'upcoming' : input.today > end || experiment.endedAt ? 'done' : 'running';
  const lastDay = end < input.today ? end : input.today;
  const daysElapsed = state === 'upcoming' ? 0 : daysBetween(experiment.start, lastDay) + 1;
  const baselineDays = Math.min(28, Math.max(14, experiment.days));
  const baseFrom = addDays(experiment.start, -baselineDays);
  const baseTo = addDays(experiment.start, -1);

  let compliance: ExperimentResult['compliance'] = null;
  if (experiment.tagId && state !== 'upcoming') {
    const tagged = new Set(input.tagEntries.filter((e) => e.tagId === experiment.tagId && e.value > 0).map((e) => e.date));
    let kept = 0;
    for (let d = experiment.start; d <= lastDay; d = addDays(d, 1)) {
      if (experiment.mode === 'avoid' ? !tagged.has(d) : tagged.has(d)) kept++;
    }
    compliance = {kept, logged: daysElapsed};
  }

  const metrics: ExperimentMetricResult[] = experiment.metrics.flatMap((key) => {
    const def = EXPERIMENT_METRICS.find((m) => m.key === key);
    if (!def) return [];
    const series = seriesFor(input, def.metric);
    // Overnight results for the last day only arrive the next morning.
    const duringTo = def.lag && lastDay === input.today ? addDays(lastDay, -1) : lastDay;
    const during = state === 'upcoming' ? [] : values(series, experiment.start, duringTo, def.lag);
    const before = values(series, baseFrom, baseTo, def.lag);
    const test = during.length >= 3 && before.length >= 5 ? welch(during, before) : null;
    const higher = targetHigherIsBetter(def.metric);
    const meaningful = test != null && Math.abs(test.diff) >= (MEANINGFUL_CHANGE[def.metric] ?? 1) / 2;
    const improved = test == null || higher == null || !meaningful ? null : test.p < 0.1 ? (test.diff > 0) === higher : null;
    let text = 'Not enough data yet';
    if (test) {
      text = meaningful
        ? `${describeDiff(def.metric, test.diff)} than before${test.p >= 0.1 ? ', within normal variation' : ''}`
        : 'About the same as before';
    }
    return [{
      key,
      label: def.label,
      metric: def.metric,
      during: during.length ? round(mean(during)!, 1) : null,
      before: before.length ? round(mean(before)!, 1) : null,
      nDuring: during.length,
      nBefore: before.length,
      diff: test ? round(test.diff, 1) : null,
      ciLow: test ? round(test.ciLow, 1) : null,
      ciHigh: test ? round(test.ciHigh, 1) : null,
      p: test?.p ?? null,
      improved,
      text,
    }];
  });

  const main = metrics[0];
  let verdict: string | null = null;
  let predictionMatched: boolean | null = null;
  if (main && main.p != null && (state === 'done' || daysElapsed >= 7)) {
    const outcome = main.improved === true ? 'better' : main.improved === false ? 'worse' : 'same';
    verdict =
      outcome === 'same'
        ? `${main.label} didn't change clearly.`
        : `${main.label} got ${outcome}: ${main.text}.`;
    if (state === 'done' && experiment.prediction) predictionMatched = experiment.prediction === outcome;
  }
  return {experiment, state, end, daysElapsed, compliance, metrics, verdict, predictionMatched};
}
