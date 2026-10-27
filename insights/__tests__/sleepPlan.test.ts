import {describe, expect, it} from '@jest/globals';
import {addDays} from '@/lib/dates';
import {baselineNeed, computeSleepPlan, debtLevel, planWakeDate} from '@/insights/sleepPlan';
import {daily, night, steady, TODAY} from '@/insights/__fixtures__/series';

const nights = (asleep: number[], end = TODAY) => asleep.map((a, i) => night(addDays(end, i - asleep.length + 1), {asleep: a}));

describe('sleep plan', () => {
  it('estimates need from your longer nights, within 7–9 hours', () => {
    const mixed = nights(Array.from({length: 30}, (_, i) => (i % 2 ? 420 : 480)));
    expect(baselineNeed(mixed, TODAY)).toEqual({min: 480, source: 'auto'});
    expect(baselineNeed(nights(Array(30).fill(360)), TODAY)).toEqual({min: 420, source: 'auto'});
    expect(baselineNeed(nights([480, 480]), TODAY)).toEqual({min: 480, source: 'default'});
    expect(baselineNeed(mixed, TODAY, {sleepNeedMin: 450})).toEqual({min: 450, source: 'setting'});
  });

  it('adds debt payback and strain, then works back from your usual wake time', () => {
    const sleep = [...nights(Array(16).fill(480), addDays(TODAY, -14)), ...nights(Array(14).fill(420))];
    const data = daily({
      sleep_end: steady(TODAY, 28, 420, 0),
      sleep_start: steady(TODAY, 28, -60, 0),
      sleep_awake_min: steady(TODAY, 28, 20, 0),
    });
    const plan = computeSleepPlan({daily: data, nights: sleep, today: TODAY, wakeDate: addDays(TODAY, 1), todayLoad: 90, chronicLoad: 40});
    expect({
      need: plan.need,
      wakeTarget: plan.wakeTarget,
      bedtime: plan.bedtime,
      debtLevel: plan.debtLevel,
      usualBedtime: plan.usualBedtime,
    }).toEqual({
      need: {baselineMin: 480, source: 'auto', debtRepayMin: 35, strainMin: 25, napMin: 0, tonightMin: 540},
      wakeTarget: 420,
      bedtime: 420 - 540 - 20,
      debtLevel: 'high',
      usualBedtime: -60,
    });
  });

  it('steps an early bedtime in gradually and uses fixed wake targets', () => {
    const sleep = nights(Array(30).fill(480));
    const data = daily({sleep_start: steady(TODAY, 28, 60, 0), sleep_awake_min: steady(TODAY, 28, 15, 0)});
    const plan = computeSleepPlan({daily: data, nights: sleep, today: TODAY, wakeDate: addDays(TODAY, 1), settings: {wakeWeekday: 360, wakeWeekend: 360, gradualBedtime: true}});
    expect({wake: plan.wakeTarget, source: plan.wakeSource, bedtime: plan.bedtime, step: plan.stepBedtime}).toEqual({
      wake: 360, source: 'setting', bedtime: 360 - 480 - 15, step: 30,
    });
  });

  it('labels debt and picks the morning the plan is for', () => {
    expect([0, 60, 200, 400].map(debtLevel)).toEqual(['none', 'low', 'moderate', 'high']);
    expect(planWakeDate(TODAY, new Date(2026, 9, 10, 2))).toBe(TODAY);
    expect(planWakeDate(TODAY, new Date(2026, 9, 10, 20))).toBe(addDays(TODAY, 1));
  });
});
