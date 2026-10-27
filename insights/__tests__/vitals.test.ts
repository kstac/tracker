import {describe, expect, it} from '@jest/globals';
import {addDays} from '@/lib/dates';
import {computeBodyCheck, computeRadar, tierFor, vitalsFor} from '@/insights/vitals';
import {daily, steady, TODAY, withValue} from '@/insights/__fixtures__/series';

const yesterday = addDays(TODAY, -1);

describe('body check', () => {
  it('grades each overnight vital against your normal range', () => {
    const data = daily({
      resting_hr: withValue(steady(yesterday, 60, 55, 1), TODAY, 59),
      sleep_stress: withValue(steady(yesterday, 60, 20, 2), TODAY, 16),
      body_battery_wake: withValue(steady(yesterday, 60, 80, 3), yesterday, 81),
    });
    expect(vitalsFor(data, TODAY).map((v) => [v.label, v.date, v.tier])).toEqual([
      ['Resting heart rate', TODAY, 'notably_off'],
      ['Overnight stress', TODAY, 'favorable'],
      ['Body Battery at wake', yesterday, 'typical'],
    ]);
    expect([2.1, 1.2, 0, -1.5].map(tierFor)).toEqual(['notably_off', 'slightly_off', 'typical', 'favorable']);
  });

  it('rates the radar by how many signals move and explains a hard workout', () => {
    const base = {resting_hr: steady(yesterday, 60, 55, 1), sleep_stress: steady(yesterday, 60, 20, 2), respiration_sleep: steady(yesterday, 60, 14, 0.2)};
    const minor = daily({...base, resting_hr: withValue(base.resting_hr, TODAY, 57.5), sleep_stress: withValue(base.sleep_stress, TODAY, 25)});
    expect(computeRadar(minor, TODAY).level).toBe('minor');
    const major = daily({
      resting_hr: withValue(base.resting_hr, TODAY, 62),
      sleep_stress: withValue(base.sleep_stress, TODAY, 30),
      respiration_sleep: withValue(base.respiration_sleep, TODAY, 15.5),
    });
    const radar = computeRadar(major, TODAY, {loads: new Map([[yesterday, 120]]), chronicLoad: 40});
    expect({level: radar.level, n: radar.hits.length, explanation: radar.explanation}).toEqual({
      level: 'major', n: 3, explanation: 'Yesterday was a much harder training day than usual, which can explain this.',
    });
    expect(computeBodyCheck(major, TODAY).history.slice(-2).map((h) => h.level)).toEqual(['none', 'major']);
  });
});
