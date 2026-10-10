export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function sd(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values)!;
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function weightedMean(values: number[], weights: number[]): number | null {
  let total = 0;
  let weightSum = 0;
  values.forEach((v, i) => {
    total += v * weights[i];
    weightSum += weights[i];
  });
  return weightSum === 0 ? null : total / weightSum;
}

export function zScore(value: number, m: number, s: number): number {
  return s === 0 ? 0 : (value - m) / s;
}

export function cohensD(a: number[], b: number[]): number | null {
  if (a.length < 2 || b.length < 2) return null;
  const ma = mean(a)!;
  const mb = mean(b)!;
  const sa = sd(a)!;
  const sb = sd(b)!;
  const pooled = Math.sqrt(((a.length - 1) * sa ** 2 + (b.length - 1) * sb ** 2) / (a.length + b.length - 2));
  if (pooled === 0) return ma === mb ? 0 : null;
  return (ma - mb) / pooled;
}

/** Least-squares slope of y over x. */
export function slope(points: {x: number; y: number}[]): number | null {
  if (points.length < 2) return null;
  const mx = mean(points.map((p) => p.x))!;
  const my = mean(points.map((p) => p.y))!;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  return den === 0 ? null : num / den;
}

export function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, v));
}

/** Linear interpolation of a score between two anchor points, clamped to [0, 100]. */
export function ramp(value: number, from: number, to: number, scoreFrom = 0, scoreTo = 100): number {
  if (from === to) return value >= to ? scoreTo : scoreFrom;
  const t = (value - from) / (to - from);
  return clamp(scoreFrom + Math.min(1, Math.max(0, t)) * (scoreTo - scoreFrom));
}

export function round(v: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}
