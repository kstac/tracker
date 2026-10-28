import {describe, expect, it} from '@jest/globals';
import {addDays} from '@/lib/dates';
import {computeWeeklySummary, InsightInput, lastCompletedWeek, weekToDate} from '@/insights';
import {weekStart} from '@/insights/tagStats';
import {daily, fromValues, night, TODAY} from '@/insights/__fixtures__/series';

const twoWeeks = (last: number[], current: number[]) => fromValues(TODAY, [...last, ...current]);
const repeat = (v: number) => Array(7).fill(v);

function input(): InsightInput {
  const asleep = [...repeat(420), ...repeat(460)];
  const sleep = asleep.map((a, i) => night(addDays(TODAY, i - 13), {asleep: a, bed: -60}));
  return {
    today: TODAY,
    daily: daily({
      sleep_total_min: fromValues(TODAY, asleep),
      sleep_start: twoWeeks(repeat(-60), repeat(-60)),
      steps: twoWeeks(repeat(6000), repeat(8000)),
      intensity_min: twoWeeks(repeat(10), repeat(25)),
      resting_hr: twoWeeks(repeat(56), repeat(53)),
      stress_avg: twoWeeks(repeat(30), repeat(30)),
    }),
    sleep,
    tags: [],
    tagEntries: [],
  };
}

describe('computeWeeklySummary', () => {
  it('compares the last 7 days with the 7 before', () => {
    const summary = computeWeeklySummary(input(), addDays(TODAY, -6), TODAY);
    const {readiness, sleepScore, activity, bestNight, worstNight, ...thisWeek} = summary.thisWeek;
    expect(thisWeek).toEqual({
      from: addDays(TODAY, -6),
      to: TODAY,
      sleepMin: 460,
      bedtimeSd: 0,
      stepsPerDay: 8000,
      intensityMin: 175,
      restingHr: 53,
      stress: 30,
    });
    expect({from: summary.lastWeek.from, to: summary.lastWeek.to, sleepMin: summary.lastWeek.sleepMin, intensityMin: summary.lastWeek.intensityMin}).toEqual({
      from: addDays(TODAY, -13),
      to: addDays(TODAY, -7),
      sleepMin: 420,
      intensityMin: 70,
    });
    expect([readiness, sleepScore, activity].every((v) => v == null || typeof v === 'number')).toBe(true);
    expect(bestNight && worstNight && bestNight.score >= worstNight.score).toBe(true);
  });

  it('writes highlights for meaningful changes, biggest first', () => {
    expect(computeWeeklySummary(input(), addDays(TODAY, -6), TODAY).highlights).toEqual([
      'You slept 40m more per night than last week (7h 40m average).',
      'You walked 33% more than last week, about 8,000 steps a day.',
      'Resting heart rate dropped 3 bpm to 53 bpm.',
      'Readiness averaged 92, 4 points higher than last week.',
    ]);
  });

  it('handles a week with no data', () => {
    const empty: InsightInput = {today: TODAY, daily: {}, sleep: [], tags: [], tagEntries: []};
    expect(computeWeeklySummary(empty, addDays(TODAY, -6), TODAY)).toEqual({
      thisWeek: {
        from: addDays(TODAY, -6), to: TODAY, readiness: null, sleepScore: null, activity: null, sleepMin: null, bedtimeSd: null,
        stepsPerDay: null, intensityMin: null, restingHr: null, stress: null, bestNight: null, worstNight: null,
      },
      lastWeek: {
        from: addDays(TODAY, -13), to: addDays(TODAY, -7), readiness: null, sleepScore: null, activity: null, sleepMin: null, bedtimeSd: null,
        stepsPerDay: null, intensityMin: null, restingHr: null, stress: null, bestNight: null, worstNight: null,
      },
      highlights: [],
      partial: false,
    });
  });

  it('uses calendar weeks: week to date against the same days last week, and the last full week', () => {
    const wtd = weekToDate(input(), TODAY);
    const monday = weekStart(TODAY);
    expect({from: wtd.thisWeek.from, to: wtd.thisWeek.to, lastFrom: wtd.lastWeek.from, lastTo: wtd.lastWeek.to, partial: wtd.partial}).toEqual({
      from: monday, to: TODAY, lastFrom: addDays(monday, -7), lastTo: addDays(TODAY, -7), partial: TODAY !== addDays(monday, 6),
    });
    const full = lastCompletedWeek(input(), TODAY);
    expect({from: full.thisWeek.from, to: full.thisWeek.to, lastFrom: full.lastWeek.from, partial: full.partial}).toEqual({
      from: addDays(monday, -7), to: addDays(monday, -1), lastFrom: addDays(monday, -14), partial: false,
    });
  });
});

