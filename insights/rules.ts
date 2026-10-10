import {addDays, daysBetween, formatClock, formatMinutes, IsoDate, isWeekend} from '@/lib/dates';
import {DailyData, MetricId} from '@/metrics/types';
import {Insight} from '@/insights/types';
import {deviation, windowPoints, windowValues} from '@/insights/baseline';
import {mean, median, round, sd, slope} from '@/insights/stats';

export type RuleInput = {today: IsoDate; daily: DailyData};

type Rule = (input: RuleInput) => Insight | null;

export const STRAIN_Z = 1.5;

type StrainSignal = {metric: MetricId; label: string; badDirection: 1 | -1; unit: string; dateOffset: number};

const STRAIN_SIGNALS: StrainSignal[] = [
  {metric: 'resting_hr', label: 'resting heart rate', badDirection: 1, unit: ' bpm', dateOffset: 0},
  {metric: 'respiration_sleep', label: 'sleep respiration', badDirection: 1, unit: ' brpm', dateOffset: 0},
  {metric: 'sleep_stress', label: 'overnight stress', badDirection: 1, unit: '', dateOffset: 0},
  {metric: 'stress_avg', label: 'daytime stress', badDirection: 1, unit: '', dateOffset: -1},
  {metric: 'spo2_low', label: 'lowest Pulse Ox', badDirection: -1, unit: '%', dateOffset: 0},
];

function badZ(daily: DailyData, signal: StrainSignal, date: IsoDate): {z: number; diff: number} | null {
  const dev = deviation(daily, signal.metric, date);
  if (!dev || !dev.ready) return null;
  return {z: dev.z * signal.badDirection, diff: dev.diff};
}

export const strainRadar: Rule = ({today, daily}) => {
  const hits: string[] = [];
  for (const base of STRAIN_SIGNALS) {
    const signal =
      base.metric === 'respiration_sleep' && !daily.respiration_sleep ? {...base, metric: 'respiration_avg' as MetricId, label: 'respiration'} : base;
    const date = addDays(today, signal.dateOffset);
    const now = badZ(daily, signal, date);
    const before = badZ(daily, signal, addDays(date, -1));
    if (!now) continue;
    const twoDay = before ? (now.z + before.z) / 2 : null;
    if (now.z >= STRAIN_Z || (twoDay != null && twoDay >= STRAIN_Z)) {
      const amount = round(Math.abs(now.diff), signal.unit === ' brpm' ? 1 : 0);
      hits.push(`${signal.label} is ${amount}${signal.unit} ${now.diff > 0 ? 'above' : 'below'} your usual`);
    }
  }
  if (hits.length < 2) return null;
  const list = hits.length === 2 ? hits.join(' and ') : `${hits.slice(0, -1).join(', ')} and ${hits[hits.length - 1]}`;
  return {
    id: 'strain_radar',
    kind: 'warning',
    title: 'Your body may be under strain',
    body: `${list[0].toUpperCase()}${list.slice(1)}. Several signals moving together like this often comes before illness, or follows hard training or poor recovery. Consider taking it easy today.`,
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
];

export function generateInsights(input: RuleInput): Insight[] {
  return RULES.map((rule) => rule(input))
    .filter((i): i is Insight => i != null)
    .sort((a, b) => b.priority - a.priority);
}
