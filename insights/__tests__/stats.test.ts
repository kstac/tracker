import {describe, expect, it} from '@jest/globals';
import {clamp, cohensD, mean, median, ramp, round, sd, slope, weightedMean, zScore} from '@/insights/stats';

describe('stats', () => {
  it('summarises values', () => {
    expect({
      mean: mean([1, 2, 3, 4]),
      sd: round(sd([2, 4, 4, 4, 5, 5, 7, 9])!, 3),
      medianEven: median([4, 1, 3, 2]),
      medianOdd: median([3, 1, 2]),
      weighted: weightedMean([10, 20], [1, 3]),
      z: zScore(12, 10, 2),
    }).toEqual({mean: 2.5, sd: 2.138, medianEven: 2.5, medianOdd: 2, weighted: 17.5, z: 1});
  });

  it('returns null for too little data', () => {
    expect([mean([]), sd([1]), median([]), weightedMean([1], [0]), cohensD([1], [1, 2]), slope([{x: 1, y: 1}])]).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it('computes effect size and slope', () => {
    expect(round(cohensD([5, 6, 7], [1, 2, 3])!, 2)).toBe(4);
    expect(slope([{x: 0, y: 1}, {x: 1, y: 3}, {x: 2, y: 5}])).toBe(2);
    expect(zScore(5, 5, 0)).toBe(0);
  });

  it('ramps and clamps in either direction', () => {
    expect([ramp(5, 0, 10), ramp(-1, 0, 10), ramp(20, 0, 10), ramp(10, 60, 10), ramp(60, 60, 10), ramp(35, 60, 10), clamp(120)]).toEqual([
      50, 0, 100, 100, 0, 50, 100,
    ]);
  });
});
