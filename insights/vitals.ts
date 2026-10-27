import {addDays, IsoDate} from '@/lib/dates';
import {DailyData, MetricId} from '@/metrics/types';
import {deviation} from '@/insights/baseline';
import {round} from '@/insights/stats';

export type VitalTier = 'notably_off' | 'slightly_off' | 'typical' | 'favorable';

export type Vital = {
  metric: MetricId;
  label: string;
  unit: string;
  decimals: number;
  date: IsoDate;
  value: number;
  mean: number;
  sd: number;
  /** Positive means worse than usual, in standard deviations. */
  badZ: number;
  diff: number;
  tier: VitalTier;
  ready: boolean;
};

type VitalDef = {metrics: MetricId[]; label: string; unit: string; decimals: number; badDirection: 1 | -1};

/** Overnight signals that shift when you're run down, getting sick or under strain. */
export const VITAL_DEFS: VitalDef[] = [
  {metrics: ['resting_hr'], label: 'Resting heart rate', unit: 'bpm', decimals: 0, badDirection: 1},
  {metrics: ['hrv_overnight'], label: 'Overnight HRV', unit: 'ms', decimals: 0, badDirection: -1},
  {metrics: ['sleep_stress'], label: 'Overnight stress', unit: '', decimals: 0, badDirection: 1},
  {metrics: ['respiration_sleep', 'respiration_avg'], label: 'Breathing rate', unit: 'brpm', decimals: 1, badDirection: 1},
  {metrics: ['spo2_low', 'spo2_avg'], label: 'Pulse Ox', unit: '%', decimals: 0, badDirection: -1},
  {metrics: ['body_battery_wake'], label: 'Body Battery at wake', unit: '', decimals: 0, badDirection: -1},
];

export function tierFor(badZ: number): VitalTier {
  if (badZ >= 2) return 'notably_off';
  if (badZ >= 1) return 'slightly_off';
  if (badZ <= -1) return 'favorable';
  return 'typical';
}

export const TIER_LABEL: Record<VitalTier, string> = {
  notably_off: 'Notably off',
  slightly_off: 'Slightly off',
  typical: 'Typical',
  favorable: 'Better than usual',
};

/** The latest reading on `date` or the day before, compared with the 60 days before it. */
export function vitalsFor(daily: DailyData, date: IsoDate): Vital[] {
  const out: Vital[] = [];
  for (const def of VITAL_DEFS) {
    const metric = def.metrics.find((m) => daily[m]?.size);
    if (!metric) continue;
    const day = daily[metric]!.has(date) ? date : daily[metric]!.has(addDays(date, -1)) ? addDays(date, -1) : null;
    if (!day) continue;
    const dev = deviation(daily, metric, day);
    if (!dev) continue;
    const badZ = dev.z * def.badDirection;
    out.push({
      metric,
      label: def.label,
      unit: def.unit,
      decimals: def.decimals,
      date: day,
      value: dev.value,
      mean: dev.mean,
      sd: dev.sd,
      badZ: round(badZ, 2),
      diff: dev.diff,
      tier: dev.ready ? tierFor(badZ) : 'typical',
      ready: dev.ready,
    });
  }
  return out;
}

export type RadarLevel = 'none' | 'minor' | 'major';

export type RadarHit = {metric: MetricId; label: string; text: string; badZ: number};

export type Radar = {date: IsoDate; level: RadarLevel; hits: RadarHit[]; explanation: string | null};

export const RADAR_Z = 1.5;

type RadarSignal = {metric: MetricId; label: string; badDirection: 1 | -1; unit: string; dateOffset: number};

const RADAR_SIGNALS: RadarSignal[] = [
  {metric: 'resting_hr', label: 'resting heart rate', badDirection: 1, unit: ' bpm', dateOffset: 0},
  {metric: 'hrv_overnight', label: 'overnight HRV', badDirection: -1, unit: ' ms', dateOffset: 0},
  {metric: 'respiration_sleep', label: 'sleep respiration', badDirection: 1, unit: ' brpm', dateOffset: 0},
  {metric: 'sleep_stress', label: 'overnight stress', badDirection: 1, unit: '', dateOffset: 0},
  {metric: 'stress_avg', label: 'daytime stress', badDirection: 1, unit: '', dateOffset: -1},
  {metric: 'spo2_low', label: 'lowest Pulse Ox', badDirection: -1, unit: '%', dateOffset: 0},
];

function badZ(daily: DailyData, signal: RadarSignal, date: IsoDate): {z: number; diff: number} | null {
  const dev = deviation(daily, signal.metric, date);
  if (!dev || !dev.ready) return null;
  return {z: dev.z * signal.badDirection, diff: dev.diff};
}

export type RadarContext = {
  /** Training load by day and your usual daily load, so strain after a hard session can be explained. */
  loads?: Map<IsoDate, number>;
  chronicLoad?: number | null;
  /** The user's status on that day, e.g. travelling. */
  status?: string | null;
};

/**
 * Several overnight signals moving the wrong way at once. One signal alone is noise; two is "minor"; three, or two
 * with one far out, is "major". A hard workout the day before or travel explains a lot of this, so it's labelled.
 */
export function computeRadar(daily: DailyData, date: IsoDate, ctx: RadarContext = {}): Radar {
  const hits: RadarHit[] = [];
  for (const base of RADAR_SIGNALS) {
    const signal =
      base.metric === 'respiration_sleep' && !daily.respiration_sleep ? {...base, metric: 'respiration_avg' as MetricId, label: 'respiration'} : base;
    const day = addDays(date, signal.dateOffset);
    const now = badZ(daily, signal, day);
    if (!now) continue;
    const before = badZ(daily, signal, addDays(day, -1));
    const twoDay = before ? (now.z + before.z) / 2 : null;
    if (now.z >= RADAR_Z || (twoDay != null && twoDay >= RADAR_Z)) {
      const amount = round(Math.abs(now.diff), signal.unit === ' brpm' ? 1 : 0);
      hits.push({metric: signal.metric, label: signal.label, badZ: round(now.z, 2), text: `${signal.label} is ${amount}${signal.unit} ${now.diff > 0 ? 'above' : 'below'} your usual`});
    }
  }
  const strongest = Math.max(0, ...hits.map((h) => h.badZ));
  const level: RadarLevel = hits.length >= 3 || (hits.length === 2 && strongest >= 2.5) ? 'major' : hits.length === 2 ? 'minor' : 'none';

  let explanation: string | null = null;
  if (level !== 'none') {
    const yesterdayLoad = ctx.loads?.get(addDays(date, -1));
    if (ctx.status === 'travel') explanation = 'You are travelling, which often shifts these signals.';
    else if (yesterdayLoad != null && ctx.chronicLoad && yesterdayLoad >= 40 && yesterdayLoad >= ctx.chronicLoad * 1.5) {
      explanation = 'Yesterday was a much harder training day than usual, which can explain this.';
    }
  }
  return {date, level, hits, explanation};
}

export type BodyCheck = {date: IsoDate; vitals: Vital[]; radar: Radar; history: {date: IsoDate; level: RadarLevel}[]};

export function computeBodyCheck(daily: DailyData, date: IsoDate, ctx: RadarContext = {}, historyDays = 30): BodyCheck {
  const history: {date: IsoDate; level: RadarLevel}[] = [];
  for (let i = historyDays - 1; i >= 0; i--) {
    const d = addDays(date, -i);
    history.push({date: d, level: computeRadar(daily, d, ctx).level});
  }
  return {date, vitals: vitalsFor(daily, date), radar: computeRadar(daily, date, ctx), history};
}
