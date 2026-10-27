import {addDays, daysBetween, formatClock, formatMinutes, IsoDate, isWeekend} from '@/lib/dates';
import {DailyData, MetricId} from '@/metrics/types';
import {Insight} from '@/insights/types';
import {windowPoints, windowValues} from '@/insights/baseline';
import {computeRadar, RadarContext} from '@/insights/vitals';
import {LoadReport} from '@/insights/load';
import {Effect} from '@/insights/effects';
import {StatusKind} from '@/metrics/types';
import {mean, median, round, sd, slope} from '@/insights/stats';

export type RuleInput = {
  today: IsoDate;
  daily: DailyData;
  radar?: RadarContext;
  load?: LoadReport | null;
  effects?: Effect[];
  /** Strain alerts are expected while sick, so they're softened. */
  status?: StatusKind | null;
};

type Rule = (input: RuleInput) => Insight | null;

const joinList = (items: string[]) =>
  items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

export const strainRadar: Rule = ({today, daily, radar: ctx, status}) => {
  const radar = computeRadar(daily, today, ctx);
  if (radar.level === 'none') return null;
  const list = joinList(radar.hits.map((h) => h.text));
  const sentence = `${list[0].toUpperCase()}${list.slice(1)}.`;
  if (status === 'sick') {
    return {id: 'strain_radar', kind: 'info', title: 'Your body is still fighting', body: `${sentence} That's expected while you're unwell. Rest up.`, priority: 90, metric: 'resting_hr'};
  }
  if (radar.explanation) {
    return {id: 'strain_radar', kind: 'info', title: 'Signs of strain', body: `${sentence} ${radar.explanation}`, priority: 70, metric: 'resting_hr'};
  }
  return {
    id: 'strain_radar',
    kind: 'warning',
    title: radar.level === 'major' ? 'Strong signs your body is under strain' : 'Your body may be under strain',
    body: `${sentence} Several signals moving together like this often comes before illness, or follows hard training or poor recovery. Consider taking it easy today.`,
    priority: 100,
    metric: 'resting_hr',
  };
};

export const shortSleepStreak: Rule = ({today, daily}) => {
  const nights = windowValues(daily.sleep_total_min, today, 7);
  if (nights.length < 5) return null;
  const short = nights.filter((m) => m < 420).length;
  if (short < 4) return null;
  return {
    id: 'short_sleep_streak',
    kind: 'warning',
    title: 'You\'re running short on sleep',
    body: `You slept under 7 hours on ${short} of the last ${nights.length} nights, averaging ${formatMinutes(mean(nights)!)}.`,
    priority: 70,
    metric: 'sleep_total_min',
  };
};

export const bedtimeDrift: Rule = ({today, daily}) => {
  const recent = windowValues(daily.sleep_start, today, 14);
  const prior = windowValues(daily.sleep_start, addDays(today, -14), 30);
  if (recent.length < 7 || prior.length < 10) return null;
  const now = mean(recent)!;
  const before = mean(prior)!;
  const diff = now - before;
  if (Math.abs(diff) < 30) return null;
  return {
    id: 'bedtime_drift',
    kind: 'info',
    title: `Your bedtime is getting ${diff > 0 ? 'later' : 'earlier'}`,
    body: `Over the last 2 weeks you've gone to sleep around ${formatClock(now)}, ${formatMinutes(Math.abs(diff))} ${diff > 0 ? 'later' : 'earlier'} than the month before (${formatClock(before)}).`,
    priority: 50,
    metric: 'sleep_start',
  };
};

export const socialJetlag: Rule = ({today, daily}) => {
  const points = windowPoints(daily.sleep_midpoint, today, 60);
  const weekend = points.filter((p) => isWeekend(p.date)).map((p) => p.value);
  const weekday = points.filter((p) => !isWeekend(p.date)).map((p) => p.value);
  if (weekend.length < 6 || weekday.length < 15) return null;
  const diff = mean(weekend)! - mean(weekday)!;
  if (Math.abs(diff) < 60) return null;
  return {
    id: 'social_jetlag',
    kind: 'info',
    title: 'Weekends shift your body clock',
    body: `On weekends the middle of your sleep is ${formatMinutes(Math.abs(diff))} ${diff > 0 ? 'later' : 'earlier'} than on weekdays. Keeping it within an hour makes Mondays easier.`,
    priority: 40,
    metric: 'sleep_midpoint',
  };
};

export const CHRONOTYPES: {maxMidpoint: number; label: string}[] = [
  {maxMidpoint: 120, label: 'Early morning'},
  {maxMidpoint: 180, label: 'Morning'},
  {maxMidpoint: 240, label: 'Late morning'},
  {maxMidpoint: 300, label: 'Early evening'},
  {maxMidpoint: 360, label: 'Evening'},
  {maxMidpoint: Infinity, label: 'Late evening'},
];

export function chronotypeFor(midpoint: number): string {
  return CHRONOTYPES.find((c) => midpoint < c.maxMidpoint)!.label;
}

export const chronotype: Rule = ({today, daily}) => {
  const values = windowValues(daily.sleep_midpoint, today, 90);
  if (values.length < 60) return null;
  const mid = median(values)!;
  const type = chronotypeFor(mid);
  return {
    id: 'chronotype',
    kind: 'info',
    title: `Your chronotype: ${type}`,
    body: `Across ${values.length} nights the middle of your sleep is usually around ${formatClock(mid)}, which matches a${/^[AEIOU]/.test(type) ? 'n' : ''} ${type.toLowerCase()} type.`,
    priority: 10,
    metric: 'sleep_midpoint',
  };
};

function trendOver(daily: DailyData, metric: MetricId, today: IsoDate, days: number, minPoints: number): number | null {
  const points = windowPoints(daily[metric], today, days);
  if (points.length < minPoints) return null;
  const s = slope(points.map((p) => ({x: daysBetween(today, p.date), y: p.value})));
  return s == null ? null : s * days;
}

export const vo2Trend: Rule = ({today, daily}) => {
  const change = trendOver(daily, 'vo2max', today, 90, 5);
  if (change == null || Math.abs(change) < 1) return null;
  const latest = windowPoints(daily.vo2max, today, 90).at(-1)!.value;
  const up = change > 0;
  return {
    id: 'vo2_trend',
    kind: up ? 'positive' : 'warning',
    title: `VO2 max is ${up ? 'rising' : 'falling'}`,
    body: `Your VO2 max has ${up ? 'gone up' : 'dropped'} by about ${round(Math.abs(change), 1)} over the last 3 months and is now ${Math.round(latest)}.`,
    priority: up ? 45 : 55,
    metric: 'vo2max',
  };
};

export const restingHrTrend: Rule = ({today, daily}) => {
  const change = trendOver(daily, 'resting_hr', today, 90, 30);
  if (change == null || Math.abs(change) < 2) return null;
  const down = change < 0;
  return {
    id: 'resting_hr_trend',
    kind: down ? 'positive' : 'warning',
    title: `Resting heart rate is trending ${down ? 'down' : 'up'}`,
    body: `Over the last 3 months your resting heart rate has ${down ? 'fallen' : 'risen'} by about ${Math.round(Math.abs(change))} bpm. ${down ? 'That usually means your fitness or recovery is improving.' : 'Stress, poor sleep, illness or less exercise can all push it up.'}`,
    priority: down ? 35 : 50,
    metric: 'resting_hr',
  };
};

export const stepsTrend: Rule = ({today, daily}) => {
  const recent = windowValues(daily.steps, today, 30);
  const prior = windowValues(daily.steps, addDays(today, -30), 60);
  if (recent.length < 20 || prior.length < 30) return null;
  const now = mean(recent)!;
  const before = mean(prior)!;
  if (before <= 0) return null;
  const change = (now - before) / before;
  if (Math.abs(change) < 0.15) return null;
  const up = change > 0;
  return {
    id: 'steps_trend',
    kind: up ? 'positive' : 'info',
    title: `You're ${up ? 'moving more' : 'moving less'} lately`,
    body: `You've averaged ${Math.round(now).toLocaleString()} steps a day this month, ${Math.round(Math.abs(change) * 100)}% ${up ? 'more' : 'fewer'} than the 2 months before (${Math.round(before).toLocaleString()}).`,
    priority: up ? 25 : 40,
    metric: 'steps',
  };
};

export const bodyBatteryLow: Rule = ({today, daily}) => {
  const highs = windowValues(daily.body_battery_high, today, 7);
  if (highs.length < 5) return null;
  const avg = mean(highs)!;
  if (avg >= 50) return null;
  return {
    id: 'body_battery_low',
    kind: 'warning',
    title: 'Your Body Battery isn\'t recharging',
    body: `Your Body Battery has peaked at an average of only ${Math.round(avg)} over the last ${highs.length} days. More sleep and some lower-stress days help it recover.`,
    priority: 60,
    metric: 'body_battery_high',
  };
};

export const restingHrLow: Rule = ({today, daily}) => {
  const points = windowPoints(daily.resting_hr, today, 30);
  if (points.length < 20 || points.at(-1)!.date !== today) return null;
  const latest = points.at(-1)!.value;
  if (!points.slice(0, -1).every((p) => p.value > latest)) return null;
  return {
    id: 'resting_hr_low',
    kind: 'positive',
    title: 'Lowest resting heart rate this month',
    body: `Your resting heart rate was ${Math.round(latest)} bpm last night, the lowest in 30 days. A sign you're well recovered.`,
    priority: 30,
    metric: 'resting_hr',
  };
};

export const sleepConsistencyImproved: Rule = ({today, daily}) => {
  const recent = windowValues(daily.sleep_start, today, 14);
  const prior = windowValues(daily.sleep_start, addDays(today, -14), 14);
  if (recent.length < 7 || prior.length < 7) return null;
  const now = sd(recent)!;
  const before = sd(prior)!;
  if (before - now < 15 || now > 45) return null;
  return {
    id: 'sleep_consistency_improved',
    kind: 'positive',
    title: 'Your bedtime is more consistent',
    body: `Your bedtime has varied by about ${formatMinutes(now)} over the last 2 weeks, down from ${formatMinutes(before)} the 2 weeks before. A regular schedule helps sleep quality.`,
    priority: 30,
    metric: 'sleep_start',
  };
};

export const loadSpike: Rule = ({load}) => {
  if (!load || (load.status !== 'overreaching' && load.status !== 'high') || load.acute == null || load.chronic == null) return null;
  const pct = Math.round((load.acute / load.chronic - 1) * 100);
  const over = load.status === 'overreaching';
  return {
    id: 'load_spike',
    kind: over ? 'warning' : 'info',
    title: over ? 'Training load is spiking' : 'A big training week',
    body: `Your daily training load over the last week is ${pct}% above your 4-week average. ${over ? 'Jumps this large are linked to injury and illness, so add an easy day or two.' : 'That is fine for a short block, but plan some easier days soon.'}`,
    priority: over ? 80 : 45,
  };
};

export const detraining: Rule = ({load}) => {
  if (!load || load.status !== 'detraining') return null;
  return {
    id: 'detraining',
    kind: 'info',
    title: 'Your fitness is starting to slip',
    body: 'Training load has been well below your usual for a few weeks. A couple of moderate sessions a week is enough to hold on to fitness.',
    priority: 35,
  };
};

export const stressHighWeek: Rule = ({today, daily}) => {
  const week = windowValues(daily.stress_avg, today, 7);
  const prior = windowValues(daily.stress_avg, addDays(today, -7), 60);
  if (week.length < 5 || prior.length < 21) return null;
  const now = mean(week)!;
  const before = mean(prior)!;
  const spread = sd(prior)!;
  if (spread === 0 || (now - before) / spread < 0.8 || now - before < 4) return null;
  return {
    id: 'stress_high_week',
    kind: 'warning',
    title: 'A more stressful week',
    body: `Your average stress this week is ${Math.round(now)}, up from your usual ${Math.round(before)}. Stress makes Body Battery drain faster, so protect your sleep and add some down time.`,
    priority: 55,
    metric: 'stress_avg',
  };
};

export const weightTrend: Rule = ({today, daily}) => {
  const points = windowPoints(daily.weight_kg, today, 60);
  if (points.length < 6 || daysBetween(points[0].date, points.at(-1)!.date) < 21) return null;
  const s = slope(points.map((p) => ({x: daysBetween(today, p.date), y: p.value})));
  if (s == null) return null;
  const change = s * daysBetween(points[0].date, points.at(-1)!.date);
  if (Math.abs(change) < 1.5) return null;
  return {
    id: 'weight_trend',
    kind: 'info',
    title: `Weight is trending ${change > 0 ? 'up' : 'down'}`,
    body: `Your weight has ${change > 0 ? 'risen' : 'fallen'} by about ${round(Math.abs(change), 1)} kg over the last ${Math.round(daysBetween(points[0].date, points.at(-1)!.date) / 7)} weeks, now ${round(points.at(-1)!.value, 1)} kg.`,
    priority: 30,
    metric: 'weight_kg',
  };
};

export const topEffect: Rule = ({effects}) => {
  const best = (effects ?? []).find((e) => e.confidence === 'strong' && e.factorKind === 'tag');
  if (!best) return null;
  return {
    id: 'top_effect',
    kind: best.good === false ? 'warning' : best.good ? 'positive' : 'info',
    title: `${best.factorName} and ${best.targetLabel.toLowerCase()}`,
    body: `${best.summary} This is one of your clearest patterns. See the Insights tab for more.`,
    priority: 33,
  };
};

export const RULES: Rule[] = [
  strainRadar,
  shortSleepStreak,
  bedtimeDrift,
  socialJetlag,
  chronotype,
  vo2Trend,
  restingHrTrend,
  stepsTrend,
  bodyBatteryLow,
  restingHrLow,
  sleepConsistencyImproved,
  loadSpike,
  detraining,
  stressHighWeek,
  weightTrend,
  topEffect,
];

export function generateInsights(input: RuleInput): Insight[] {
  return RULES.map((rule) => rule(input))
    .filter((i): i is Insight => i != null)
    .sort((a, b) => b.priority - a.priority);
}
