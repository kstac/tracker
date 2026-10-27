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

/** Linear-interpolated quantile, q in [0, 1]. */
export function quantile(values: number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function lnGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (const v of c) ser += v / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betaContinuedFraction(a: number, b: number, x: number): number {
  const EPS = 3e-14;
  const FPMIN = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularised incomplete beta function I_x(a, b). */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (front * betaContinuedFraction(a, b, x)) / a : 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** Two-sided p-value for a t statistic. */
export function tPValue(t: number, df: number): number {
  if (!Number.isFinite(t)) return 0;
  if (df <= 0) return 1;
  return incompleteBeta(df / (df + t * t), df / 2, 0.5);
}

const T_CRITICAL_CACHE = new Map<number, number>();

/** Critical t value for a two-sided 95% interval. */
export function tCritical95(df: number): number {
  if (df > 30) {
    // Cornish–Fisher expansion around the normal quantile; accurate to about 0.001 here.
    const z = 1.959964;
    return z + (z ** 3 + z) / (4 * df) + (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * df ** 2);
  }
  const key = Math.round(df * 4) / 4;
  const hit = T_CRITICAL_CACHE.get(key);
  if (hit != null) return hit;
  const value = tCriticalBisect(key);
  T_CRITICAL_CACHE.set(key, value);
  return value;
}

function tCriticalBisect(df: number): number {
  let lo = 0;
  let hi = 60;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (tPValue(mid, df) > 0.05) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export type MeanDifference = {diff: number; se: number; df: number; p: number; ciLow: number; ciHigh: number};

/** Welch's t-test for the difference in means a − b. */
export function welch(a: number[], b: number[]): MeanDifference | null {
  if (a.length < 2 || b.length < 2) return null;
  const va = sd(a)! ** 2 / a.length;
  const vb = sd(b)! ** 2 / b.length;
  const diff = mean(a)! - mean(b)!;
  const se = Math.sqrt(va + vb);
  if (se === 0) return {diff, se: 0, df: a.length + b.length - 2, p: diff === 0 ? 1 : 0, ciLow: diff, ciHigh: diff};
  const df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1));
  const t = tCritical95(df);
  return {diff, se, df, p: tPValue(diff / se, df), ciLow: diff - t * se, ciHigh: diff + t * se};
}

/** Solves A x = b by Gaussian elimination with partial pivoting; null when A is singular. */
export function solve(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    if (Math.abs(M[pivot][col]) < 1e-12) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

export type Regression = {beta: number[]; se: number[]; df: number};

/**
 * Ordinary least squares. X rows must already include an intercept column. A tiny ridge keeps nearly collinear
 * columns from blowing up; standard errors come from the residual variance.
 */
export function ols(X: number[][], y: number[], ridge = 1e-6): Regression | null {
  const n = X.length;
  const p = X[0]?.length ?? 0;
  if (n <= p + 1) return null;
  const xtx = Array.from({length: p}, () => new Array(p).fill(0));
  const xty = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      xty[j] += X[i][j] * y[i];
      for (let k = j; k < p; k++) xtx[j][k] += X[i][j] * X[i][k];
    }
  }
  for (let j = 0; j < p; j++) {
    for (let k = 0; k < j; k++) xtx[j][k] = xtx[k][j];
    if (j > 0) xtx[j][j] += ridge * n;
  }
  const beta = solve(xtx, xty);
  if (!beta) return null;
  let rss = 0;
  for (let i = 0; i < n; i++) {
    const fit = X[i].reduce((a, x, j) => a + x * beta[j], 0);
    rss += (y[i] - fit) ** 2;
  }
  const df = n - p;
  const sigma2 = rss / df;
  const se = beta.map((_, j) => {
    const e = new Array(p).fill(0);
    e[j] = 1;
    const col = solve(xtx, e);
    return col ? Math.sqrt(Math.max(0, sigma2 * col[j])) : NaN;
  });
  return {beta, se, df};
}

/** Benjamini–Hochberg adjusted p-values (q-values), in the original order. */
export function benjaminiHochberg(ps: number[]): number[] {
  const order = ps.map((p, i) => ({p, i})).sort((a, b) => a.p - b.p);
  const q = new Array(ps.length).fill(1);
  let min = 1;
  for (let k = order.length - 1; k >= 0; k--) {
    min = Math.min(min, (order[k].p * ps.length) / (k + 1));
    q[order[k].i] = Math.min(1, min);
  }
  return q;
}

/** Overlap of two sets of days, |A ∩ B| / |A ∪ B|. */
export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let both = 0;
  for (const v of a) if (b.has(v)) both++;
  return both / (a.size + b.size - both);
}
