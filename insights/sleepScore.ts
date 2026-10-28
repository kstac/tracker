import {formatClock, formatMinutes, minutesFromMidnight} from '@/lib/dates';
import {SleepNight} from '@/metrics/types';
import {Score} from '@/insights/types';
import {clamp, ramp} from '@/insights/stats';
import {combine, WeightedContributor} from '@/insights/score';

export type SleepPart = 'total' | 'efficiency' | 'restfulness' | 'rem' | 'deep' | 'timing' | 'stress' | 'recovery';

/** Starting weights, loosely following what Garmin's sleep score leans on: duration, overnight stress and stages. */
export const SLEEP_WEIGHTS: Record<SleepPart, number> = {
  total: 0.3,
  stress: 0.15,
  rem: 0.12,
  deep: 0.12,
  restfulness: 0.1,
  recovery: 0.1,
  efficiency: 0.05,
  timing: 0.06,
};

/** Midpoint window (minutes from midnight) that scores full marks for timing. */
export const IDEAL_MIDPOINT = {from: 0, to: 210};

export type SleepScoreOptions = {
  /** Efficiency percentage reported by the source, used instead of asleep / time in bed. */
  efficiency?: number;
  /** The user's usual sleep midpoint, so a consistent late sleeper isn't penalised as hard. */
  personalMidpoint?: number | null;
  /** Garmin's average stress while asleep. Garmin's own score leans on this heavily. */
  sleepStress?: number;
  wakeBattery?: number;
  /** Weights tuned to this user's Garmin scores, replacing SLEEP_WEIGHTS. */
  weights?: Record<SleepPart, number>;
};

export function asleepMinutes(night: SleepNight): number {
  const staged = night.deepMin + night.lightMin + night.remMin;
  if (staged > 0) return staged;
  return Math.max(0, (night.endTs - night.startTs) / 60_000 - night.awakeMin);
}

export function hasStages(night: SleepNight): boolean {
  return night.deepMin + night.lightMin + night.remMin > 0;
}

export function sleepMidpoint(night: SleepNight): number {
  return minutesFromMidnight((night.startTs + night.endTs) / 2, night.date);
}

export function totalSleepScore(min: number): number {
  if (min < 420) return ramp(min, 240, 420, 0, 80);
  if (min < 480) return ramp(min, 420, 480, 80, 100);
  if (min <= 540) return 100;
  return ramp(min, 540, 660, 100, 70);
}

export function timingScore(midpoint: number, personalMidpoint?: number | null): number {
  const distance =
    midpoint < IDEAL_MIDPOINT.from ? IDEAL_MIDPOINT.from - midpoint : midpoint > IDEAL_MIDPOINT.to ? midpoint - IDEAL_MIDPOINT.to : 0;
  const windowScore = clamp(100 - distance / 1.8);
  if (personalMidpoint == null) return windowScore;
  const personalScore = ramp(Math.abs(midpoint - personalMidpoint), 120, 30, 0, 90);
  return Math.max(windowScore, personalScore);
}

export function scoreSleep(night: SleepNight, opts: SleepScoreOptions = {}): Score | null {
  const asleep = asleepMinutes(night);
  if (asleep <= 0) return null;
  const inBed = (night.endTs - night.startTs) / 60_000;
  const efficiency = opts.efficiency ?? (inBed > 0 ? (asleep / inBed) * 100 : null);
  const midpoint = sleepMidpoint(night);
  const w = opts.weights ?? SLEEP_WEIGHTS;

  const parts: WeightedContributor[] = [
    {key: 'total', label: 'Total sleep', weight: w.total, score: totalSleepScore(asleep), detail: formatMinutes(asleep)},
  ];
  if (efficiency != null) {
    parts.push({
      key: 'efficiency',
      label: 'Efficiency',
      weight: w.efficiency,
      score: ramp(efficiency, 80, 95),
      detail: `${Math.round(efficiency)}%`,
    });
  }
  parts.push({
    key: 'restfulness',
    label: 'Restfulness',
    weight: w.restfulness,
    score: ramp(night.awakeMin, 50, 5),
    detail: `${formatMinutes(night.awakeMin)} awake`,
  });
  if (hasStages(night)) {
    // Garmin rates REM against 21-31% of the night and deep sleep against 16-33%.
    const deepPct = (night.deepMin / asleep) * 100;
    const remPct = (night.remMin / asleep) * 100;
    parts.push(
      {key: 'rem', label: 'REM sleep', weight: w.rem, score: ramp(remPct, 10, 21), detail: `${formatMinutes(night.remMin)} (${Math.round(remPct)}%)`},
      {
        key: 'deep',
        label: 'Deep sleep',
        weight: w.deep,
        score: ramp(deepPct, 8, 16),
        detail: `${formatMinutes(night.deepMin)} (${Math.round(deepPct)}%)`,
      },
    );
  }
  parts.push({
    key: 'timing',
    label: 'Timing',
    weight: w.timing,
    score: timingScore(midpoint, opts.personalMidpoint),
    detail: `Midpoint ${formatClock(midpoint)}`,
  });
  if (opts.sleepStress != null) {
    parts.push({key: 'stress', label: 'Overnight stress', weight: w.stress, score: ramp(opts.sleepStress, 30, 10), detail: `Average ${Math.round(opts.sleepStress)}`});
  }
  if (opts.wakeBattery != null) {
    parts.push({key: 'recovery', label: 'Body Battery at wake', weight: w.recovery, score: ramp(opts.wakeBattery, 40, 90), detail: String(Math.round(opts.wakeBattery))});
  }
  return combine(parts, night.date, false);
}
