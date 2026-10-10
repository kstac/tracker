import {IsoDate, toIsoDate} from '@/lib/dates';
import {DailyRow, MetricId, Sample, SleepNight} from '@/metrics/types';

type Json = Record<string, any>;

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function rowsFrom(date: IsoDate, pairs: [MetricId, unknown][]): DailyRow[] {
  const out: DailyRow[] = [];
  for (const [metric, raw] of pairs) {
    const value = num(raw);
    if (value != null) out.push({date, metric, source: 'garmin', value});
  }
  return out;
}

function positive(v: unknown): number | null {
  const n = num(v);
  return n != null && n > 0 ? n : null;
}

export function mapUserSummary(date: IsoDate, s: Json | null | undefined): DailyRow[] {
  if (!s) return [];
  const moderate = num(s.moderateIntensityMinutes);
  const vigorous = num(s.vigorousIntensityMinutes);
  const intensity = moderate == null && vigorous == null ? null : (moderate ?? 0) + 2 * (vigorous ?? 0);
  const distance = num(s.totalDistanceMeters);
  return rowsFrom(date, [
    ['steps', s.totalSteps],
    ['distance_km', distance == null ? null : distance / 1000],
    ['active_kcal', s.activeKilocalories],
    ['total_kcal', s.totalKilocalories],
    ['floors', s.floorsAscended],
    ['intensity_min', intensity],
    ['resting_hr', positive(s.restingHeartRate)],
    ['hr_min', positive(s.minHeartRate)],
    ['hr_max', positive(s.maxHeartRate)],
    ['stress_avg', positive(s.averageStressLevel)],
    ['stress_max', positive(s.maxStressLevel)],
    ['body_battery_high', s.bodyBatteryHighestValue],
    ['body_battery_low', s.bodyBatteryLowestValue],
    ['body_battery_charged', s.bodyBatteryChargedValue],
    ['body_battery_drained', s.bodyBatteryDrainedValue],
    ['body_battery_wake', s.bodyBatteryAtWakeTime],
    ['spo2_avg', positive(s.averageSpo2)],
    ['spo2_low', positive(s.lowestSpo2)],
    ['respiration_avg', positive(s.avgWakingRespirationValue)],
  ]);
}

export type MappedSleep = {night: SleepNight | null; rows: DailyRow[]};

export function mapSleep(date: IsoDate, data: Json | null | undefined): MappedSleep {
  const dto = data?.dailySleepDTO;
  const start = num(dto?.sleepStartTimestampGMT);
  const end = num(dto?.sleepEndTimestampGMT);
  if (!dto || start == null || end == null || end <= start) return {night: null, rows: []};

  const minutes = (v: unknown) => (num(v) ?? 0) / 60;
  const night: SleepNight = {
    date: typeof dto.calendarDate === 'string' ? dto.calendarDate : date,
    source: 'garmin',
    startTs: start,
    endTs: end,
    deepMin: minutes(dto.deepSleepSeconds),
    lightMin: minutes(dto.lightSleepSeconds),
    remMin: minutes(dto.remSleepSeconds),
    awakeMin: minutes(dto.awakeSleepSeconds),
  };
  const rows = rowsFrom(night.date, [
    ['garmin_sleep_score', dto.sleepScores?.overall?.value],
    ['sleep_stress', positive(dto.avgSleepStress)],
    ['respiration_sleep', positive(dto.averageRespirationValue)],
    ['hrv_overnight', positive(data?.avgOvernightHrv)],
  ]);
  return {night, rows};
}

export function mapHrv(date: IsoDate, data: Json | null | undefined): DailyRow[] {
  return rowsFrom(date, [['hrv_overnight', positive(data?.hrvSummary?.lastNightAvg)]]);
}

export function mapMaxMetrics(data: unknown): DailyRow[] {
  if (!Array.isArray(data)) return [];
  const out: DailyRow[] = [];
  for (const entry of data) {
    const generic = entry?.generic;
    const date = generic?.calendarDate;
    const value = num(generic?.vo2MaxPreciseValue) ?? num(generic?.vo2MaxValue);
    if (typeof date === 'string' && value != null) out.push({date, metric: 'vo2max', source: 'garmin', value});
  }
  return out;
}

export function mapStressSamples(data: Json | null | undefined): Sample[] {
  const out: Sample[] = [];
  for (const pair of data?.stressValuesArray ?? []) {
    const [ts, value] = pair ?? [];
    if (num(ts) != null && num(value) != null && value >= 0) out.push({metric: 'stress', ts, value, source: 'garmin'});
  }
  for (const entry of data?.bodyBatteryValuesArray ?? []) {
    const ts = entry?.[0];
    const level = entry?.[2];
    if (num(ts) != null && num(level) != null) out.push({metric: 'body_battery', ts, value: level, source: 'garmin'});
  }
  return out;
}

export function mapHeartRateSamples(data: Json | null | undefined): Sample[] {
  const out: Sample[] = [];
  for (const pair of data?.heartRateValues ?? []) {
    const [ts, bpm] = pair ?? [];
    if (num(ts) != null && num(bpm) != null && bpm > 0) out.push({metric: 'heart_rate', ts, value: bpm, source: 'garmin'});
  }
  return out;
}

export function averageHeartRate(samples: Sample[]): number | null {
  if (!samples.length) return null;
  return samples.reduce((a, s) => a + s.value, 0) / samples.length;
}

export function bodyBatteryAt(samples: Sample[], ts: number): number | null {
  let best: Sample | null = null;
  for (const s of samples) {
    if (s.metric !== 'body_battery') continue;
    if (!best || Math.abs(s.ts - ts) < Math.abs(best.ts - ts)) best = s;
  }
  return best && Math.abs(best.ts - ts) <= 60 * 60_000 ? best.value : null;
}

export function calendarDateOf(ts: number): IsoDate {
  return toIsoDate(new Date(ts));
}
