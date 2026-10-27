import {describe, expect, it} from '@jest/globals';
import {benjaminiHochberg, jaccard, ols, quantile, tCritical95, tPValue, welch} from '@/insights/stats';

describe('statistics helpers', () => {
  it('matches reference t-distribution values', () => {
    expect(tPValue(2.228, 10)).toBeCloseTo(0.05, 3);
    expect(tPValue(1.96, 10000)).toBeCloseTo(0.05, 3);
    expect(tPValue(0, 5)).toBeCloseTo(1, 6);
    expect(tCritical95(10)).toBeCloseTo(2.228, 2);
    expect(tCritical95(30)).toBeCloseTo(2.042, 2);
  });

  it('runs Welch\'s test', () => {
    const r = welch([10, 12, 11, 13, 12], [7, 8, 9, 8, 7])!;
    expect(r.diff).toBeCloseTo(3.8, 6);
    expect(r.p).toBeLessThan(0.01);
    expect(r.ciLow).toBeGreaterThan(0);
    expect(welch([1], [2, 3])).toBeNull();
  });

  it('recovers regression coefficients', () => {
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < 40; i++) {
      const a = i % 2;
      const b = (i % 5) / 5;
      X.push([1, a, b]);
      y.push(3 + 2 * a - 4 * b + (i % 3 === 0 ? 0.1 : -0.05));
    }
    const fit = ols(X, y)!;
    expect(fit.beta[1]).toBeCloseTo(2, 1);
    expect(fit.beta[2]).toBeCloseTo(-4, 1);
    expect(fit.se[1]).toBeLessThan(0.1);
  });

  it('adjusts p-values, measures overlap and quantiles', () => {
    expect(benjaminiHochberg([0.01, 0.04, 0.03, 0.5]).map((q) => Math.round(q * 1000) / 1000)).toEqual([0.04, 0.053, 0.053, 0.5]);
    expect(jaccard(new Set([1, 2, 3]), new Set([2, 3, 4]))).toBeCloseTo(0.5);
    expect(quantile([1, 2, 3, 4, 5], 0.75)).toBe(4);
  });
});
