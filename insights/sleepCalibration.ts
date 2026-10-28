import {SLEEP_WEIGHTS, SleepPart} from '@/insights/sleepScore';
import {Score} from '@/insights/types';

const PARTS = Object.keys(SLEEP_WEIGHTS) as SleepPart[];
export const MIN_CALIBRATION_NIGHTS = 21;
/** Keeps every part in the score so the breakdown still covers it. */
const MIN_WEIGHT = 0.02;
/** Pull towards the starting weights, so a few odd nights can't swing them. */
const PRIOR = 100;
const ITERATIONS = 2000;
/** Points of average gap the tuning must remove to be worth changing the weights. */
const MIN_IMPROVEMENT = 1;

export type SleepCalibration = {weights: Record<SleepPart, number>; nights: number; gapBefore: number; gapAfter: number};

function projectToSimplex(v: number[]): number[] {
  const sorted = [...v].sort((a, b) => b - a);
  let sum = 0;
  let theta = 0;
  for (let i = 0; i < sorted.length; i++) {
    sum += sorted[i];
    const t = (sum - 1) / (i + 1);
    if (sorted[i] - t > 0) theta = t;
  }
  return v.map((x) => Math.max(0, x - theta));
}

const predict = (w: number[], x: number[]) => w.reduce((a, wi, i) => a + wi * x[i], 0);
const gap = (w: number[], rows: {x: number[]; y: number}[]) => rows.reduce((a, r) => a + Math.abs(predict(w, r.x) - r.y), 0) / rows.length;

/**
 * Weights for the app's sleep parts that best reproduce Garmin's scores on nights that have both, by least squares
 * over weights that add up to 1. Returns null until there are enough complete nights or if it barely helps.
 */
export function calibrateSleepWeights(samples: {score: Score; garmin: number}[]): SleepCalibration | null {
  const rows = samples.flatMap(({score, garmin}) => {
    const x = PARTS.map((p) => score.contributors.find((c) => c.key === p)?.score);
    return x.every((v) => v != null) ? [{x: x as number[], y: garmin}] : [];
  });
  if (rows.length < MIN_CALIBRATION_NIGHTS) return null;

  const start = PARTS.map((p) => SLEEP_WEIGHTS[p]);
  const meanSq = PARTS.map((_, i) => rows.reduce((a, r) => a + r.x[i] ** 2, 0) / rows.length);
  const step = 1 / (2 * meanSq.reduce((a, b) => a + b, 0) + 2 * PRIOR);
  let w = start;
  for (let it = 0; it < ITERATIONS; it++) {
    const grad = start.map((s, i) => 2 * PRIOR * (w[i] - s));
    for (const r of rows) {
      const err = predict(w, r.x) - r.y;
      for (let i = 0; i < w.length; i++) grad[i] += (2 * err * r.x[i]) / rows.length;
    }
    w = projectToSimplex(w.map((wi, i) => wi - step * grad[i]));
  }
  const floored = w.map((wi) => Math.max(MIN_WEIGHT, wi));
  const total = floored.reduce((a, b) => a + b, 0);
  w = floored.map((wi) => wi / total);

  const gapBefore = gap(start, rows);
  const gapAfter = gap(w, rows);
  if (gapBefore - gapAfter < MIN_IMPROVEMENT) return null;
  return {weights: Object.fromEntries(PARTS.map((p, i) => [p, w[i]])) as Record<SleepPart, number>, nights: rows.length, gapBefore, gapAfter};
}
