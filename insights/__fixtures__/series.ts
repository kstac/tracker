import {addDays, IsoDate, startOfDayTs} from '@/lib/dates';
import {DailyData, MetricId, SleepNight} from '@/metrics/types';

export const TODAY: IsoDate = '2026-10-10';

const WOBBLE = [0, 1, -1, 2, -2, 1, -1];

/** `days` values ending on `end`, oldest first: base plus a small repeating wobble scaled by `amp`. */
export function steady(end: IsoDate, days: number, base: number, amp = 1): Map<IsoDate, number> {
  const out = new Map<IsoDate, number>();
  for (let i = days - 1; i >= 0; i--) out.set(addDays(end, -i), base + WOBBLE[i % WOBBLE.length] * amp);
  return out;
}

export function fromValues(end: IsoDate, values: number[]): Map<IsoDate, number> {
  const out = new Map<IsoDate, number>();
  values.forEach((v, i) => out.set(addDays(end, i - values.length + 1), v));
  return out;
}

export function withValue(series: Map<IsoDate, number>, date: IsoDate, value: number): Map<IsoDate, number> {
  const copy = new Map(series);
  copy.set(date, value);
  return copy;
}

export function daily(entries: Partial<Record<MetricId, Map<IsoDate, number>>>): DailyData {
  return entries;
}

export type NightSpec = {bed?: number; asleep?: number; deep?: number; rem?: number; awake?: number};

/** A night ending on `date` (wake date). `bed` is minutes from midnight of the wake date, e.g. -60 is 23:00. */
export function night(date: IsoDate, spec: NightSpec = {}): SleepNight {
  const bed = spec.bed ?? -60;
  const asleep = spec.asleep ?? 480;
  const deep = spec.deep ?? 90;
  const rem = spec.rem ?? 105;
  const awake = spec.awake ?? 15;
  const startTs = startOfDayTs(date) + bed * 60_000;
  return {
    date,
    source: 'garmin',
    startTs,
    endTs: startTs + (asleep + awake) * 60_000,
    deepMin: deep,
    lightMin: asleep - deep - rem,
    remMin: rem,
    awakeMin: awake,
  };
}
