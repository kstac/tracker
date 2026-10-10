import {describe, expect, it} from '@jest/globals';
import {addDays} from '@/lib/dates';
import {computeInsights, mainNights} from '@/insights';
import {daily, night, steady, TODAY} from '@/insights/__fixtures__/series';

describe('computeInsights', () => {
  it('scores last night, today and builds the report', () => {
    const sleep = Array.from({length: 30}, (_, i) => night(addDays(TODAY, -i)));
    const report = computeInsights({
      today: TODAY,
      daily: daily({
        resting_hr: steady(TODAY, 30, 55, 1),
        sleep_total_min: steady(TODAY, 30, 480, 0),
        steps: steady(TODAY, 30, 9000, 0),
      }),
      sleep,
      tags: [],
      tagEntries: [],
    });
    expect({
      date: report.date,
      sleep: report.sleep?.value,
      sleepDate: report.sleep?.date,
      readinessCalibrating: report.readiness?.calibrating,
      activity: report.activity?.value,
      nights: report.sleepScores.size,
      insights: report.insights,
      tagEffects: report.tagEffects,
    }).toEqual({
      date: TODAY,
      sleep: 99,
      sleepDate: TODAY,
      readinessCalibrating: false,
      activity: 100,
      nights: 30,
      insights: [],
      tagEffects: [],
    });
  });

  it('falls back to yesterday\'s night and handles no data', () => {
    const report = computeInsights({today: TODAY, daily: {}, sleep: [night(addDays(TODAY, -1))], tags: [], tagEntries: []});
    expect({sleepDate: report.sleep?.date, readiness: report.readiness?.contributors.map((c) => c.key), activity: report.activity}).toEqual({
      sleepDate: addDays(TODAY, -1),
      readiness: ['sleep'],
      activity: null,
    });
  });

  it('keeps the longest recording when sources overlap', () => {
    const short = {...night(TODAY, {asleep: 300}), source: 'health_connect' as const};
    const long = night(TODAY, {asleep: 450});
    expect(mainNights([short, long]).get(TODAY)).toEqual(long);
  });
});
