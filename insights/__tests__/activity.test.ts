import {describe, expect, it} from '@jest/globals';
import {addDays} from '@/lib/dates';
import {scoreActivity} from '@/insights/activity';
import {daily, fromValues, steady, TODAY} from '@/insights/__fixtures__/series';

describe('scoreActivity', () => {
  it('rewards meeting the step goal, usual calories and a balanced training week', () => {
    const data = daily({
      steps: steady(TODAY, 30, 9000, 0),
      active_kcal: steady(TODAY, 30, 500, 0),
      intensity_min: fromValues(TODAY, [30, 0, 40, 25, 5, 30, 25]),
    });
    expect(scoreActivity({date: TODAY, daily: data})).toEqual({
      value: 100,
      label: 'Optimal',
      calibrating: false,
      date: TODAY,
      contributors: [
        {key: 'steps', label: 'Daily steps', score: 100, detail: '9,000 of 8,000'},
        {key: 'active_calories', label: 'Active calories', score: 100, detail: '500 kcal (usual 500)'},
        {key: 'training_frequency', label: 'Training frequency', score: 100, detail: '5 training days this week'},
        {key: 'training_volume', label: 'Training volume', score: 100, detail: '155 of 150 intensity minutes'},
        {key: 'recovery_time', label: 'Recovery time', score: 100, detail: '2 easy days in a hard week'},
      ],
    });
  });

  it('flags a hard week with no easy days', () => {
    const data = daily({intensity_min: fromValues(TODAY, [30, 30, 30, 30, 30, 30, 30])});
    const recovery = scoreActivity({date: TODAY, daily: data})!.contributors.find((c) => c.key === 'recovery_time');
    expect(recovery).toEqual({key: 'recovery_time', label: 'Recovery time', score: 40, detail: '0 easy days in a hard week'});
  });

  it('scores a sedentary day low and respects a custom step goal', () => {
    const data = daily({steps: fromValues(TODAY, [2500]), exercise_min: fromValues(addDays(TODAY, -1), [0])});
    const score = scoreActivity({date: TODAY, daily: data, stepGoal: 10000})!;
    expect({value: score.value, calibrating: score.calibrating, steps: score.contributors[0].detail}).toEqual({
      value: 31,
      calibrating: true,
      steps: '2,500 of 10,000',
    });
  });

  it('uses Garmin intensity minutes over Health Connect exercise, falling back only on days Garmin is missing', () => {
    const data = daily({
      intensity_min: new Map([
        [addDays(TODAY, -2), 10],
        [addDays(TODAY, -1), 0],
      ]),
      exercise_min: fromValues(TODAY, [180, 180, 180, 180, 180, 180, 180]),
    });
    const volume = scoreActivity({date: TODAY, daily: data})!.contributors.find((c) => c.key === 'training_volume');
    expect(volume).toEqual({key: 'training_volume', label: 'Training volume', score: 100, detail: '910 of 150 intensity minutes'});
  });

  it('returns null without data', () => {
    expect(scoreActivity({date: TODAY, daily: {}})).toBeNull();
  });
});
