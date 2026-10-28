import {describe, expect, it} from '@jest/globals';
import {scoreSleep, timingScore, totalSleepScore} from '@/insights/sleepScore';
import {night, TODAY} from '@/insights/__fixtures__/series';
import {computeSleepScores} from '@/insights/sleepScores';

describe('scoreSleep', () => {
  it('scores a full, well-timed night as optimal', () => {
    expect(scoreSleep(night(TODAY))).toEqual({
      value: 97,
      label: 'Optimal',
      calibrating: false,
      date: TODAY,
      contributors: [
        {key: 'total', label: 'Total sleep', score: 100, detail: '8h 00m', impact: 0},
        {key: 'efficiency', label: 'Efficiency', score: 100, detail: '97%', impact: 0},
        {key: 'restfulness', label: 'Restfulness', score: 78, detail: '15m awake', impact: 3},
        {key: 'rem', label: 'REM sleep', score: 100, detail: '1h 45m (22%)', impact: 0},
        {key: 'deep', label: 'Deep sleep', score: 100, detail: '1h 30m (19%)', impact: 0},
        {key: 'timing', label: 'Timing', score: 100, detail: 'Midpoint 03:08', impact: 0},
      ],
    });
  });

  it('scores a short, restless, late night poorly', () => {
    const score = scoreSleep(night(TODAY, {bed: 60, asleep: 300, deep: 30, rem: 40, awake: 60}))!;
    expect({value: score.value, label: score.label}).toEqual({value: 28, label: 'Pay attention'});
  });

  it('uses the reported efficiency when given', () => {
    const score = scoreSleep(night(TODAY), {efficiency: 77.5})!;
    expect(score.contributors.find((c) => c.key === 'efficiency')).toEqual({key: 'efficiency', label: 'Efficiency', score: 0, detail: '78%', impact: 6.7});
  });

  it('skips stage contributors when the night has no stages', () => {
    const n = {...night(TODAY, {asleep: 420}), deepMin: 0, lightMin: 0, remMin: 0};
    expect(scoreSleep(n)!.contributors.map((c) => c.key)).toEqual(['total', 'efficiency', 'restfulness', 'timing']);
  });

  it('returns null for an empty night', () => {
    const n = night(TODAY);
    expect(scoreSleep({...n, deepMin: 0, lightMin: 0, remMin: 0, endTs: n.startTs})).toBeNull();
  });
});

describe('contributor curves', () => {
  it('rewards 8-9 hours and eases off for very long sleep', () => {
    expect([240, 330, 420, 480, 540, 660].map(totalSleepScore)).toEqual([0, 40, 80, 100, 100, 70]);
  });

  it('scores timing against the ideal window, or the personal midpoint when kinder', () => {
    expect([timingScore(120), timingScore(-90), timingScore(390), timingScore(390, 390), timingScore(390, 600)]).toEqual([100, 50, 0, 90, 0]);
  });
});

describe('computeSleepScores', () => {
  it("uses Garmin's score when there is one and keeps the app's breakdown and estimate", () => {
    const daily = {garmin_sleep_score: new Map([[TODAY, 79]]), sleep_stress: new Map([[TODAY, 25]]), body_battery_wake: new Map([[TODAY, 85]])};
    const own = scoreSleep(night(TODAY), {sleepStress: 25, wakeBattery: 85})!;
    expect(computeSleepScores({sleep: [night(TODAY)], daily}).get(TODAY)).toEqual({...own, value: 79, label: 'Good', source: 'garmin', appValue: own.value});
  });

  it("falls back to the app's own score without a Garmin score", () => {
    expect(computeSleepScores({sleep: [night(TODAY)], daily: {}}).get(TODAY)).toEqual(scoreSleep(night(TODAY)));
  });
});

describe('overnight stress and Body Battery', () => {
  it('pull the score down when stress is high and Body Battery is low', () => {
    const score = scoreSleep(night(TODAY), {sleepStress: 35, wakeBattery: 40})!;
    expect(score.contributors.slice(-2)).toEqual([
      {key: 'stress', label: 'Overnight stress', score: 0, detail: 'Average 35', impact: 15},
      {key: 'recovery', label: 'Body Battery at wake', score: 0, detail: '40', impact: 10},
    ]);
  });
});
