import {bodyBatteryAt, mapHrv, mapMaxMetrics, mapSleep, mapStressSamples, mapUserSummary} from '@/garmin/mappers';
import {sleepDerivedRows} from '@/sync/sleep';

const g = (date: string, metric: string, value: number) => ({date, metric, source: 'garmin', value});

describe('Garmin mappers', () => {
  it('maps the daily user summary, skipping missing and non-positive sentinel values', () => {
    expect(
      mapUserSummary('2026-10-09', {
        totalSteps: 8123,
        totalDistanceMeters: 6100,
        activeKilocalories: 410,
        totalKilocalories: 2350,
        floorsAscended: 7,
        moderateIntensityMinutes: 20,
        vigorousIntensityMinutes: 5,
        restingHeartRate: 54,
        minHeartRate: 48,
        maxHeartRate: 141,
        averageStressLevel: -1,
        maxStressLevel: 88,
        bodyBatteryHighestValue: 92,
        bodyBatteryLowestValue: 18,
        bodyBatteryChargedValue: 60,
        bodyBatteryDrainedValue: 70,
        averageSpo2: null,
        avgWakingRespirationValue: 14.5,
      }),
    ).toEqual([
      g('2026-10-09', 'steps', 8123),
      g('2026-10-09', 'distance_km', 6.1),
      g('2026-10-09', 'active_kcal', 410),
      g('2026-10-09', 'total_kcal', 2350),
      g('2026-10-09', 'floors', 7),
      g('2026-10-09', 'intensity_min', 30),
      g('2026-10-09', 'resting_hr', 54),
      g('2026-10-09', 'hr_min', 48),
      g('2026-10-09', 'hr_max', 141),
      g('2026-10-09', 'stress_max', 88),
      g('2026-10-09', 'body_battery_high', 92),
      g('2026-10-09', 'body_battery_low', 18),
      g('2026-10-09', 'body_battery_charged', 60),
      g('2026-10-09', 'body_battery_drained', 70),
      g('2026-10-09', 'respiration_avg', 14.5),
    ]);
    expect(mapUserSummary('2026-10-09', null)).toEqual([]);
  });

  it('maps sleep with score, stages and overnight stress', () => {
    const start = new Date(2026, 9, 8, 23, 0).getTime();
    const end = new Date(2026, 9, 9, 7, 0).getTime();
    expect(
      mapSleep('2026-10-09', {
        dailySleepDTO: {
          calendarDate: '2026-10-09',
          sleepStartTimestampGMT: start,
          sleepEndTimestampGMT: end,
          deepSleepSeconds: 5400,
          lightSleepSeconds: 14400,
          remSleepSeconds: 6000,
          awakeSleepSeconds: 3000,
          averageRespirationValue: 13.2,
          avgSleepStress: 17,
          sleepScores: {overall: {value: 81}},
          sleepNeed: {baseline: 480, actual: 500, feedback: 'INCREASED'},
          napTimeSeconds: 1200,
        },
      }),
    ).toEqual({
      night: {date: '2026-10-09', source: 'garmin', startTs: start, endTs: end, deepMin: 90, lightMin: 240, remMin: 100, awakeMin: 50},
      rows: [
        g('2026-10-09', 'garmin_sleep_score', 81), g('2026-10-09', 'sleep_stress', 17), g('2026-10-09', 'respiration_sleep', 13.2),
        g('2026-10-09', 'garmin_sleep_need', 500), g('2026-10-09', 'nap_min', 20),
      ],
    });
    expect(mapSleep('2026-10-09', {dailySleepDTO: {}})).toEqual({night: null, rows: []});
  });

  it('derives sleep timing and efficiency rows relative to the wake date', () => {
    const night = {
      date: '2026-10-09', source: 'garmin' as const,
      startTs: new Date(2026, 9, 8, 23, 0).getTime(), endTs: new Date(2026, 9, 9, 7, 0).getTime(),
      deepMin: 90, lightMin: 240, remMin: 100, awakeMin: 50,
    };
    const byMetric = Object.fromEntries(sleepDerivedRows(night).map((r) => [r.metric, Math.round(r.value * 10) / 10]));
    expect(byMetric).toEqual({
      sleep_total_min: 430,
      sleep_deep_min: 90,
      sleep_light_min: 240,
      sleep_rem_min: 100,
      sleep_awake_min: 50,
      sleep_start: -60,
      sleep_end: 420,
      sleep_midpoint: 180,
      sleep_efficiency: 89.6,
    });
  });

  it('maps HRV only when the device reports it', () => {
    expect(mapHrv('2026-10-09', {hrvSummary: {lastNightAvg: 42}})).toEqual([g('2026-10-09', 'hrv_overnight', 42)]);
    expect(mapHrv('2026-10-09', null)).toEqual([]);
  });

  it('maps VO2 max entries, preferring the precise value', () => {
    expect(
      mapMaxMetrics([
        {generic: {calendarDate: '2026-10-01', vo2MaxPreciseValue: 44.6, vo2MaxValue: 45}},
        {generic: {calendarDate: '2026-10-02', vo2MaxValue: 45}},
        {generic: null},
      ]),
    ).toEqual([g('2026-10-01', 'vo2max', 44.6), g('2026-10-02', 'vo2max', 45)]);
    expect(mapMaxMetrics({})).toEqual([]);
  });

  it('maps stress and Body Battery samples, dropping unmeasurable stress values', () => {
    const samples = mapStressSamples({
      stressValuesArray: [[1000, 25], [2000, -1], [3000, -2]],
      bodyBatteryValuesArray: [[1000, 'MEASURED', 60, 2], [4_000_000, 'MEASURED', 75, 2]],
    });
    expect(samples).toEqual([
      {metric: 'stress', ts: 1000, value: 25, source: 'garmin'},
      {metric: 'body_battery', ts: 1000, value: 60, source: 'garmin'},
      {metric: 'body_battery', ts: 4_000_000, value: 75, source: 'garmin'},
    ]);
    expect(bodyBatteryAt(samples, 3_900_000)).toBe(75);
    expect(bodyBatteryAt(samples, 100_000_000)).toBeNull();
  });
});
