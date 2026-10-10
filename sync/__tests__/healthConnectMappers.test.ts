import {dailyAverages, exerciseMinutesByDay, mapSleepSessions} from '@/sync/healthConnectMappers';

const iso = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi).toISOString();

describe('Health Connect mappers', () => {
  it('sums sleep stages per session and keeps the longest session per wake date', () => {
    const nights = mapSleepSessions([
      {
        startTime: iso(2026, 10, 8, 23), endTime: iso(2026, 10, 9, 7),
        stages: [
          {startTime: iso(2026, 10, 8, 23), endTime: iso(2026, 10, 9, 0), stage: 4},
          {startTime: iso(2026, 10, 9, 0), endTime: iso(2026, 10, 9, 1, 30), stage: 5},
          {startTime: iso(2026, 10, 9, 1, 30), endTime: iso(2026, 10, 9, 2), stage: 1},
          {startTime: iso(2026, 10, 9, 2), endTime: iso(2026, 10, 9, 3, 30), stage: 6},
          {startTime: iso(2026, 10, 9, 3, 30), endTime: iso(2026, 10, 9, 7), stage: 2},
        ],
      },
      {startTime: iso(2026, 10, 9, 14), endTime: iso(2026, 10, 9, 14, 30)},
    ]);
    expect(nights).toEqual([
      {
        date: '2026-10-09', source: 'health_connect',
        startTs: Date.parse(iso(2026, 10, 8, 23)), endTs: Date.parse(iso(2026, 10, 9, 7)),
        deepMin: 90, lightMin: 270, remMin: 90, awakeMin: 30,
      },
    ]);
  });

  it('averages or takes the minimum of instantaneous records per local day', () => {
    const records = [
      {time: iso(2026, 10, 9, 2), percentage: 94},
      {time: iso(2026, 10, 9, 3), percentage: 98},
      {time: iso(2026, 10, 10, 3), percentage: 97},
    ];
    expect(dailyAverages(records, 'spo2_avg', (r) => r.time, (r) => r.percentage)).toEqual([
      {date: '2026-10-09', metric: 'spo2_avg', source: 'health_connect', value: 96},
      {date: '2026-10-10', metric: 'spo2_avg', source: 'health_connect', value: 97},
    ]);
    expect(dailyAverages(records, 'spo2_low', (r) => r.time, (r) => r.percentage, 'min')[0].value).toBe(94);
  });
});

describe('exerciseMinutesByDay', () => {
  it('merges overlapping sessions and skips auto-detected ones', () => {
    expect(
      exerciseMinutesByDay([
        {startTime: iso(2026, 10, 9, 7), endTime: iso(2026, 10, 9, 8), metadata: {dataOrigin: 'com.garmin.android.apps.connectmobile', recordingMethod: 1}},
        {startTime: iso(2026, 10, 9, 7, 30), endTime: iso(2026, 10, 9, 8, 15), metadata: {dataOrigin: 'com.sec.android.app.shealth', recordingMethod: 1}},
        {startTime: iso(2026, 10, 9, 12), endTime: iso(2026, 10, 9, 12, 20), metadata: {recordingMethod: 0}},
        {startTime: iso(2026, 10, 9, 14), endTime: iso(2026, 10, 9, 16), metadata: {recordingMethod: 2}},
        {startTime: iso(2026, 10, 10, 18), endTime: iso(2026, 10, 10, 18, 30)},
      ]),
    ).toEqual([
      {date: '2026-10-09', metric: 'exercise_min', source: 'health_connect', value: 95},
      {date: '2026-10-10', metric: 'exercise_min', source: 'health_connect', value: 30},
    ]);
  });
});
