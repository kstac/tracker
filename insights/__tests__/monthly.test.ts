import {describe, expect, it} from '@jest/globals';
import {addDays, dateRange} from '@/lib/dates';
import {computeMonthReport, monthEnd, shiftMonth} from '@/insights/monthly';
import {ScoreHistoryDay} from '@/insights/history';
import {DailyData} from '@/metrics/types';

describe('computeMonthReport', () => {
  const sept = dateRange('2026-09-01', '2026-09-30');
  const oct = dateRange('2026-10-01', '2026-10-31');
  const daily: DailyData = {
    steps: new Map([...sept.map((d) => [d, 8000] as const), ...oct.map((d) => [d, 10000] as const)]),
    sleep_total_min: new Map([...sept.map((d) => [d, 420] as const), ...oct.map((d) => [d, 450] as const)]),
  };
  const history: ScoreHistoryDay[] = [...sept, ...oct].map((date) => ({
    date, readiness: {value: date < '2026-10-01' ? 70 : 78, calibrating: false}, sleep: null, activity: null,
  }));

  it('compares a finished month with the one before', () => {
    const r = computeMonthReport({today: '2026-11-03', daily, history, loads: new Map(), activities: [], tags: [], tagEntries: []}, '2026-10-15');
    expect({month: r.month, partial: r.partial, cur: [r.cur.readiness, r.cur.steps, r.cur.sleepMin], prev: [r.prev.readiness, r.prev.steps], highlights: r.highlights}).toEqual({
      month: '2026-10-01',
      partial: false,
      cur: [78, 10000, 450],
      prev: [70, 8000],
      highlights: [
        'You slept 30m more a night than the month before (7h 30m).',
        'Readiness averaged 78, 8 points higher than last month.',
        'You averaged 10,000 steps a day, 25% more than last month.',
      ],
    });
    expect(r.calendar.length).toBe(31);
    expect(r.weekday.steps).toEqual([10000, 10000, 10000, 10000, 10000, 10000, 10000]);
  });

  it('compares a month in progress with the same days last month', () => {
    const r = computeMonthReport({today: '2026-10-10', daily, history, loads: new Map(), activities: [], tags: [], tagEntries: []}, '2026-10-10');
    expect({partial: r.partial, curTo: r.cur.to, prevTo: r.prev.to}).toEqual({partial: true, curTo: '2026-10-10', prevTo: '2026-09-10'});
    expect([shiftMonth('2026-01-01', -1), monthEnd('2026-02-10'), addDays('2026-02-28', 1)]).toEqual(['2025-12-01', '2026-02-28', '2026-03-01']);
  });
});
