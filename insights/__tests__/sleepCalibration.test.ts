import {describe, expect, it} from '@jest/globals';
import {addDays} from '@/lib/dates';
import {calibrateSleepWeights, MIN_CALIBRATION_NIGHTS} from '@/insights/sleepCalibration';
import {scoreSleep, SLEEP_WEIGHTS} from '@/insights/sleepScore';
import {night, TODAY} from '@/insights/__fixtures__/series';

const stressHeavy = {...SLEEP_WEIGHTS, total: 0.2, stress: 0.35, rem: 0.08, deep: 0.08, restfulness: 0.09, recovery: 0.1, efficiency: 0.04, timing: 0.06};

function samples(n: number) {
  return Array.from({length: n}, (_, i) => {
    const date = addDays(TODAY, -i);
    const opts = {sleepStress: 10 + ((i * 7) % 25), wakeBattery: 50 + ((i * 11) % 45)};
    const n0 = night(date, {asleep: 400 + ((i * 13) % 90), awake: 5 + ((i * 3) % 40)});
    return {score: scoreSleep(n0, opts)!, garmin: scoreSleep(n0, {...opts, weights: stressHeavy})!.value};
  });
}

describe('calibrateSleepWeights', () => {
  it("learns to lean on what Garmin's scores follow and closes most of the gap", () => {
    const c = calibrateSleepWeights(samples(60))!;
    expect({
      nights: c.nights,
      stressUp: c.weights.stress > SLEEP_WEIGHTS.stress,
      sumsToOne: Math.abs(Object.values(c.weights).reduce((a, b) => a + b, 0) - 1) < 1e-9,
      closer: c.gapAfter < c.gapBefore / 2,
    }).toEqual({nights: 60, stressUp: true, sumsToOne: true, closer: true});
  });

  it('waits for enough nights', () => {
    expect(calibrateSleepWeights(samples(MIN_CALIBRATION_NIGHTS - 1))).toBeNull();
  });

  it('leaves the weights alone when they already match', () => {
    const matching = samples(40).map((s) => ({...s, garmin: s.score.value}));
    expect(calibrateSleepWeights(matching)).toBeNull();
  });
});
