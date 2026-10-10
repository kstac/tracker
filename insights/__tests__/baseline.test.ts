import {describe, expect, it} from '@jest/globals';
import {addDays} from '@/lib/dates';
import {computeBaseline, deviation, recentWeightedMean, windowPoints} from '@/insights/baseline';
import {daily, fromValues, steady, TODAY, withValue} from '@/insights/__fixtures__/series';

describe('baseline', () => {
  it('is calibrating until there are 14 points in the long window', () => {
    expect(computeBaseline(steady(TODAY, 13, 60, 0), TODAY)).toEqual({shortMean: expect.closeTo(60), shortN: 13, longMean: 60, longSd: 0, longN: 13, ready: false});
    expect(computeBaseline(steady(TODAY, 30, 60, 0), TODAY)).toEqual({shortMean: expect.closeTo(60), shortN: 14, longMean: 60, longSd: 0, longN: 30, ready: true});
  });

  it('ignores points outside the window and returns them oldest first', () => {
    const series = fromValues(TODAY, [1, 2, 3, 4]);
    expect(windowPoints(series, TODAY, 2)).toEqual([
      {date: addDays(TODAY, -1), value: 3},
      {date: TODAY, value: 4},
    ]);
    expect(computeBaseline(undefined, TODAY)).toEqual({shortMean: null, shortN: 0, longMean: null, longSd: null, longN: 0, ready: false});
  });

  it('weights recent days more heavily', () => {
    const series = fromValues(TODAY, [...Array(13).fill(50), 70]);
    const weighted = recentWeightedMean(series, TODAY)!;
    expect(weighted).toBeGreaterThan((50 * 13 + 70) / 14);
  });

  it('measures deviation against the 60 days before the date', () => {
    const series = withValue(steady(addDays(TODAY, -1), 30, 55, 1), TODAY, 61);
    const dev = deviation(daily({resting_hr: series}), 'resting_hr', TODAY)!;
    expect({value: dev.value, diff: Math.round(dev.diff), ready: dev.ready, zAbove3: dev.z > 3}).toEqual({value: 61, diff: 6, ready: true, zAbove3: true});
    expect(deviation(daily({}), 'resting_hr', TODAY)).toBeNull();
  });
});
