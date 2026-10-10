import {addDays, dateRange, IsoDate, parseIsoDate, toIsoDate} from '@/lib/dates';
import {MetricDef} from '@/metrics/registry';
import {DailyData, MetricId} from '@/metrics/types';

export type Point = {date: IsoDate; value: number};

export function seriesFor(daily: DailyData, metric: MetricId, from?: IsoDate, to?: IsoDate): Point[] {
  const map = daily[metric];
  if (!map) return [];
  const out: Point[] = [];
  for (const [date, value] of map) {
    if ((from && date < from) || (to && date > to)) continue;
    out.push({date, value});
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function average(points: Point[]): number | null {
  if (!points.length) return null;
  return points.reduce((a, p) => a + p.value, 0) / points.length;
}

export function windowAverage(daily: DailyData, metric: MetricId, endDate: IsoDate, days: number): number | null {
  return average(seriesFor(daily, metric, addDays(endDate, -(days - 1)), endDate));
}

export function latest(daily: DailyData, metric: MetricId): Point | null {
  const s = seriesFor(daily, metric);
  return s.length ? s[s.length - 1] : null;
}

export type Bucket = 'day' | 'week' | 'month';

function bucketKey(date: IsoDate, bucket: Bucket): IsoDate {
  if (bucket === 'day') return date;
  const d = parseIsoDate(date);
  if (bucket === 'month') return toIsoDate(new Date(d.getFullYear(), d.getMonth(), 1));
  const mondayOffset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - mondayOffset);
  return toIsoDate(d);
}

export function bucketize(points: Point[], bucket: Bucket, rollup: MetricDef['rollup']): Point[] {
  if (bucket === 'day') return points;
  const groups = new Map<IsoDate, number[]>();
  for (const p of points) {
    const key = bucketKey(p.date, bucket);
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(p.value);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      value: rollup === 'sum' ? values.reduce((a, b) => a + b, 0) : values.reduce((a, b) => a + b, 0) / values.length,
    }));
}

/** Fills missing days with null so bar/line charts keep honest spacing over gaps. */
export function withGaps(points: Point[], from: IsoDate, to: IsoDate): {date: IsoDate; value: number | null}[] {
  const byDate = new Map(points.map((p) => [p.date, p.value]));
  return dateRange(from, to).map((date) => ({date, value: byDate.get(date) ?? null}));
}

export function minMax(points: Point[]): {min: Point; max: Point} | null {
  if (!points.length) return null;
  let min = points[0];
  let max = points[0];
  for (const p of points) {
    if (p.value < min.value) min = p;
    if (p.value > max.value) max = p;
  }
  return {min, max};
}
