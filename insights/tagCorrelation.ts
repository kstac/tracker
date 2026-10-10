import {addDays, IsoDate} from '@/lib/dates';
import {formatMetricValue} from '@/lib/format';
import {METRIC_BY_ID} from '@/metrics/registry';
import {DailyData, MetricId, Tag, TagEntry} from '@/metrics/types';
import {TagEffect} from '@/insights/types';
import {cohensD, mean, round} from '@/insights/stats';

export const MIN_GROUP_SIZE = 5;
export const MIN_EFFECT_SIZE = 0.4;

type Target = {metric: MetricId | 'sleep_score'; label: string; phrase: string; lag: 0 | 1};

/** Sleep and overnight metrics are dated by wake-up day, so a tag on day D lines up with the night ending on D+1. */
export const TAG_TARGETS: Target[] = [
  {metric: 'sleep_score', label: 'Sleep score', phrase: 'your sleep score that night', lag: 1},
  {metric: 'sleep_total_min', label: 'Total sleep', phrase: 'your sleep that night', lag: 1},
  {metric: 'resting_hr', label: 'Resting heart rate', phrase: 'your resting heart rate that night', lag: 1},
  {metric: 'hrv_overnight', label: 'Overnight HRV', phrase: 'your overnight HRV', lag: 1},
  {metric: 'sleep_stress', label: 'Overnight stress', phrase: 'your overnight stress', lag: 1},
  {metric: 'body_battery_wake', label: 'Body Battery at wake', phrase: 'your Body Battery the next morning', lag: 1},
  {metric: 'stress_avg', label: 'Average stress', phrase: 'your stress that day', lag: 0},
  {metric: 'steps', label: 'Steps', phrase: 'your steps that day', lag: 0},
];

export type TagCorrelationInput = {
  today: IsoDate;
  daily: DailyData;
  sleepScores: Map<IsoDate, number>;
  tags: Tag[];
  tagEntries: TagEntry[];
};

function targetSeries(input: TagCorrelationInput, target: Target): Map<IsoDate, number> | undefined {
  if (target.metric !== 'sleep_score') return input.daily[target.metric];
  const merged = new Map(input.daily.garmin_sleep_score ?? []);
  input.sleepScores.forEach((v, d) => merged.set(d, v));
  return merged.size > 0 ? merged : undefined;
}

function describeDiff(target: Target, diff: number): string {
  if (target.metric === 'sleep_score') return `${Math.round(Math.abs(diff))} points ${diff > 0 ? 'higher' : 'lower'}`;
  const def = METRIC_BY_ID[target.metric];
  const amount = formatMetricValue(def, Math.abs(diff));
  if (def.format === 'duration') return `${amount} ${diff > 0 ? 'longer' : 'shorter'}`;
  return `${amount} ${diff > 0 ? 'higher' : 'lower'}`;
}

export function computeTagEffects(input: TagCorrelationInput): TagEffect[] {
  const effects: TagEffect[] = [];
  for (const tag of input.tags) {
    const entries = input.tagEntries.filter((e) => e.tagId === tag.id);
    if (entries.length === 0) continue;
    const taggedDates = new Set(entries.filter((e) => e.value > 0).map((e) => e.date));
    const firstLogged = entries.reduce((min, e) => (e.date < min ? e.date : min), entries[0].date);

    for (const target of TAG_TARGETS) {
      const series = targetSeries(input, target);
      if (!series) continue;
      const tagged: number[] = [];
      const untagged: number[] = [];
      for (const [metricDate, value] of series) {
        const tagDate = addDays(metricDate, -target.lag);
        if (tagDate < firstLogged || tagDate > input.today) continue;
        (taggedDates.has(tagDate) ? tagged : untagged).push(value);
      }
      if (tagged.length < MIN_GROUP_SIZE || untagged.length < MIN_GROUP_SIZE) continue;
      const d = cohensD(tagged, untagged);
      if (d == null || Math.abs(d) < MIN_EFFECT_SIZE) continue;
      const taggedMean = mean(tagged)!;
      const untaggedMean = mean(untagged)!;
      const diff = taggedMean - untaggedMean;
      effects.push({
        tagId: tag.id,
        tagName: tag.name,
        metric: target.metric,
        metricLabel: target.label,
        lag: target.lag,
        taggedMean: round(taggedMean, 2),
        untaggedMean: round(untaggedMean, 2),
        diff: round(diff, 2),
        cohensD: round(d, 2),
        nTagged: tagged.length,
        nUntagged: untagged.length,
        summary: `On days you log ${tag.name}, ${target.phrase} averages ${describeDiff(target, diff)} (n=${tagged.length}).`,
      });
    }
  }
  return effects.sort((a, b) => Math.abs(b.cohensD) - Math.abs(a.cohensD));
}
