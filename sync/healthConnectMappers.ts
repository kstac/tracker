import {IsoDate, toIsoDate} from '@/lib/dates';
import {DailyRow, MetricId, Sample, SleepNight} from '@/metrics/types';

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
