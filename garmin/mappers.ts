import {IsoDate, toIsoDate} from '@/lib/dates';
import {Activity, BodyBatteryEvent, DailyRow, MetricId, Sample, SleepNight} from '@/metrics/types';

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
  const minutes = (v: unknown) => {
    const n = num(v);
    return n == null ? null : n / 60;
  };
  const active = num(s.activeSeconds) == null && num(s.highlyActiveSeconds) == null ? null : ((num(s.activeSeconds) ?? 0) + (num(s.highlyActiveSeconds) ?? 0)) / 60;
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
    ['stress_rest_min', minutes(s.restStressDuration)],
    ['stress_low_min', minutes(s.lowStressDuration)],
    ['stress_medium_min', minutes(s.mediumStressDuration)],
    ['stress_high_min', minutes(s.highStressDuration)],
    ['sedentary_min', minutes(s.sedentarySeconds)],
    ['active_min', active],
    ['garmin_step_goal', positive(s.dailyStepGoal)],
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
    ['garmin_sleep_need', positive(dto.sleepNeed?.actual)],
    ['nap_min', num(dto.napTimeSeconds) == null ? null : dto.napTimeSeconds / 60],
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

const TYPE_ALIASES: Record<string, string> = {
  lap_swimming: 'swimming',
  open_water_swimming: 'swimming',
  street_running: 'running',
  track_running: 'running',
  virtual_ride: 'indoor_cycling',
  road_biking: 'cycling',
  mountain_biking: 'cycling',
  gravel_cycling: 'cycling',
  casual_walking: 'walking',
  speed_walking: 'walking',
  indoor_walking: 'walking',
  indoor_cardio: 'cardio',
};

export function normaliseActivityType(key: unknown): string {
  const k = typeof key === 'string' && key ? key.toLowerCase() : 'other';
  return TYPE_ALIASES[k] ?? k;
}

/** Garmin's GMT timestamps come as "2026-10-10 07:30:00" or ISO strings without a zone. */
export function parseGarminGmt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v !== 'string' || !v) return null;
  // Hermes only reliably parses three-digit fractions, and Garmin sends one ("…:00.0").
  const iso = (v.includes('T') ? v : v.replace(' ', 'T')).replace(/\.(\d{1,3})\d*/, (_, f: string) => `.${f.padEnd(3, '0')}`);
  const ts = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(ts) ? null : ts;
}

export function mapActivities(data: unknown): Activity[] {
  if (!Array.isArray(data)) return [];
  const out: Activity[] = [];
  for (const a of data) {
    const id = a?.activityId;
    const startTs = parseGarminGmt(a?.startTimeGMT);
    const duration = num(a?.duration);
    if (id == null || startTs == null || duration == null || duration <= 0) continue;
    const local = typeof a.startTimeLocal === 'string' ? a.startTimeLocal.slice(0, 10) : calendarDateOf(startTs);
    const zones = [1, 2, 3, 4, 5].map((z) => num(a[`hrTimeInZone_${z}`]));
    const distance = num(a.distance);
    out.push({
      id: `garmin:${id}`,
      source: 'garmin',
      date: local,
      startTs,
      durationMin: duration / 60,
      type: normaliseActivityType(a.activityType?.typeKey),
      name: typeof a.activityName === 'string' ? a.activityName : null,
      avgHr: positive(a.averageHR),
      maxHr: positive(a.maxHR),
      kcal: positive(a.calories),
      distanceKm: distance != null && distance > 0 ? distance / 1000 : null,
      aerobicTe: positive(a.aerobicTrainingEffect),
      anaerobicTe: positive(a.anaerobicTrainingEffect),
      garminLoad: positive(a.activityTrainingLoad),
      zoneMin: zones.some((z) => z != null) ? zones.map((z) => Math.round(((z ?? 0) / 60) * 10) / 10) : null,
    });
  }
  return out;
}

export function mapBodyBatteryEvents(date: IsoDate, data: unknown): BodyBatteryEvent[] {
  if (!Array.isArray(data)) return [];
  const out: BodyBatteryEvent[] = [];
  for (const item of data) {
    const e = item?.event ?? item;
    const startTs = parseGarminGmt(e?.eventStartTimeGmt);
    const impact = num(e?.bodyBatteryImpact);
    if (startTs == null || impact == null) continue;
    const type = typeof e.eventType === 'string' ? e.eventType.toLowerCase() : 'other';
    const feedback = typeof e.shortFeedback === 'string' ? e.shortFeedback : typeof item?.activityName === 'string' ? item.activityName : null;
    out.push({date, startTs, durationMin: (num(e.durationInMilliseconds) ?? 0) / 60_000, type, impact, feedback});
  }
  return out;
}
