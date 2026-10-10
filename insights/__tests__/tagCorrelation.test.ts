import {describe, expect, it} from '@jest/globals';
import {addDays, IsoDate} from '@/lib/dates';
import {computeTagEffects} from '@/insights/tagCorrelation';
import {daily, TODAY} from '@/insights/__fixtures__/series';
import {Tag, TagEntry} from '@/metrics/types';

const alcohol: Tag = {id: 'alcohol', name: 'Alcohol', createdAt: 0, unit: null, weeklyLimit: null};

/** 30 days of tag entries ending today; tagged on every third day. */
function entries(tagId: string, days = 30, every = 3, value = 1): TagEntry[] {
  return Array.from({length: days}, (_, i) => ({tagId, date: addDays(TODAY, -i), value: i % every === 0 ? value : 0}));
}

function isTagged(list: TagEntry[], date: IsoDate) {
  return list.some((e) => e.date === date && e.value > 0);
}

describe('computeTagEffects', () => {
  it('finds a lower sleep score on the night after a tagged day', () => {
    const tagEntries = entries('alcohol');
    const sleepScores = new Map<IsoDate, number>();
    for (let i = -1; i < 30; i++) {
      const wake = addDays(TODAY, -i);
      const wobble = i % 2 ? 1 : -1;
      sleepScores.set(wake, (isTagged(tagEntries, addDays(wake, -1)) ? 70 : 80) + wobble);
    }
    const effects = computeTagEffects({today: TODAY, daily: {}, sleepScores, tags: [alcohol], tagEntries});
    expect(effects).toEqual([
      {
        tagId: 'alcohol',
        tagName: 'Alcohol',
        metric: 'sleep_score',
        metricLabel: 'Sleep score',
        lag: 1,
        taggedMean: 70,
        untaggedMean: 80,
        diff: -10,
        cohensD: -9.66,
        nTagged: 10,
        nUntagged: 20,
        summary: 'On days you log Alcohol, your sleep score that night averages 10 points lower (n=10).',
      },
    ]);
  });

  it('uses same-day values for steps', () => {
    const tagEntries = entries('alcohol');
    const steps = new Map<IsoDate, number>();
    for (let i = 0; i < 30; i++) {
      const date = addDays(TODAY, -i);
      steps.set(date, (isTagged(tagEntries, date) ? 4000 : 9000) + (i % 2 ? 300 : -300));
    }
    const [effect] = computeTagEffects({today: TODAY, daily: daily({steps}), sleepScores: new Map(), tags: [alcohol], tagEntries});
    expect({metric: effect.metric, lag: effect.lag, summary: effect.summary}).toEqual({
      metric: 'steps',
      lag: 0,
      summary: 'On days you log Alcohol, your steps that day averages 5,000 lower (n=10).',
    });
  });

  it('ignores tags with too few tagged days, small effects, and days before logging began', () => {
    const few = entries('alcohol', 30, 7);
    const sleepScores = new Map<IsoDate, number>();
    for (let i = -1; i < 60; i++) sleepScores.set(addDays(TODAY, -i), isTagged(few, addDays(TODAY, -i - 1)) ? 70 : 80);
    expect(computeTagEffects({today: TODAY, daily: {}, sleepScores, tags: [alcohol], tagEntries: few})).toEqual([]);

    const noisy = new Map<IsoDate, number>();
    for (let i = -1; i < 30; i++) noisy.set(addDays(TODAY, -i), 75 + (i % 4) * 5);
    expect(computeTagEffects({today: TODAY, daily: {}, sleepScores: noisy, tags: [alcohol], tagEntries: entries('alcohol')})).toEqual([]);
  });

  it('treats a zero entry as untagged and reports duration differences', () => {
    const tagEntries = entries('alcohol');
    const sleep = new Map<IsoDate, number>();
    for (let i = -1; i < 30; i++) {
      const wake = addDays(TODAY, -i);
      sleep.set(wake, (isTagged(tagEntries, addDays(wake, -1)) ? 400 : 460) + (i % 2 ? 5 : -5));
    }
    const [effect] = computeTagEffects({today: TODAY, daily: daily({sleep_total_min: sleep}), sleepScores: new Map(), tags: [alcohol], tagEntries});
    expect({nTagged: effect.nTagged, nUntagged: effect.nUntagged, summary: effect.summary}).toEqual({
      nTagged: 10,
      nUntagged: 20,
      summary: 'On days you log Alcohol, your sleep that night averages 1h 00m shorter (n=10).',
    });
  });
});
