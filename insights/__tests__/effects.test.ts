import {describe, expect, it} from '@jest/globals';
import {addDays, IsoDate} from '@/lib/dates';
import {computeEffects, describeDiff, EffectsInput, topEffects} from '@/insights/effects';
import {TODAY} from '@/insights/__fixtures__/series';
import {Tag, TagEntry} from '@/metrics/types';

const tag = (id: string, unit: string | null = null): Tag => ({id, name: id[0].toUpperCase() + id.slice(1), createdAt: 0, unit, weeklyLimit: null});

/** Noise that doesn't repeat on a weekly cycle, so weekdays don't create fake patterns. */
const noise = (i: number) => ((i * 37) % 11) - 5;

function input(over: Partial<EffectsInput> = {}): EffectsInput {
  return {today: TODAY, daily: {}, sleepScores: new Map(), readiness: new Map(), tags: [], tagEntries: [], ...over};
}

describe('computeEffects', () => {
  const days = 90;
  const entries: TagEntry[] = [];
  for (let i = 0; i < days; i++) if (i % 4 === 0) entries.push({tagId: 'alcohol', date: addDays(TODAY, -i), value: i % 8 === 0 ? 4 : 1});

  function scores(effect: (date: IsoDate) => number) {
    const out = new Map<IsoDate, number>();
    for (let i = -1; i < days; i++) {
      const wake = addDays(TODAY, -i);
      out.set(wake, 80 + noise(i) * 0.6 + effect(addDays(wake, -1)));
    }
    return out;
  }

  it('finds a clear next-night effect in real units with a dose split', () => {
    const tagged = new Set(entries.map((e) => e.date));
    const big = new Set(entries.filter((e) => e.value > 1).map((e) => e.date));
    const sleepScores = scores((d) => (tagged.has(d) ? (big.has(d) ? -14 : -6) : 0));
    const report = computeEffects(input({sleepScores, tags: [tag('alcohol', 'drinks')], tagEntries: entries}));
    const e = report.effects.find((x) => x.targetKey === 'sleep_score@1')!;
    expect({
      confidence: e.confidence,
      good: e.good,
      diff: Math.round(e.diff),
      n: [e.nWith, e.nWithout],
      summary: e.summary,
      dose: e.dose?.map((b) => [b.label, Math.round(b.mean), b.n]),
    }).toEqual({
      confidence: 'strong',
      good: false,
      diff: -10,
      n: [23, 66],
      summary: 'After you log Alcohol, your sleep score that night tends to be 10 points lower.',
      dose: [['None', 80, 66], ['Up to 1 drinks', 74, 11], ['More than 1 drinks', 66, 12]],
    });
    expect(topEffects(report.effects).map((x) => x.factorId)).toEqual(['alcohol']);
    expect(report.progress).toEqual([{factorId: 'alcohol', nWith: 23, nWithout: 66, withNeeded: 0, withoutNeeded: 0}]);
  });

  it('separates a confounded tag once the real cause is accounted for', () => {
    const alcohol = new Set(entries.map((e) => e.date));
    const late: TagEntry[] = [];
    for (let i = 0; i < days; i++) {
      const d = addDays(TODAY, -i);
      if (alcohol.has(d) ? i % 12 !== 0 : i % 10 === 1) late.push({tagId: 'late', date: d, value: 1});
    }
    const sleepScores = scores((d) => (alcohol.has(d) ? -10 : 0));
    const report = computeEffects(input({sleepScores, tags: [tag('alcohol'), tag('late')], tagEntries: [...entries, ...late]}));
    const lateEffect = report.effects.find((x) => x.factorId === 'late' && x.targetKey === 'sleep_score@1')!;
    expect(Math.abs(lateEffect.adjustedDiff!)).toBeLessThan(2);
    expect(lateEffect.rawDiff).toBeLessThan(-2);
  });

  it('reports what is still needed and overlapping tags', () => {
    const few: TagEntry[] = [0, 3].map((i) => ({tagId: 'sauna', date: addDays(TODAY, -i), value: 1}));
    const twinA: TagEntry[] = [];
    const twinB: TagEntry[] = [];
    for (let i = 0; i < 40; i += 3) {
      twinA.push({tagId: 'mask', date: addDays(TODAY, -i), value: 1});
      twinB.push({tagId: 'earplugs', date: addDays(TODAY, -i), value: 1});
    }
    const report = computeEffects(input({sleepScores: scores(() => 0), tags: [tag('sauna'), tag('mask'), tag('earplugs')], tagEntries: [...few, ...twinA, ...twinB]}));
    expect(report.progress.find((p) => p.factorId === 'sauna')).toEqual({factorId: 'sauna', nWith: 2, nWithout: 2, withNeeded: 3, withoutNeeded: 3});
    expect(report.overlaps).toEqual([{a: 'mask', b: 'earplugs', aName: 'Mask', bName: 'Earplugs', jaccard: 1}]);
    expect(report.effects.find((e) => e.factorId === 'mask')?.sharedWith).toEqual(['Earplugs']);
  });

  it('finds patterns in your data without any tags', () => {
    const steps = new Map<IsoDate, number>();
    const sleepScores = new Map<IsoDate, number>();
    for (let i = -1; i < days; i++) {
      const d = addDays(TODAY, -i);
      const active = i % 3 === 0;
      steps.set(d, (active ? 14000 : 6000) + noise(i) * 100);
      sleepScores.set(addDays(d, 1), 75 + noise(i + 3) * 0.5 + (active ? 8 : 0));
    }
    const report = computeEffects(input({daily: {steps}, sleepScores}));
    const e = report.effects.find((x) => x.factorId === 'active_day' && x.targetKey === 'sleep_score@1')!;
    expect({confidence: e.confidence, good: e.good, summary: e.summary}).toEqual({
      confidence: 'strong', good: true, summary: 'On your most active days, your sleep score that night tends to be 8 points higher.',
    });
    expect(report.effects.some((x) => x.factorId === 'active_day' && x.targetKey === 'steps@0')).toBe(false);
  });

  it('describes differences in each metric\'s units', () => {
    expect(describeDiff('sleep_total_min', -45)).toBe('45m shorter');
    expect(describeDiff('resting_hr', 3.2)).toBe('3 bpm higher');
    expect(describeDiff('checkin_energy', -0.62)).toBe('0.6 lower out of 5');
    expect(describeDiff('readiness', 1)).toBe('1 point higher');
  });
});
