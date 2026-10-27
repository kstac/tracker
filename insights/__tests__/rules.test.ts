import {describe, expect, it} from '@jest/globals';
import {addDays, IsoDate, isWeekend} from '@/lib/dates';
import {
  bedtimeDrift,
  bodyBatteryLow,
  chronotype,
  chronotypeFor,
  generateInsights,
  restingHrLow,
  restingHrTrend,
  shortSleepStreak,
  sleepConsistencyImproved,
  socialJetlag,
  stepsTrend,
  strainRadar,
  vo2Trend,
} from '@/insights/rules';
import {daily, fromValues, steady, TODAY, withValue} from '@/insights/__fixtures__/series';

function merge(...maps: Map<IsoDate, number>[]): Map<IsoDate, number> {
  return new Map(maps.flatMap((m) => [...m]));
}

function build(days: number, fn: (date: IsoDate, i: number) => number | null): Map<IsoDate, number> {
  const out = new Map<IsoDate, number>();
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(TODAY, -i);
    const v = fn(date, i);
    if (v != null) out.set(date, v);
  }
  return out;
}

const yesterday = addDays(TODAY, -1);

describe('strainRadar', () => {
  const base = () => ({
    resting_hr: steady(yesterday, 60, 55, 1),
    sleep_stress: steady(yesterday, 60, 20, 2),
  });

  it('warns when two signals are well above baseline', () => {
    const b = base();
    const insight = strainRadar({
      today: TODAY,
      daily: daily({resting_hr: withValue(b.resting_hr, TODAY, 62), sleep_stress: withValue(b.sleep_stress, TODAY, 30)}),
    });
    expect(insight).toEqual({
      id: 'strain_radar',
      kind: 'warning',
      title: 'Strong signs your body is under strain',
      body: 'Resting heart rate is 7 bpm above your usual and overnight stress is 10 above your usual. Several signals moving together like this often comes before illness, or follows hard training or poor recovery. Consider taking it easy today.',
      priority: 100,
      metric: 'resting_hr',
    });
  });

  it('stays quiet when only one signal moves', () => {
    const b = base();
    expect(strainRadar({today: TODAY, daily: daily({resting_hr: withValue(b.resting_hr, TODAY, 62), sleep_stress: withValue(b.sleep_stress, TODAY, 20)})})).toBeNull();
  });
});

describe('sleep rules', () => {
  it('flags a run of short nights', () => {
    expect(shortSleepStreak({today: TODAY, daily: daily({sleep_total_min: fromValues(TODAY, [400, 410, 500, 390, 380, 480, 400])})})).toEqual({
      id: 'short_sleep_streak',
      kind: 'warning',
      title: 'You\'re running short on sleep',
      body: 'You slept under 7 hours on 5 of the last 7 nights, averaging 7h 03m.',
      priority: 70,
      metric: 'sleep_total_min',
    });
    expect(shortSleepStreak({today: TODAY, daily: daily({sleep_total_min: steady(TODAY, 7, 450, 0)})})).toBeNull();
  });

  it('notices bedtime drifting later', () => {
    const starts = merge(steady(addDays(TODAY, -14), 30, -60, 0), steady(TODAY, 14, -15, 0));
    expect(bedtimeDrift({today: TODAY, daily: daily({sleep_start: starts})})).toEqual({
      id: 'bedtime_drift',
      kind: 'info',
      title: 'Your bedtime is getting later',
      body: 'Over the last 2 weeks you\'ve gone to sleep around 23:45, 45m later than the month before (23:00).',
      priority: 50,
      metric: 'sleep_start',
    });
    expect(bedtimeDrift({today: TODAY, daily: daily({sleep_start: steady(TODAY, 44, -60, 5)})})).toBeNull();
  });

  it('detects weekend social jetlag', () => {
    const mids = build(60, (d) => (isWeekend(d) ? 300 : 200));
    expect(socialJetlag({today: TODAY, daily: daily({sleep_midpoint: mids})})?.body).toBe(
      'On weekends the middle of your sleep is 1h 40m later than on weekdays. Keeping it within an hour makes Mondays easier.',
    );
    expect(socialJetlag({today: TODAY, daily: daily({sleep_midpoint: build(60, (d) => (isWeekend(d) ? 230 : 200))})})).toBeNull();
  });

  it('estimates chronotype after 60 nights', () => {
    expect(chronotype({today: TODAY, daily: daily({sleep_midpoint: steady(TODAY, 60, 200, 0)})})).toEqual({
      id: 'chronotype',
      kind: 'info',
      title: 'Your chronotype: Late morning',
      body: 'Across 60 nights the middle of your sleep is usually around 03:20, which matches a late morning type.',
      priority: 10,
      metric: 'sleep_midpoint',
    });
    expect(chronotype({today: TODAY, daily: daily({sleep_midpoint: steady(TODAY, 59, 200, 0)})})).toBeNull();
    expect([60, 150, 200, 250, 330, 400].map(chronotypeFor)).toEqual(['Early morning', 'Morning', 'Late morning', 'Early evening', 'Evening', 'Late evening']);
  });

  it('celebrates more consistent bedtimes', () => {
    const starts = merge(build(28, (_, i) => (i >= 14 ? (i % 2 ? -120 : 0) : null)), build(14, (_, i) => (i % 2 ? -70 : -50)));
    expect(sleepConsistencyImproved({today: TODAY, daily: daily({sleep_start: starts})})?.id).toBe('sleep_consistency_improved');
    expect(sleepConsistencyImproved({today: TODAY, daily: daily({sleep_start: steady(TODAY, 28, -60, 5)})})).toBeNull();
  });
});

describe('trend rules', () => {
  it('reports a rising VO2 max', () => {
    const vo2 = build(91, (_, i) => (i % 10 === 0 ? 42 - (i / 90) * 2 : null));
    expect(vo2Trend({today: TODAY, daily: daily({vo2max: vo2})})).toEqual({
      id: 'vo2_trend',
      kind: 'positive',
      title: 'VO2 max is rising',
      body: 'Your VO2 max has gone up by about 2 over the last 3 months and is now 42.',
      priority: 45,
      metric: 'vo2max',
    });
    expect(vo2Trend({today: TODAY, daily: daily({vo2max: build(91, (_, i) => (i % 10 === 0 ? 42 : null))})})).toBeNull();
  });

  it('reports resting heart rate trending down', () => {
    const rhr = build(90, (_, i) => 54 + (i / 89) * 4);
    expect(restingHrTrend({today: TODAY, daily: daily({resting_hr: rhr})})?.kind).toBe('positive');
    expect(restingHrTrend({today: TODAY, daily: daily({resting_hr: steady(TODAY, 90, 55, 1)})})).toBeNull();
  });

  it('reports a step count increase', () => {
    const steps = merge(steady(addDays(TODAY, -30), 60, 8000, 0), steady(TODAY, 30, 10000, 0));
    expect(stepsTrend({today: TODAY, daily: daily({steps})})?.body).toBe(
      'You\'ve averaged 10,000 steps a day this month, 25% more than the 2 months before (8,000).',
    );
    expect(stepsTrend({today: TODAY, daily: daily({steps: steady(TODAY, 90, 8000, 100)})})).toBeNull();
  });
});

describe('recovery rules', () => {
  it('warns about a chronically low Body Battery', () => {
    expect(bodyBatteryLow({today: TODAY, daily: daily({body_battery_high: steady(TODAY, 7, 40, 0)})})?.body).toBe(
      'Your Body Battery has peaked at an average of only 40 over the last 7 days. More sleep and some lower-stress days help it recover.',
    );
    expect(bodyBatteryLow({today: TODAY, daily: daily({body_battery_high: steady(TODAY, 7, 60, 0)})})).toBeNull();
  });

  it('celebrates the lowest resting heart rate in a month', () => {
    const rhr = withValue(steady(yesterday, 29, 55, 1), TODAY, 50);
    expect(restingHrLow({today: TODAY, daily: daily({resting_hr: rhr})})?.title).toBe('Lowest resting heart rate this month');
    expect(restingHrLow({today: TODAY, daily: daily({resting_hr: withValue(rhr, TODAY, 54)})})).toBeNull();
  });
});

describe('generateInsights', () => {
  it('returns triggered insights ordered by priority', () => {
    const data = daily({
      sleep_total_min: fromValues(TODAY, [400, 410, 500, 390, 380, 480, 400]),
      body_battery_high: steady(TODAY, 7, 40, 0),
      sleep_midpoint: steady(TODAY, 60, 200, 0),
    });
    expect(generateInsights({today: TODAY, daily: data}).map((i) => i.id)).toEqual(['short_sleep_streak', 'body_battery_low', 'chronotype']);
  });
});
