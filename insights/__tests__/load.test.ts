import {describe, expect, it} from '@jest/globals';
import {addDays} from '@/lib/dates';
import {activityLoad, computeLoad, dailyLoads, dedupeActivities, formZoneFor, hrProfile, loadTarget, trimp} from '@/insights/load';
import {daily, steady, TODAY} from '@/insights/__fixtures__/series';
import {Activity} from '@/metrics/types';

const activity = (over: Partial<Activity> = {}): Activity => ({
  id: 'a', source: 'garmin', date: TODAY, startTs: 0, durationMin: 30, type: 'running', name: null, avgHr: null, maxHr: null,
  kcal: null, distanceKm: null, aerobicTe: null, anaerobicTe: null, garminLoad: null, zoneMin: null, ...over,
});

describe('training load', () => {
  const profile = {restingHr: 60, maxHr: 190, maxHrSource: 'setting' as const, sex: null};

  it('scores heart-rate load with TRIMP and estimates it without heart rate', () => {
    expect(Math.round(trimp(30, 125, profile))).toBe(25);
    expect(activityLoad(activity({avgHr: 160}), profile)).toBeGreaterThan(activityLoad(activity({avgHr: 125}), profile));
    expect(activityLoad(activity({type: 'walking', durationMin: 60}), profile)).toBe(30);
  });

  it('picks the max HR from settings, then observed highs, then age', () => {
    const data = daily({resting_hr: steady(TODAY, 30, 55), hr_max: steady(TODAY, 30, 180, 2)});
    expect(hrProfile(data, TODAY, {maxHr: 200})).toEqual({restingHr: 55, maxHr: 200, maxHrSource: 'setting', sex: null});
    expect(hrProfile(data, TODAY, {}).maxHrSource).toBe('default');
    expect(hrProfile(data, TODAY, {birthYear: 1996})).toEqual({restingHr: 55, maxHr: 187, maxHrSource: 'age', sex: null});
    const high = daily({hr_max: steady(TODAY, 30, 196, 2)});
    expect(hrProfile(high, TODAY, {birthYear: 1996}).maxHrSource).toBe('observed');
  });

  it('drops Health Connect copies of Garmin workouts', () => {
    const g = activity({id: 'g', startTs: 1_000_000});
    const copy = activity({id: 'h', source: 'health_connect', startTs: 1_000_000 + 60_000});
    const other = activity({id: 'o', source: 'health_connect', startTs: 1_000_000 + 4 * 3_600_000});
    expect(dedupeActivities([copy, g, other]).map((a) => a.id)).toEqual(['g', 'o']);
    const twin = activity({id: 'h2', source: 'health_connect', startTs: other.startTs + 120_000});
    expect(dedupeActivities([other, twin]).map((a) => a.id)).toEqual(['o']);
  });

  it('uses the larger of workout load and intensity minutes, skipping days with no data', () => {
    const data = daily({intensity_min: new Map([[addDays(TODAY, -2), 40], [TODAY, 10]])});
    const loads = dailyLoads(data, [activity({type: 'walking', durationMin: 30})], profile, TODAY);
    expect([...loads]).toEqual([[addDays(TODAY, -2), 40], [TODAY, 15]]);
  });

  it('ignores today\'s unfinished load and days the watch was off', () => {
    const minutes = steady(TODAY, 60, 40, 5);
    minutes.set(TODAY, 0);
    for (let i = 10; i < 17; i++) minutes.delete(addDays(TODAY, -i));
    const report = computeLoad(daily({intensity_min: minutes}), [], TODAY, {}, 'ready');
    expect({status: report.status, todayLoad: report.today?.load}).toEqual({status: 'maintaining', todayLoad: 0});
  });

  it('reports status, form and a target from steady training', () => {
    const data = daily({intensity_min: steady(TODAY, 60, 40, 5), resting_hr: steady(TODAY, 60, 55)});
    const report = computeLoad(data, [], TODAY, {}, 'ready');
    expect({status: report.status, zone: report.formZone, target: report.target, chronic: report.chronic}).toEqual({
      status: 'maintaining',
      zone: 'grey',
      target: {low: 30, high: 50, reason: 'A normal training day suits you today.'},
      chronic: 40,
    });
  });

  it('flags a spike and needs three weeks before judging', () => {
    const quiet = steady(addDays(TODAY, -7), 40, 20, 0);
    for (let i = 0; i < 7; i++) quiet.set(addDays(TODAY, -i), 80);
    expect(computeLoad(daily({intensity_min: quiet}), [], TODAY).status).toBe('overreaching');
    expect(computeLoad(daily({intensity_min: steady(TODAY, 10, 40)}), [], TODAY).status).toBe('calibrating');
  });

  it('maps form to zones and softens targets for sickness', () => {
    expect([30, 10, 0, -20, -40].map(formZoneFor)).toEqual(['transition', 'fresh', 'grey', 'optimal', 'high_risk']);
    expect(loadTarget(40, 'go', 'sick')).toEqual({low: 0, high: 10, reason: 'You are marked as sick, so keep it to gentle movement.'});
    expect(loadTarget(40, 'recover', null)).toEqual({low: 0, high: 15, reason: 'Your body needs rest, so stick to light movement.'});
  });
});
