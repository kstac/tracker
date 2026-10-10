import {describe, expect, it} from '@jest/globals';
import {scoreSleep, timingScore, totalSleepScore} from '@/insights/sleepScore';
import {night, TODAY} from '@/insights/__fixtures__/series';

describe('scoreSleep', () => {
  it('scores a full, well-timed night as optimal', () => {
    expect(scoreSleep(night(TODAY))).toEqual({
      value: 99,
      label: 'Optimal',
      calibrating: false,
      date: TODAY,
      contributors: [
        {key: 'total', label: 'Total sleep', score: 100, detail: '8h 00m'},
        {key: 'efficiency', label: 'Efficiency', score: 100, detail: '97%'},
        {key: 'restfulness', label: 'Restfulness', score: 90, detail: '15m awake'},
        {key: 'rem', label: 'REM sleep', score: 100, detail: '1h 45m'},
        {key: 'deep', label: 'Deep sleep', score: 100, detail: '1h 30m (19%)'},
        {key: 'timing', label: 'Timing', score: 100, detail: 'Midpoint 03:08'},
      ],
    });
  });

  it('scores a short, restless, late night poorly', () => {
    const score = scoreSleep(night(TODAY, {bed: 60, asleep: 300, deep: 30, rem: 40, awake: 60}))!;
    expect({value: score.value, label: score.label}).toEqual({value: 39, label: 'Pay attention'});
  });

  it('uses the reported efficiency when given', () => {
    const score = scoreSleep(night(TODAY), {efficiency: 77.5})!;
    expect(score.contributors.find((c) => c.key === 'efficiency')).toEqual({key: 'efficiency', label: 'Efficiency', score: 50, detail: '78%'});
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
    expect([240, 330, 420, 480, 540, 660].map(totalSleepScore)).toEqual([0, 45, 90, 100, 100, 70]);
  });

  it('scores timing against the ideal window, or the personal midpoint when kinder', () => {
    expect([timingScore(120), timingScore(-90), timingScore(390), timingScore(390, 390), timingScore(390, 600)]).toEqual([100, 50, 0, 90, 0]);
  });
});
