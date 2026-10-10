import {addDays, daysBetween, IsoDate} from '@/lib/dates';
import {DailyData, MetricId} from '@/metrics/types';
import {mean, sd, weightedMean} from '@/insights/stats';

export const SHORT_WINDOW_DAYS = 14;
export const LONG_WINDOW_DAYS = 60;
export const MIN_BASELINE_POINTS = 14;
const SHORT_WINDOW_DECAY = 0.9;

export type Point = {date: IsoDate; value: number};

export type Baseline = {
  shortMean: number | null;
  shortN: number;
  longMean: number | null;
  longSd: number | null;
  longN: number;
  ready: boolean;
};

export type Deviation = {
  value: number;
  mean: number;
  sd: number;
  diff: number;
  z: number;
  ready: boolean;
};

/** Points in the `days`-long window ending on `end` (inclusive), oldest first. */
export function windowPoints(series: Map<IsoDate, number> | undefined, end: IsoDate, days: number): Point[] {
  if (!series) return [];
  const out: Point[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(end, -i);
    const value = series.get(date);
    if (value != null && !Number.isNaN(value)) out.push({date, value});
  }
  return out;
}

export function windowValues(series: Map<IsoDate, number> | undefined, end: IsoDate, days: number): number[] {
  return windowPoints(series, end, days).map((p) => p.value);
}

/** Recent-weighted mean of the `days` window ending on `end`; yesterday counts more than two weeks ago. */
export function recentWeightedMean(series: Map<IsoDate, number> | undefined, end: IsoDate, days = SHORT_WINDOW_DAYS): number | null {
  const points = windowPoints(series, end, days);
  return weightedMean(
    points.map((p) => p.value),
    points.map((p) => SHORT_WINDOW_DECAY ** daysBetween(p.date, end)),
  );
}

/** Baseline built from the windows ending on `end` (inclusive). */
export function computeBaseline(series: Map<IsoDate, number> | undefined, end: IsoDate): Baseline {
  const shortValues = windowValues(series, end, SHORT_WINDOW_DAYS);
  const longValues = windowValues(series, end, LONG_WINDOW_DAYS);
  return {
    shortMean: recentWeightedMean(series, end),
    shortN: shortValues.length,
    longMean: mean(longValues),
    longSd: sd(longValues),
    longN: longValues.length,
    ready: longValues.length >= MIN_BASELINE_POINTS,
  };
}

/** How the value on `date` compares with the 60 days before it. */
export function deviation(daily: DailyData, metric: MetricId, date: IsoDate): Deviation | null {
  const series = daily[metric];
  const value = series?.get(date);
  if (value == null) return null;
  const base = computeBaseline(series, addDays(date, -1));
  if (base.longMean == null || base.longSd == null) return null;
  const diff = value - base.longMean;
  return {
    value,
    mean: base.longMean,
    sd: base.longSd,
    diff,
    z: base.longSd === 0 ? 0 : diff / base.longSd,
    ready: base.ready,
  };
}
