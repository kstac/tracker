import {describe, expect, it} from '@jest/globals';
import {addDays} from '@/lib/dates';
import {computeBedtimeShift, computeSleepDebt} from '@/insights/sleepDebt';
import {SleepNight} from '@/metrics/types';

const TODAY = '2026-10-10';

const night = (date: string, asleepMin: number): SleepNight => ({
  date, source: 'garmin', startTs: 0, endTs: asleepMin * 60_000, deepMin: 0, lightMin: asleepMin, remMin: 0, awakeMin: 0,
});

describe('computeSleepDebt', () => {
  it('sums shortfall against the need over 14 nights, letting surplus repay but not bank sleep', () => {
    const nights = [night(addDays(TODAY, -2), 420), night(addDays(TODAY, -1), 450), night(TODAY, 540)];
    const debt = computeSleepDebt(nights, TODAY)!;
    expect({debt: debt.debtMin, counted: debt.nightsCounted, weekAgo: debt.weekAgoDebtMin, last: debt.nights.slice(-3)}).toEqual({
      debt: 30,
      counted: 3,
      weekAgo: null,
      last: [
        {date: addDays(TODAY, -2), asleepMin: 420, diffMin: -60},
        {date: addDays(TODAY, -1), asleepMin: 450, diffMin: -30},
        {date: TODAY, asleepMin: 540, diffMin: 60},
      ],
    });
    expect(computeSleepDebt([night(TODAY, 600), night(addDays(TODAY, -1), 600), night(addDays(TODAY, -2), 600)], TODAY)!.debtMin).toBe(0);
  });

  it('compares with a week earlier and needs at least 3 nights', () => {
    const nights = Array.from({length: 14}, (_, i) => night(addDays(TODAY, -i), i < 7 ? 480 : 420));
    const debt = computeSleepDebt(nights, TODAY)!;
    expect({debt: debt.debtMin, weekAgo: debt.weekAgoDebtMin}).toEqual({debt: 420, weekAgo: 420});
    expect(computeSleepDebt([night(TODAY, 300)], TODAY)).toBeNull();
  });
});

describe('computeBedtimeShift', () => {
  it('compares last night and the past week with the usual bedtime', () => {
    const starts = new Map<string, number>();
    for (let i = 1; i <= 10; i++) starts.set(addDays(TODAY, -i), -60);
    starts.set(TODAY, -15);
    expect(computeBedtimeShift({sleep_start: starts}, TODAY)).toEqual({last: -15, usual: -60, lastDelta: 45, weekAvgDelta: 6});
  });

  it('needs a recent night and enough history', () => {
    const starts = new Map([[addDays(TODAY, -3), -60]]);
    expect(computeBedtimeShift({sleep_start: starts}, TODAY)).toBeNull();
    expect(computeBedtimeShift({sleep_start: new Map([[TODAY, -60]])}, TODAY)).toBeNull();
  });
});
