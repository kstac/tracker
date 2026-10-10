import {describe, expect, it} from '@jest/globals';
import {addDays} from '@/lib/dates';
import {computeInsights, computeScoreHistory, InsightInput} from '@/insights';
import {daily, night, steady, TODAY, withValue} from '@/insights/__fixtures__/series';

const base = (): InsightInput => ({
  today: TODAY,
  daily: daily({
    resting_hr: steady(TODAY, 30, 55, 1),
    sleep_total_min: steady(TODAY, 30, 480, 0),
    steps: steady(TODAY, 30, 9000, 0),
  }),
  sleep: Array.from({length: 30}, (_, i) => night(addDays(TODAY, -i))),
  tags: [],
  tagEntries: [],
});

describe('computeScoreHistory', () => {
  it('matches what computeInsights reports for the last day', () => {
    const input = base();
    const report = computeInsights(input);
    const {days} = computeScoreHistory(input, TODAY, TODAY);
    expect(days).toEqual([
      {
        date: TODAY,
        readiness: {value: report.readiness!.value, calibrating: report.readiness!.calibrating},
        sleep: {value: report.sleep!.value, calibrating: report.sleep!.calibrating},
        activity: {value: report.activity!.value, calibrating: report.activity!.calibrating},
      },
    ]);
  });

  it('scores a past day only from data up to that day', () => {
    const past = addDays(TODAY, -5);
    const input = base();
    const before = computeScoreHistory(input, past, past).days;
    const withFutureSpike = {
      ...input,
      daily: {...input.daily, resting_hr: withValue(input.daily.resting_hr!, addDays(TODAY, -1), 80)},
    };
    expect(computeScoreHistory(withFutureSpike, past, past).days).toEqual(before);
  });

  it('returns a row per day with nulls where nothing can be scored', () => {
    const empty: InsightInput = {today: TODAY, daily: {}, sleep: [], tags: [], tagEntries: []};
    const {days, details} = computeScoreHistory(empty, addDays(TODAY, -1), TODAY);
    expect(days).toEqual([
      {date: addDays(TODAY, -1), readiness: null, sleep: null, activity: null},
      {date: TODAY, readiness: null, sleep: null, activity: null},
    ]);
    expect(details(TODAY, 'sleep')).toBeNull();
  });

  it('exposes full score details for a day', () => {
    const {details} = computeScoreHistory(base(), TODAY, TODAY);
    expect(details(TODAY, 'sleep')).toEqual(computeInsights(base()).sleep);
  });
});
