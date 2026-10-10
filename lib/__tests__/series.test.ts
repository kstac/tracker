import {average, bucketize, minMax, seriesFor, windowAverage, withGaps} from '@/lib/series';
import {DailyData} from '@/metrics/types';

const daily: DailyData = {
  steps: new Map([
    ['2026-10-05', 1000],
    ['2026-10-06', 3000],
    ['2026-10-07', 5000],
    ['2026-10-12', 7000],
  ]),
};

describe('series helpers', () => {
  it('filters and sorts a metric series by date range', () => {
    expect(seriesFor(daily, 'steps', '2026-10-06', '2026-10-07')).toEqual([
      {date: '2026-10-06', value: 3000},
      {date: '2026-10-07', value: 5000},
    ]);
    expect(seriesFor(daily, 'resting_hr')).toEqual([]);
  });

  it('averages only days that have data in the window', () => {
    expect(windowAverage(daily, 'steps', '2026-10-07', 7)).toBe(3000);
    expect(average([])).toBeNull();
  });

  it('buckets into ISO weeks starting Monday', () => {
    expect(bucketize(seriesFor(daily, 'steps'), 'week', 'mean')).toEqual([
      {date: '2026-10-05', value: 3000},
      {date: '2026-10-12', value: 7000},
    ]);
    expect(bucketize(seriesFor(daily, 'steps'), 'month', 'sum')).toEqual([{date: '2026-10-01', value: 16000}]);
  });

  it('fills gaps with null', () => {
    expect(withGaps(seriesFor(daily, 'steps'), '2026-10-07', '2026-10-09')).toEqual([
      {date: '2026-10-07', value: 5000},
      {date: '2026-10-08', value: null},
      {date: '2026-10-09', value: null},
    ]);
  });

  it('finds min and max points', () => {
    expect(minMax(seriesFor(daily, 'steps'))).toEqual({
      min: {date: '2026-10-05', value: 1000},
      max: {date: '2026-10-12', value: 7000},
    });
  });
});
