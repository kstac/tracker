import {IsoDate, toIsoDate} from '@/lib/dates';
import {Activity, DailyRow, MetricId, Sample, SleepNight} from '@/metrics/types';

// Mirrors react-native-health-connect's SleepStageType so this module stays importable in jest.
const STAGE = {AWAKE: 1, SLEEPING: 2, OUT_OF_BED: 3, LIGHT: 4, DEEP: 5, REM: 6} as const;

type HcSleepRecord = {startTime: string; endTime: string; stages?: {startTime: string; endTime: string; stage: number}[]};

const minutesBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 60_000;

export function mapSleepSessions(records: HcSleepRecord[]): SleepNight[] {
  const byDate = new Map<IsoDate, SleepNight>();
  for (const r of records) {
    const startTs = Date.parse(r.startTime);
    const endTs = Date.parse(r.endTime);
    if (!(endTs > startTs)) continue;
    const night: SleepNight = {
      date: toIsoDate(new Date(endTs)),
      source: 'health_connect',
      startTs,
      endTs,
      deepMin: 0,
      lightMin: 0,
      remMin: 0,
      awakeMin: 0,
    };
    if (r.stages?.length) {
      for (const s of r.stages) {
        const m = minutesBetween(s.startTime, s.endTime);
        if (s.stage === STAGE.DEEP) night.deepMin += m;
        else if (s.stage === STAGE.REM) night.remMin += m;
        else if (s.stage === STAGE.LIGHT || s.stage === STAGE.SLEEPING) night.lightMin += m;
        else if (s.stage === STAGE.AWAKE || s.stage === STAGE.OUT_OF_BED) night.awakeMin += m;
      }
    } else {
      night.lightMin = (endTs - startTs) / 60_000;
    }
    const existing = byDate.get(night.date);
    if (!existing || night.endTs - night.startTs > existing.endTs - existing.startTs) byDate.set(night.date, night);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function dailyAverages<T>(
  records: T[],
  metric: MetricId,
  timeOf: (r: T) => string,
  valueOf: (r: T) => number | undefined,
  reducer: 'mean' | 'min' = 'mean',
): DailyRow[] {
  const byDate = new Map<IsoDate, number[]>();
  for (const r of records) {
    const v = valueOf(r);
    if (v == null || !Number.isFinite(v)) continue;
    const date = toIsoDate(new Date(timeOf(r)));
    (byDate.get(date) ?? byDate.set(date, []).get(date)!).push(v);
  }
  return [...byDate.entries()].map(([date, values]) => ({
    date,
    metric,
    source: 'health_connect' as const,
    value: reducer === 'min' ? Math.min(...values) : values.reduce((a, b) => a + b, 0) / values.length,
  }));
}

export function mapHeartRateRecords(records: {samples: {time: string; beatsPerMinute: number}[]}[]): Sample[] {
  return records.flatMap((r) =>
    r.samples.map((s) => ({metric: 'heart_rate' as const, ts: Date.parse(s.time), value: s.beatsPerMinute, source: 'health_connect' as const})),
  );
}

export type HcExerciseSession = {
  startTime: string;
  endTime: string;
  exerciseType?: number;
  title?: string;
  metadata?: {id?: string; dataOrigin?: string; recordingMethod?: number};
};

const AUTOMATICALLY_RECORDED = 2;

/**
 * Minutes of deliberate exercise per local day. Auto-detected sessions (e.g. Move IQ walks) are skipped, and
 * overlapping sessions from different apps are merged so the same workout isn't counted twice.
 */
export function exerciseMinutesByDay(sessions: HcExerciseSession[]): DailyRow[] {
  const byDate = new Map<IsoDate, [number, number][]>();
  for (const s of sessions) {
    if (s.metadata?.recordingMethod === AUTOMATICALLY_RECORDED) continue;
    const start = Date.parse(s.startTime);
    const end = Date.parse(s.endTime);
    if (!(end > start)) continue;
    const date = toIsoDate(new Date(start));
    (byDate.get(date) ?? byDate.set(date, []).get(date)!).push([start, end]);
  }
  const rows: DailyRow[] = [];
  for (const [date, intervals] of byDate) {
    intervals.sort((a, b) => a[0] - b[0]);
    let total = 0;
    let [curStart, curEnd] = intervals[0];
    for (const [s, e] of intervals.slice(1)) {
      if (s <= curEnd) curEnd = Math.max(curEnd, e);
      else {
        total += curEnd - curStart;
        [curStart, curEnd] = [s, e];
      }
    }
    total += curEnd - curStart;
    rows.push({date, metric: 'exercise_min', source: 'health_connect', value: total / 60_000});
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

// Mirrors react-native-health-connect's ExerciseType codes for the common activities.
const HC_EXERCISE_TYPES: Record<number, string> = {
  8: 'cycling', 9: 'indoor_cycling', 10: 'hiit', 11: 'boxing', 16: 'dancing', 25: 'elliptical', 26: 'cardio',
  33: 'breathwork', 36: 'hiit', 37: 'hiking', 44: 'martial_arts', 48: 'pilates', 51: 'rock_climbing', 53: 'rowing',
  54: 'indoor_rowing', 56: 'running', 57: 'treadmill_running', 64: 'soccer', 66: 'squash', 68: 'stair_climbing',
  70: 'strength_training', 71: 'stretching', 73: 'swimming', 74: 'swimming', 76: 'tennis', 79: 'walking', 83: 'yoga',
};

/** Deliberate workouts from other apps, so their load counts too. Heart rate comes from the samples when available. */
export function mapExerciseActivities(sessions: HcExerciseSession[], hr: Sample[] = []): Activity[] {
  const out: Activity[] = [];
  for (const s of sessions) {
    if (s.metadata?.recordingMethod === AUTOMATICALLY_RECORDED) continue;
    const start = Date.parse(s.startTime);
    const end = Date.parse(s.endTime);
    if (!(end > start)) continue;
    const inSession = hr.filter((h) => h.ts >= start && h.ts <= end);
    const avg = inSession.length >= 5 ? inSession.reduce((a, h) => a + h.value, 0) / inSession.length : null;
    out.push({
      id: `hc:${s.metadata?.id ?? s.startTime}`,
      source: 'health_connect',
      date: toIsoDate(new Date(start)),
      startTs: start,
      durationMin: (end - start) / 60_000,
      type: HC_EXERCISE_TYPES[s.exerciseType ?? -1] ?? 'other',
      name: s.title || null,
      avgHr: avg == null ? null : Math.round(avg),
      maxHr: inSession.length ? Math.max(...inSession.map((h) => h.value)) : null,
      kcal: null,
      distanceKm: null,
      aerobicTe: null,
      anaerobicTe: null,
      garminLoad: null,
      zoneMin: null,
    });
  }
  return out;
}
