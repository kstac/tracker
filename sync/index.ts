import {kvGet, kvSet, migrateLegacyTrackers} from '@/db/repo';
import {GarminAuthError, loadTokens} from '@/garmin/auth';
import {GarminClient, GarminRateLimitError} from '@/garmin/client';
import {addDays, today} from '@/lib/dates';
import {syncGarmin} from '@/sync/garmin';
import {getHealthConnectStatus, hasHistoryPermission, syncHealthConnect} from '@/sync/healthConnect';

export type SourceOutcome =
  | {status: 'skipped'; reason: string}
  | {status: 'ok'; detail: string; warnings: string[]}
  | {status: 'error'; message: string; authBroken?: boolean};

export type SyncReport = {at: number; healthConnect: SourceOutcome; garmin: SourceOutcome};

export type SyncProgress = {source: 'health_connect' | 'garmin'; message: string; fraction?: number};

const KV = {hcLastSync: 'hc.last_sync_date', hcExerciseV2: 'hc.exercise_sessions_v2', lastReport: 'sync.last_report'};

const HC_DAYS_WITHOUT_HISTORY = 29;
const HC_DAYS_WITH_HISTORY = 365;
const RESYNC_OVERLAP_DAYS = 2;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function runHealthConnect(onProgress?: (p: SyncProgress) => void): Promise<SourceOutcome> {
  const status = await getHealthConnectStatus();
  if (status !== 'ready') return {status: 'skipped', reason: status === 'needs_permission' ? 'Permissions not granted' : `Health Connect ${status.replace('_', ' ')}`};
  try {
    const end = today();
    // v2 rebuilt exercise minutes from sessions; older rows came from an aggregate that counted every app's sessions.
    const last = (await kvGet(KV.hcExerciseV2)) ? await kvGet(KV.hcLastSync) : null;
    const from = last
      ? addDays(last, -RESYNC_OVERLAP_DAYS)
      : addDays(end, -((await hasHistoryPermission()) ? HC_DAYS_WITH_HISTORY : HC_DAYS_WITHOUT_HISTORY));
    onProgress?.({source: 'health_connect', message: `Reading Health Connect since ${from}`});
    const {rows, errors} = await syncHealthConnect(from, addDays(end, 1));
    await kvSet(KV.hcLastSync, end);
    await kvSet(KV.hcExerciseV2, '1');
    return {status: 'ok', detail: `${rows} daily values`, warnings: errors};
  } catch (e) {
    return {status: 'error', message: message(e)};
  }
}

async function runGarmin(onProgress?: (p: SyncProgress) => void): Promise<SourceOutcome> {
  const client = await GarminClient.fromStorage();
  if (!client) return {status: 'skipped', reason: 'Not connected'};
  try {
    const res = await syncGarmin(client, (p) =>
      onProgress?.({source: 'garmin', message: `Garmin ${p.date}`, fraction: p.total ? p.done / p.total : undefined}),
    );
    const detail = res.backfillRemaining
      ? `${res.days} days synced, ${res.backfillRemaining} days of history still to fetch`
      : `${res.days} days synced`;
    return {status: 'ok', detail, warnings: []};
  } catch (e) {
    if (e instanceof GarminRateLimitError) return {status: 'error', message: e.message};
    const authBroken = e instanceof GarminAuthError && [400, 401, 403].includes(e.status ?? 0) && !(await loadTokens());
    return {status: 'error', message: message(e), authBroken};
  }
}

let running: Promise<SyncReport> | null = null;

export function runSync(onProgress?: (p: SyncProgress) => void): Promise<SyncReport> {
  running ??= (async () => {
    try {
      await migrateLegacyTrackers();
      const healthConnect = await runHealthConnect(onProgress);
      const garmin = await runGarmin(onProgress);
      const report: SyncReport = {at: Date.now(), healthConnect, garmin};
      await kvSet(KV.lastReport, JSON.stringify(report));
      return report;
    } finally {
      running = null;
    }
  })();
  return running;
}

export async function lastSyncReport(): Promise<SyncReport | null> {
  const raw = await kvGet(KV.lastReport);
  return raw ? JSON.parse(raw) : null;
}

export async function resetHealthConnectSyncState() {
  await kvSet(KV.hcLastSync, '');
}
