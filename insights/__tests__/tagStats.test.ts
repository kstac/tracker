import {describe, expect, it} from '@jest/globals';
import {computeTagStats, formatTagAmount, monthlyTotals, unitFromName, weeklyTotals} from '@/insights/tagStats';
import {TagEntry} from '@/metrics/types';

const TODAY = '2026-10-07';
const e = (date: string, value: number): TagEntry => ({tagId: 'beers', date, value});
const ENTRIES = [e('2026-08-10', 2), e('2026-09-01', 1), e('2026-09-28', 3), e('2026-10-05', 4), e('2026-10-06', 0), e('2026-10-12', 5)];

describe('computeTagStats', () => {
  it('summarises streaks, the current week against its limit, trends and weekday pattern', () => {
    const ninth = 1 / 9;
    expect(computeTagStats(ENTRIES, TODAY, 5)).toEqual({
      total: 10,
      daysLogged: 4,
      firstDate: '2026-08-10',
      lastDate: '2026-10-05',
      daysSinceLast: 2,
      currentStreakWithout: 2,
      longestStreakWithout: 26,
      thisWeek: {start: '2026-10-05', total: 4, limit: 5, fraction: 0.8},
      fourWeekAvg: 1.75,
      previousFourWeekAvg: 0.25,
      fourWeekChange: 1.5,
      weekdayAverages: [1, ninth, 0, 0, 0, 0, 0],
    });
  });

  it('handles a tag that has never been logged', () => {
    expect(computeTagStats([], TODAY)).toEqual({
      total: 0,
      daysLogged: 0,
      firstDate: null,
      lastDate: null,
      daysSinceLast: null,
      currentStreakWithout: null,
      longestStreakWithout: null,
      thisWeek: {start: '2026-10-05', total: 0, limit: null, fraction: null},
      fourWeekAvg: 0,
      previousFourWeekAvg: null,
      fourWeekChange: null,
      weekdayAverages: [0, 0, 0, 0, 0, 0, 0],
    });
  });
});

describe('period totals', () => {
  it('sums Monday-start weeks including empty ones', () => {
    expect(weeklyTotals(ENTRIES, '2026-09-24', TODAY)).toEqual([
      {start: '2026-09-21', total: 0, days: 0},
      {start: '2026-09-28', total: 3, days: 1},
      {start: '2026-10-05', total: 4, days: 1},
    ]);
  });

  it('sums calendar months within the range', () => {
    expect(monthlyTotals(ENTRIES, '2026-08-15', TODAY)).toEqual([
      {start: '2026-08-01', total: 0, days: 0},
      {start: '2026-09-01', total: 4, days: 2},
      {start: '2026-10-01', total: 4, days: 1},
    ]);
  });
});

describe('tag formatting helpers', () => {
  it('suggests a unit from a trailing parenthetical', () => {
    expect(['Nicotine (mg)', 'Coffee (cups) ', 'Beers', 'Water (ml) extra'].map(unitFromName)).toEqual(['mg', 'cups', null, null]);
  });

  it('formats amounts with their unit', () => {
    expect([formatTagAmount(6, 'mg'), formatTagAmount(2.25, 'ml'), formatTagAmount(3, null)]).toEqual(['6 mg', '2.3 ml', '3']);
  });
});
