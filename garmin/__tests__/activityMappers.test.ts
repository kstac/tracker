import {mapActivities, mapBodyBatteryEvents, mapUserSummary, parseGarminGmt} from '@/garmin/mappers';
import {mapExerciseActivities} from '@/sync/healthConnectMappers';

describe('Garmin activity and event mappers', () => {
  it('maps activities with local date, heart rate, training effect and zones', () => {
    expect(
      mapActivities([
        {
          activityId: 42,
          activityName: 'Morning Run',
          startTimeGMT: '2026-10-09 20:30:00',
          startTimeLocal: '2026-10-10 07:30:00',
          duration: 1800,
          distance: 5200,
          calories: 380,
          averageHR: 148,
          maxHR: 171,
          aerobicTrainingEffect: 3.2,
          activityType: {typeKey: 'street_running'},
          hrTimeInZone_1: 60, hrTimeInZone_2: 300, hrTimeInZone_3: 900, hrTimeInZone_4: 540, hrTimeInZone_5: 0,
        },
        {activityId: 43, startTimeGMT: null, duration: 100},
      ]),
    ).toEqual([
      {
        id: 'garmin:42',
        source: 'garmin',
        date: '2026-10-10',
        startTs: Date.UTC(2026, 9, 9, 20, 30),
        durationMin: 30,
        type: 'running',
        name: 'Morning Run',
        avgHr: 148,
        maxHr: 171,
        kcal: 380,
        distanceKm: 5.2,
        aerobicTe: 3.2,
        anaerobicTe: null,
        garminLoad: null,
        zoneMin: [1, 5, 15, 9, 0],
      },
    ]);
  });

  it('parses Garmin GMT timestamps in either format', () => {
    expect(parseGarminGmt('2026-10-10T07:30:00.0')).toBe(Date.UTC(2026, 9, 10, 7, 30));
    expect(parseGarminGmt('2026-10-10 07:30:00')).toBe(Date.UTC(2026, 9, 10, 7, 30));
    expect(parseGarminGmt('nonsense')).toBeNull();
  });

  it('maps Body Battery events', () => {
    expect(
      mapBodyBatteryEvents('2026-10-10', [
        {event: {eventType: 'SLEEP', eventStartTimeGmt: '2026-10-09T13:00:00.0', durationInMilliseconds: 28_800_000, bodyBatteryImpact: 55, shortFeedback: 'RESTFUL'}},
        {event: {eventType: 'ACTIVITY', eventStartTimeGmt: '2026-10-10T00:00:00.0', bodyBatteryImpact: -12}, activityName: 'Run'},
        {event: {eventType: 'STRESS'}},
      ]),
    ).toEqual([
      {date: '2026-10-10', startTs: Date.UTC(2026, 9, 9, 13), durationMin: 480, type: 'sleep', impact: 55, feedback: 'RESTFUL'},
      {date: '2026-10-10', startTs: Date.UTC(2026, 9, 10), durationMin: 0, type: 'activity', impact: -12, feedback: 'Run'},
    ]);
  });

  it('maps the stress breakdown, active time and step goal from the daily summary', () => {
    const rows = mapUserSummary('2026-10-10', {
      restStressDuration: 36_000, lowStressDuration: 7_200, mediumStressDuration: 3_600, highStressDuration: 600,
      sedentarySeconds: 30_000, activeSeconds: 3_000, highlyActiveSeconds: 600, dailyStepGoal: 9_000,
    });
    expect(Object.fromEntries(rows.map((r) => [r.metric, r.value]))).toEqual({
      stress_rest_min: 600, stress_low_min: 120, stress_medium_min: 60, stress_high_min: 10,
      sedentary_min: 500, active_min: 60, garmin_step_goal: 9000,
    });
  });

  it('turns Health Connect sessions into activities with heart rate from samples', () => {
    const start = Date.UTC(2026, 9, 10, 6);
    const hr = Array.from({length: 10}, (_, i) => ({metric: 'heart_rate' as const, ts: start + i * 60_000, value: 120 + i, source: 'health_connect' as const}));
    const [a, ...rest] = mapExerciseActivities(
      [
        {startTime: new Date(start).toISOString(), endTime: new Date(start + 20 * 60_000).toISOString(), exerciseType: 70, metadata: {id: 'x'}},
        {startTime: new Date(start).toISOString(), endTime: new Date(start + 60_000).toISOString(), metadata: {recordingMethod: 2}},
      ],
      hr,
    );
    expect(rest).toEqual([]);
    expect({id: a.id, type: a.type, durationMin: a.durationMin, avgHr: a.avgHr, maxHr: a.maxHr}).toEqual({
      id: 'hc:x', type: 'strength_training', durationMin: 20, avgHr: 125, maxHr: 129,
    });
  });
});
