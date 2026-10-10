import {describe, expect, it} from '@jest/globals';
import {balanceRatioScore, highIsBadScore, loadScore, restingHrScore, scoreReadiness} from '@/insights/readiness';
import {daily, steady, TODAY, withValue} from '@/insights/__fixtures__/series';
import {DailyData} from '@/metrics/types';

function steadyMonth(): DailyData {
  return daily({
    resting_hr: steady(TODAY, 60, 55, 1),
    sleep_total_min: steady(TODAY, 60, 470, 5),
    sleep_start: steady(TODAY, 60, -60, 10),
    sleep_end: steady(TODAY, 60, 420, 10),
    active_kcal: steady(TODAY, 60, 500, 30),
    steps: steady(TODAY, 60, 9000, 500),
    body_battery_wake: steady(TODAY, 60, 80, 3),
    sleep_stress: steady(TODAY, 60, 20, 2),
    stress_avg: steady(TODAY, 60, 30, 3),
  });
}

describe('scoreReadiness', () => {
  it('scores a steady, well-rested month highly with every available contributor', () => {
    const score = scoreReadiness({date: TODAY, daily: steadyMonth(), sleepScore: 90})!;
    expect({
      value: score.value,
      label: score.label,
      calibrating: score.calibrating,
      contributors: score.contributors.map((c) => [c.key, c.label, c.score]),
    }).toEqual({
      value: 97,
      label: 'Optimal',
      calibrating: false,
      contributors: [
        ['resting_hr', 'Resting heart rate', 100],
        ['sleep', 'Last night\'s sleep', 90],
        ['sleep_balance', 'Sleep balance', 100],
        ['sleep_regularity', 'Sleep regularity', 100],
        ['previous_day_activity', 'Previous day activity', 100],
        ['activity_balance', 'Activity balance', 100],
        ['body_battery', 'Body Battery', 92],
        ['hrv_balance', 'Overnight stress (HRV proxy)', 100],
        ['previous_day_stress', 'Previous day stress', 90],
      ],
    });
  });

  it('drops when resting heart rate is well above baseline', () => {
    const data = steadyMonth();
    data.resting_hr = withValue(data.resting_hr!, TODAY, 63);
    const score = scoreReadiness({date: TODAY, daily: data, sleepScore: 90})!;
    expect(score.contributors[0]).toEqual({key: 'resting_hr', label: 'Resting heart rate', score: 25, detail: '63 bpm (+8 vs usual)'});
    expect(score.value).toBeLessThan(97);
  });

  it('uses real HRV when it is available', () => {
    const data = {...steadyMonth(), hrv_overnight: steady(TODAY, 60, 45, 3)};
    const hrv = scoreReadiness({date: TODAY, daily: data, sleepScore: 90})!.contributors.find((c) => c.key === 'hrv_balance');
    expect(hrv).toEqual({key: 'hrv_balance', label: 'HRV balance', score: 100, detail: '45 ms recently vs 45 ms usual'});
  });

  it('is calibrating and skips baseline contributors with only a few days of data', () => {
    const data = daily({resting_hr: steady(TODAY, 5, 55, 1), sleep_total_min: steady(TODAY, 5, 470, 5)});
    const score = scoreReadiness({date: TODAY, daily: data, sleepScore: 80})!;
    expect({calibrating: score.calibrating, keys: score.contributors.map((c) => c.key)}).toEqual({
      calibrating: true,
      keys: ['resting_hr', 'sleep', 'sleep_balance'],
    });
  });

  it('returns null with no data at all', () => {
    expect(scoreReadiness({date: TODAY, daily: {}, sleepScore: null})).toBeNull();
  });
});

describe('readiness curves', () => {
  it('penalises raised resting heart rate more than lowered', () => {
    expect([0, 1, 3, 6, 10, -5, -15].map(restingHrScore)).toEqual([100, 100, 75, 40, 10, 100, 65]);
  });

  it('scores load, balance and stress deviations', () => {
    expect({
      load: [0, 1.5, 3.5, -3].map(loadScore),
      balance: [1, 1.8, 0.5].map(balanceRatioScore),
      stress: [0, 0.5, 2.5].map(highIsBadScore),
    }).toEqual({load: [100, 100, 50, 70], balance: [100, 50, 50], stress: [100, 100, 20]});
  });
});
