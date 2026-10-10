import {
  aggregateGroupByPeriod,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import type {AggregateResultRecordType, AggregationGroupResult, RecordType} from 'react-native-health-connect';
import {upsertDaily, upsertSamples, upsertSleep} from '@/db/repo';
import {addDays, IsoDate, parseIsoDate, toIsoDate} from '@/lib/dates';
import {DailyRow, MetricId} from '@/metrics/types';
import {sleepDerivedRows} from '@/sync/sleep';
import {dailyAverages, mapHeartRateRecords, mapSleepSessions} from '@/sync/healthConnectMappers';

const READ_TYPES: RecordType[] = [
  'Steps', 'Distance', 'ActiveCaloriesBurned', 'TotalCaloriesBurned', 'HeartRate', 'RestingHeartRate',
  'SleepSession', 'FloorsClimbed', 'ExerciseSession', 'OxygenSaturation', 'RespiratoryRate', 'Weight', 'Vo2Max',
];

const PERMISSIONS = [
  ...READ_TYPES.map((recordType) => ({accessType: 'read' as const, recordType})),
  {accessType: 'read' as const, recordType: 'ReadHealthDataHistory' as const},
  {accessType: 'read' as const, recordType: 'BackgroundAccessPermission' as const},
];

export type HealthConnectStatus = 'unavailable' | 'needs_update' | 'needs_permission' | 'ready';

let initialized = false;

async function ensureInitialized(): Promise<boolean> {
  if (initialized) return true;
  const status = await getSdkStatus();
  if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return false;
  initialized = await initialize();
  return initialized;
}

export async function getHealthConnectStatus(): Promise<HealthConnectStatus> {
  try {
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) return 'unavailable';
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'needs_update';
    if (!(await ensureInitialized())) return 'unavailable';
    const granted = await getGrantedPermissions();
    const readGranted = new Set(granted.filter((p) => p.accessType === 'read').map((p) => p.recordType));
    return READ_TYPES.some((t) => readGranted.has(t)) ? 'ready' : 'needs_permission';
  } catch {
    return 'unavailable';
  }
}

export async function hasHistoryPermission(): Promise<boolean> {
  if (!(await ensureInitialized())) return false;
  const granted = await getGrantedPermissions();
  return granted.some((p) => (p.recordType as string) === 'ReadHealthDataHistory');
}

export async function requestHealthConnectPermissions(): Promise<HealthConnectStatus> {
  if (!(await ensureInitialized())) return 'unavailable';
  await requestPermission(PERMISSIONS);
  return getHealthConnectStatus();
}

export {openHealthConnectSettings};

function range(from: IsoDate, toExclusive: IsoDate) {
  return {
    operator: 'between' as const,
    startTime: parseIsoDate(from).toISOString(),
    endTime: parseIsoDate(toExclusive).toISOString(),
  };
}

async function readAll<T extends RecordType>(recordType: T, from: IsoDate, toExclusive: IsoDate) {
  const out = [];
  let pageToken: string | undefined;
  do {
    const res = await readRecords(recordType, {timeRangeFilter: range(from, toExclusive), pageToken});
    out.push(...res.records);
    pageToken = res.pageToken || undefined;
  } while (pageToken);
  return out;
}

async function aggregateDaily<T extends AggregateResultRecordType>(
  recordType: T,
  from: IsoDate,
  toExclusive: IsoDate,
  pick: (r: AggregationGroupResult<T>['result']) => [MetricId, number | undefined][],
): Promise<DailyRow[]> {
  const groups = await aggregateGroupByPeriod({
    recordType,
    timeRangeFilter: range(from, toExclusive),
    timeRangeSlicer: {period: 'DAYS', length: 1},
  });
  const rows: DailyRow[] = [];
  for (const g of groups) {
    if (!g.result.dataOrigins?.length) continue;
    const date = toIsoDate(new Date(g.startTime));
    for (const [metric, value] of pick(g.result)) {
      if (value != null && Number.isFinite(value)) rows.push({date, metric, source: 'health_connect', value});
    }
  }
  return rows;
}

async function settle<T>(label: string, p: Promise<T>, errors: string[]): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

const HR_SAMPLE_DAYS = 14;

export async function syncHealthConnect(from: IsoDate, toExclusive: IsoDate): Promise<{rows: number; errors: string[]}> {
  if (!(await ensureInitialized())) throw new Error('Health Connect is not available on this device');
  const errors: string[] = [];
  const rows: DailyRow[] = [];
  const push = (r: DailyRow[] | null) => r && rows.push(...r);

  push(await settle('Steps', aggregateDaily('Steps', from, toExclusive, (r) => [['steps', r.COUNT_TOTAL]]), errors));
  push(await settle('Distance', aggregateDaily('Distance', from, toExclusive, (r) => [['distance_km', r.DISTANCE?.inKilometers]]), errors));
  push(await settle('Active calories', aggregateDaily('ActiveCaloriesBurned', from, toExclusive, (r) => [['active_kcal', r.ACTIVE_CALORIES_TOTAL?.inKilocalories]]), errors));
  push(await settle('Total calories', aggregateDaily('TotalCaloriesBurned', from, toExclusive, (r) => [['total_kcal', r.ENERGY_TOTAL?.inKilocalories]]), errors));
  push(await settle('Floors', aggregateDaily('FloorsClimbed', from, toExclusive, (r) => [['floors', r.FLOORS_CLIMBED_TOTAL]]), errors));
  push(await settle('Heart rate', aggregateDaily('HeartRate', from, toExclusive, (r) => [['hr_avg', r.BPM_AVG], ['hr_min', r.BPM_MIN], ['hr_max', r.BPM_MAX]]), errors));
  push(await settle('Resting HR', aggregateDaily('RestingHeartRate', from, toExclusive, (r) => [['resting_hr', r.BPM_AVG]]), errors));
  push(await settle('Exercise', aggregateDaily('ExerciseSession', from, toExclusive, (r) => [['exercise_min', r.EXERCISE_DURATION_TOTAL?.inSeconds / 60]]), errors));
  push(await settle('Weight', aggregateDaily('Weight', from, toExclusive, (r) => [['weight_kg', r.WEIGHT_AVG?.inKilograms]]), errors));

  const spo2 = await settle('SpO2', readAll('OxygenSaturation', from, toExclusive), errors);
  if (spo2) {
    push(dailyAverages(spo2, 'spo2_avg', (r) => r.time, (r) => r.percentage));
    push(dailyAverages(spo2, 'spo2_low', (r) => r.time, (r) => r.percentage, 'min'));
  }
  const resp = await settle('Respiration', readAll('RespiratoryRate', from, toExclusive), errors);
  if (resp) push(dailyAverages(resp, 'respiration_avg', (r) => r.time, (r) => r.rate));
  const vo2 = await settle('VO2 max', readAll('Vo2Max', from, toExclusive), errors);
  if (vo2) push(dailyAverages(vo2, 'vo2max', (r) => r.time, (r) => r.vo2MillilitersPerMinuteKilogram));

  // Sleep sessions ending on `from` started the evening before, so widen the window by a day.
  const sleep = await settle('Sleep', readAll('SleepSession', addDays(from, -1), toExclusive), errors);
  if (sleep) {
    const nights = mapSleepSessions(sleep).filter((n) => n.date >= from);
    await upsertSleep(nights);
    for (const n of nights) push(sleepDerivedRows(n));
  }

  const hrFrom = [from, addDays(toExclusive, -HR_SAMPLE_DAYS)].sort()[1];
  const hr = await settle('HR samples', readAll('HeartRate', hrFrom, toExclusive), errors);
  if (hr) await upsertSamples(mapHeartRateRecords(hr));

  await upsertDaily(rows);
  return {rows: rows.length, errors};
}
