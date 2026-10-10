import {addDays, formatMinutes, IsoDate} from '@/lib/dates';
import {DailyData, MetricId} from '@/metrics/types';
import {Score} from '@/insights/types';
import {computeBaseline, deviation, LONG_WINDOW_DAYS, MIN_BASELINE_POINTS, recentWeightedMean, windowValues} from '@/insights/baseline';
import {mean, ramp, round, sd} from '@/insights/stats';
import {combine, WeightedContributor} from '@/insights/score';

export const READINESS_WEIGHTS = {
  restingHr: 0.2,
  sleep: 0.15,
  sleepBalance: 0.15,
  sleepRegularity: 0.1,
  previousDayActivity: 0.1,
  activityBalance: 0.1,
  bodyBattery: 0.1,
  hrvBalance: 0.1,
  previousDayStress: 0.1,
};

export const DEFAULT_SLEEP_NEED_MIN = 480;

export type ReadinessInput = {
  date: IsoDate;
  daily: DailyData;
  /** Last night's sleep score (ours, or Garmin's when ours is unavailable). */
  sleepScore: number | null;
  sleepNeedMin?: number;
};

const signed = (v: number, decimals = 0) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(round(v, decimals))}`;

export function restingHrScore(diff: number): number {
  if (diff >= 0) {
    if (diff <= 1) return 100;
    if (diff <= 3) return ramp(diff, 1, 3, 100, 75);
    if (diff <= 6) return ramp(diff, 3, 6, 75, 40);
    return ramp(diff, 6, 10, 40, 10);
  }
  if (diff >= -5) return 100;
  return ramp(diff, -5, -15, 100, 65);
}

/** Score for a value where a high z-score (worse than usual) costs points. */
export function highIsBadScore(z: number): number {
  return z <= 0.5 ? 100 : ramp(z, 0.5, 2.5, 100, 20);
}

export function loadScore(z: number): number {
  if (z > 1.5) return ramp(z, 1.5, 3.5, 100, 50);
  if (z < -1.5) return ramp(z, -1.5, -3, 100, 70);
  return 100;
}

export function balanceRatioScore(ratio: number): number {
  if (ratio > 1.3) return ramp(ratio, 1.3, 1.8, 100, 50);
  if (ratio < 0.8) return ramp(ratio, 0.8, 0.5, 100, 50);
  return 100;
}

function firstAvailable(daily: DailyData, metrics: MetricId[], date: IsoDate): MetricId | null {
  return metrics.find((m) => daily[m]?.has(date)) ?? null;
}

export function scoreReadiness(input: ReadinessInput): Score | null {
  const {date, daily} = input;
  const need = input.sleepNeedMin ?? DEFAULT_SLEEP_NEED_MIN;
  const yesterday = addDays(date, -1);
  const parts: WeightedContributor[] = [];

  const rhr = deviation(daily, 'resting_hr', date);
  if (rhr) {
    parts.push({
      key: 'resting_hr',
      label: 'Resting heart rate',
      weight: READINESS_WEIGHTS.restingHr,
      score: restingHrScore(rhr.diff),
      detail: `${Math.round(rhr.value)} bpm (${signed(rhr.diff)} vs usual)`,
    });
  }

  if (input.sleepScore != null) {
    parts.push({key: 'sleep', label: 'Last night\'s sleep', weight: READINESS_WEIGHTS.sleep, score: input.sleepScore, detail: `Score ${Math.round(input.sleepScore)}`});
  }

  const recentSleep = windowValues(daily.sleep_total_min, date, 14);
  if (recentSleep.length >= 3) {
    const avg = mean(recentSleep)!;
    parts.push({
      key: 'sleep_balance',
      label: 'Sleep balance',
      weight: READINESS_WEIGHTS.sleepBalance,
      score: ramp(avg / need, 0.75, 0.97),
      detail: `${formatMinutes(avg)} average over ${recentSleep.length} nights`,
    });
  }

  const starts = windowValues(daily.sleep_start, date, 14);
  const ends = windowValues(daily.sleep_end, date, 14);
  if (starts.length >= 5 && ends.length >= 5) {
    const spread = (sd(starts)! + sd(ends)!) / 2;
    parts.push({
      key: 'sleep_regularity',
      label: 'Sleep regularity',
      weight: READINESS_WEIGHTS.sleepRegularity,
      score: ramp(spread, 90, 20),
      detail: `Bed and wake times vary by about ${formatMinutes(spread)}`,
    });
  }

  const loadMetric = firstAvailable(daily, ['active_kcal', 'steps'], yesterday);
  if (loadMetric) {
    const dev = deviation(daily, loadMetric, yesterday);
    if (dev) {
      const unit = loadMetric === 'steps' ? 'steps' : 'kcal';
      parts.push({
        key: 'previous_day_activity',
        label: 'Previous day activity',
        weight: READINESS_WEIGHTS.previousDayActivity,
        score: loadScore(dev.z),
        detail: `${Math.round(dev.value).toLocaleString()} ${unit} (usual ${Math.round(dev.mean).toLocaleString()})`,
      });
    }
  }

  const balanceMetric = (['intensity_min', 'active_kcal', 'steps'] as MetricId[]).find(
    (m) => windowValues(daily[m], date, 14).length >= 7 && windowValues(daily[m], date, LONG_WINDOW_DAYS).length >= MIN_BASELINE_POINTS,
  );
  if (balanceMetric) {
    const short = recentWeightedMean(daily[balanceMetric], date)!;
    const long = mean(windowValues(daily[balanceMetric], date, LONG_WINDOW_DAYS))!;
    if (long > 0) {
      const ratio = short / long;
      parts.push({
        key: 'activity_balance',
        label: 'Activity balance',
        weight: READINESS_WEIGHTS.activityBalance,
        score: balanceRatioScore(ratio),
        detail: `Last 2 weeks at ${Math.round(ratio * 100)}% of your 2-month average`,
      });
    }
  }

  const battery = daily.body_battery_wake?.get(date) ?? daily.body_battery_high?.get(date);
  if (battery != null) {
    parts.push({
      key: 'body_battery',
      label: 'Body Battery',
      weight: READINESS_WEIGHTS.bodyBattery,
      score: ramp(battery, 20, 85),
      detail: `${Math.round(battery)} this morning`,
    });
  }

  const hrvBase = computeBaseline(daily.hrv_overnight, addDays(date, -1));
  const hrvShort = recentWeightedMean(daily.hrv_overnight, date);
  if (hrvShort != null && hrvBase.longMean != null && hrvBase.longSd != null) {
    const z = hrvBase.longSd === 0 ? 0 : (hrvShort - hrvBase.longMean) / hrvBase.longSd;
    parts.push({
      key: 'hrv_balance',
      label: 'HRV balance',
      weight: READINESS_WEIGHTS.hrvBalance,
      score: z >= -0.5 ? 100 : ramp(z, -0.5, -2.5, 100, 20),
      detail: `${Math.round(hrvShort)} ms recently vs ${Math.round(hrvBase.longMean)} ms usual`,
    });
  } else {
    const stress = deviation(daily, 'sleep_stress', date);
    if (stress) {
      parts.push({
        key: 'hrv_balance',
        label: 'Overnight stress (HRV proxy)',
        weight: READINESS_WEIGHTS.hrvBalance,
        score: highIsBadScore(stress.z),
        detail: `${Math.round(stress.value)} vs ${Math.round(stress.mean)} usual`,
      });
    }
  }

  const dayStress = deviation(daily, 'stress_avg', yesterday);
  if (dayStress) {
    parts.push({
      key: 'previous_day_stress',
      label: 'Previous day stress',
      weight: READINESS_WEIGHTS.previousDayStress,
      score: highIsBadScore(dayStress.z),
      detail: `${Math.round(dayStress.value)} vs ${Math.round(dayStress.mean)} usual`,
    });
  }

  const calibrationSeries = daily.resting_hr ?? daily.sleep_total_min;
  const calibrating = !computeBaseline(calibrationSeries, addDays(date, -1)).ready;
  return combine(parts, date, calibrating);
}
