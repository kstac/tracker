import {deleteActivities, kvGet, kvSet, replaceBodyBatteryEvents, upsertActivities, upsertDaily, upsertSamples, upsertSleep} from '@/db/repo';
import {GarminClient, GarminRateLimitError} from '@/garmin/client';
import {
  averageHeartRate,
  bodyBatteryAt,
  mapHeartRateSamples,
  mapActivities,
  mapBodyBatteryEvents,
  mapHrv,
  mapMaxMetrics,
  mapSleep,
  mapStressSamples,
  mapUserSummary,
} from '@/garmin/mappers';
import {addDays, daysBetween, IsoDate, today} from '@/lib/dates';
import {Activity, DailyRow} from '@/metrics/types';
import {sleepDerivedRows} from '@/sync/sleep';

const KV = {
  displayName: 'garmin.display_name',
  oldestSynced: 'garmin.oldest_synced',
  hrvSupport: 'garmin.hrv_support',
  backfillDone: 'garmin.backfill_done',
  activitiesSynced: 'garmin.activities_synced',
};

const BACKFILL_DAYS = 365;
const BACKFILL_DAYS_PER_RUN = 45;
const RECENT_DAYS = 3;
const SAMPLE_DAYS = 14;
const HRV_PROBE_DAYS = 5;
const EMPTY_DAYS_TO_STOP_BACKFILL = 30;

export type GarminProgress = {done: number; total: number; date: IsoDate};

async function displayName(client: GarminClient): Promise<string> {
  const cached = await kvGet(KV.displayName);
  if (cached) return cached;
  const name = await client.displayName();
  await kvSet(KV.displayName, name);
  return name;
}

async function syncDay(client: GarminClient, name: string, date: IsoDate, withSamples: boolean, probeHrv: boolean) {
  const rows: DailyRow[] = [];
  rows.push(...mapUserSummary(date, await client.get(`/usersummary-service/usersummary/daily/${name}`, {calendarDate: date})));

  const sleep = mapSleep(date, await client.get(`/wellness-service/wellness/dailySleepData/${name}`, {date, nonSleepBufferMinutes: 60}));
  rows.push(...sleep.rows);
  if (sleep.night) {
    await upsertSleep([sleep.night]);
    rows.push(...sleepDerivedRows(sleep.night));
  }

  let hrvFound = false;
  if (probeHrv) {
    const hrv = mapHrv(date, await client.get(`/hrv-service/hrv/${date}`));
    hrvFound = hrv.length > 0;
    rows.push(...hrv);
  }

  if (withSamples) {
    const stress = mapStressSamples(await client.get(`/wellness-service/wellness/dailyStress/${date}`));
    const hr = mapHeartRateSamples(await client.get(`/wellness-service/wellness/dailyHeartRate/${name}`, {date}));
    await upsertSamples([...stress, ...hr]);
    const avg = averageHeartRate(hr);
    if (avg != null) rows.push({date, metric: 'hr_avg', source: 'garmin', value: avg});
    if (sleep.night && !rows.some((r) => r.metric === 'body_battery_wake')) {
      const wake = bodyBatteryAt(stress, sleep.night.endTs);
      if (wake != null) rows.push({date, metric: 'body_battery_wake', source: 'garmin', value: wake});
    }
    await syncBodyBatteryEvents(client, date);
  }

  await upsertDaily(rows);
  const hasData = !!sleep.night || rows.some((r) => r.metric === 'steps' && r.value > 0);
  return {hrvFound, hasData};
}

/** Not every account or watch has events; a failure here shouldn't stop the day's sync. */
async function syncBodyBatteryEvents(client: GarminClient, date: IsoDate) {
  try {
    const events = mapBodyBatteryEvents(date, await client.get(`/wellness-service/wellness/bodyBattery/events/${date}`));
    await replaceBodyBatteryEvents(date, events);
  } catch (e) {
    if (e instanceof GarminRateLimitError) throw e;
  }
}

const ACTIVITY_PAGE = 100;

/** Replaces the range in one go, so workouts deleted in Garmin Connect disappear here too. */
async function syncActivities(client: GarminClient, from: IsoDate, to: IsoDate) {
  const all: Activity[] = [];
  for (let start = 0; start < 2000; start += ACTIVITY_PAGE) {
    const page = await client.get(`/activitylist-service/activities/search/activities`, {startDate: from, endDate: to, start, limit: ACTIVITY_PAGE});
    all.push(...mapActivities(page));
    if (!Array.isArray(page) || page.length < ACTIVITY_PAGE) break;
  }
  await deleteActivities('garmin', from, addDays(to, 1));
  await upsertActivities(all);
}

async function syncVo2Max(client: GarminClient, from: IsoDate, to: IsoDate) {
  await upsertDaily(mapMaxMetrics(await client.get(`/metrics-service/metrics/maxmet/daily/${from}/${to}`)));
}

/** HRV support is unknown until probed; the vivomove Trend likely has none, so stop asking after a few empty days. */
async function hrvMode(): Promise<'unknown' | 'yes' | 'no'> {
  const v = await kvGet(KV.hrvSupport);
  return v === 'yes' || v === 'no' ? v : 'unknown';
}

export async function syncGarmin(client: GarminClient, onProgress?: (p: GarminProgress) => void) {
  const name = await displayName(client);
  const end = today();
  const oldestSynced = await kvGet(KV.oldestSynced);
  const target = addDays(end, -BACKFILL_DAYS);

  const days: IsoDate[] = [];
  for (let i = 0; i < RECENT_DAYS; i++) days.push(addDays(end, -i));
  let cursor = oldestSynced ? addDays(oldestSynced, -1) : addDays(end, -RECENT_DAYS);
  if (!oldestSynced) {
    for (let i = RECENT_DAYS; i < SAMPLE_DAYS; i++) days.push(addDays(end, -i));
    cursor = addDays(end, -SAMPLE_DAYS);
  }
  const backfill: IsoDate[] = [];
  const backfillDone = !!(await kvGet(KV.backfillDone));
  while (!backfillDone && cursor >= target && backfill.length < BACKFILL_DAYS_PER_RUN) {
    backfill.push(cursor);
    cursor = addDays(cursor, -1);
  }
  const all = [...days, ...backfill];

  let hrv = await hrvMode();
  let hrvEmpty = 0;
  let oldest = oldestSynced || null;
  let emptyRun = 0;
  let stoppedEarly = backfillDone;
  for (const [i, date] of all.entries()) {
    onProgress?.({done: i, total: all.length, date});
    const withSamples = date > addDays(end, -SAMPLE_DAYS);
    const {hrvFound, hasData} = await syncDay(client, name, date, withSamples, hrv !== 'no');
    if (hrv === 'unknown') {
      if (hrvFound) {
        hrv = 'yes';
        await kvSet(KV.hrvSupport, 'yes');
      } else if (++hrvEmpty >= HRV_PROBE_DAYS) {
        hrv = 'no';
        await kvSet(KV.hrvSupport, 'no');
      }
    }
    const extendsContiguousRange = !oldestSynced || i >= days.length;
    if (extendsContiguousRange && (!oldest || date < oldest)) {
      oldest = date;
      await kvSet(KV.oldestSynced, date);
    }
    // Days before the watch was first worn come back empty, so stop walking further back once a long run is empty.
    if (i >= days.length) {
      emptyRun = hasData ? 0 : emptyRun + 1;
      if (emptyRun >= EMPTY_DAYS_TO_STOP_BACKFILL) {
        await kvSet(KV.backfillDone, date);
        stoppedEarly = true;
        break;
      }
    }
  }

  const vo2From = all.length ? all[all.length - 1] : end;
  await syncVo2Max(client, vo2From, end);
  await syncActivities(client, (await kvGet(KV.activitiesSynced)) ? [addDays(end, -7), vo2From].sort()[0] : addDays(end, -BACKFILL_DAYS), end);
  await kvSet(KV.activitiesSynced, end);
  onProgress?.({done: all.length, total: all.length, date: end});
  return {days: all.length, backfillRemaining: stoppedEarly || cursor < target ? 0 : daysBetween(target, cursor) + 1};
}

export async function resetGarminSyncState() {
  await kvSet(KV.oldestSynced, '');
  await kvSet(KV.displayName, '');
  await kvSet(KV.hrvSupport, '');
  await kvSet(KV.backfillDone, '');
  await kvSet(KV.activitiesSynced, '');
}
