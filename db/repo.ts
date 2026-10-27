import AsyncStorage from '@react-native-async-storage/async-storage';
import {randomUUID} from 'expo-crypto';
import {getDb} from '@/db';
import {convertLegacyTrackers, LegacyTracker} from '@/db/legacy';
import {resolveDaily} from '@/db/resolve';
import {IsoDate} from '@/lib/dates';
import {
  Activity,
  BodyBatteryEvent,
  DailyData,
  DailyRow,
  DayNote,
  Experiment,
  MetricId,
  Sample,
  SampleMetric,
  SleepNight,
  Source,
  StatusKind,
  StatusPeriod,
  Tag,
  TagEntry,
  TagUpdate,
} from '@/metrics/types';

const BATCH = 200;

async function inBatches<T>(items: T[], fn: (batch: T[]) => Promise<void>) {
  for (let i = 0; i < items.length; i += BATCH) await fn(items.slice(i, i + BATCH));
}

export async function upsertDaily(rows: DailyRow[]) {
  const valid = rows.filter((r) => Number.isFinite(r.value));
  if (!valid.length) return;
  const db = await getDb();
  const now = Date.now();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await inBatches(valid, async (batch) => {
      const placeholders = batch.map(() => '(?, ?, ?, ?, ?)').join(', ');
      const params = batch.flatMap((r) => [r.date, r.metric, r.source, r.value, now]);
      await txn.runAsync(
        `INSERT INTO daily_metrics (date, metric, source, value, updated_at) VALUES ${placeholders}
         ON CONFLICT (date, metric, source) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        params,
      );
    });
  });
}

export async function deleteDaily(metric: MetricId, source: Source, from: IsoDate, toExclusive: IsoDate) {
  const db = await getDb();
  await db.runAsync('DELETE FROM daily_metrics WHERE metric = ? AND source = ? AND date >= ? AND date < ?', metric, source, from, toExclusive);
}

export async function getDailyRows(from?: IsoDate): Promise<DailyRow[]> {
  const db = await getDb();
  return from
    ? db.getAllAsync<DailyRow>('SELECT date, metric, source, value FROM daily_metrics WHERE date >= ? ORDER BY date', from)
    : db.getAllAsync<DailyRow>('SELECT date, metric, source, value FROM daily_metrics ORDER BY date');
}

export async function loadDailyData(from?: IsoDate): Promise<DailyData> {
  return resolveDaily(await getDailyRows(from));
}

export async function upsertSamples(samples: Sample[]) {
  const valid = samples.filter((s) => Number.isFinite(s.value));
  if (!valid.length) return;
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await inBatches(valid, async (batch) => {
      const placeholders = batch.map(() => '(?, ?, ?, ?)').join(', ');
      const params = batch.flatMap((s) => [s.metric, s.ts, s.source, s.value]);
      await txn.runAsync(
        `INSERT INTO samples (metric, ts, source, value) VALUES ${placeholders}
         ON CONFLICT (metric, ts, source) DO UPDATE SET value = excluded.value`,
        params,
      );
    });
  });
}

export async function getSamples(metric: SampleMetric, fromTs: number, toTs: number): Promise<Sample[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Sample>(
    'SELECT metric, ts, source, value FROM samples WHERE metric = ? AND ts >= ? AND ts < ? ORDER BY ts',
    metric, fromTs, toTs,
  );
  const sources = new Set(rows.map((r) => r.source));
  if (sources.size <= 1) return rows;
  const preferred: Source = sources.has('garmin') ? 'garmin' : rows[0].source;
  return rows.filter((r) => r.source === preferred);
}

type SleepRow = {
  date: string; source: Source; start_ts: number; end_ts: number;
  deep_min: number; light_min: number; rem_min: number; awake_min: number;
};

export async function upsertSleep(nights: SleepNight[]) {
  if (!nights.length) return;
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const n of nights) {
      await txn.runAsync(
        `INSERT INTO sleep_sessions (date, source, start_ts, end_ts, deep_min, light_min, rem_min, awake_min)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (date, source) DO UPDATE SET start_ts = excluded.start_ts, end_ts = excluded.end_ts,
           deep_min = excluded.deep_min, light_min = excluded.light_min, rem_min = excluded.rem_min, awake_min = excluded.awake_min`,
        n.date, n.source, n.startTs, n.endTs, n.deepMin, n.lightMin, n.remMin, n.awakeMin,
      );
    }
  });
}

export async function getSleepNights(from?: IsoDate): Promise<SleepNight[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SleepRow>(
    'SELECT * FROM sleep_sessions WHERE date >= ? ORDER BY date',
    from ?? '0000-00-00',
  );
  const byDate = new Map<string, SleepRow>();
  for (const r of rows) {
    const existing = byDate.get(r.date);
    if (!existing || (r.source === 'garmin' && existing.source !== 'garmin')) byDate.set(r.date, r);
  }
  return [...byDate.values()].map((r) => ({
    date: r.date,
    source: r.source,
    startTs: r.start_ts,
    endTs: r.end_ts,
    deepMin: r.deep_min,
    lightMin: r.light_min,
    remMin: r.rem_min,
    awakeMin: r.awake_min,
  }));
}

export async function listTags(includeArchived = false): Promise<Tag[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{id: string; name: string; created_at: number; unit: string | null; weekly_limit: number | null; archived: number}>(
    `SELECT id, name, created_at, unit, weekly_limit, archived FROM tags ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY created_at`,
  );
  return rows.map((r) => ({id: r.id, name: r.name, createdAt: r.created_at, unit: r.unit, weeklyLimit: r.weekly_limit, archived: r.archived === 1}));
}

export async function setTagArchived(id: string, archived: boolean) {
  const db = await getDb();
  await db.runAsync('UPDATE tags SET archived = ? WHERE id = ?', archived ? 1 : 0, id);
}

export async function createTag(update: TagUpdate): Promise<Tag> {
  const db = await getDb();
  const tag: Tag = {id: randomUUID(), createdAt: Date.now(), ...update, name: update.name.trim()};
  await db.runAsync(
    'INSERT INTO tags (id, name, created_at, unit, weekly_limit) VALUES (?, ?, ?, ?, ?)',
    tag.id, tag.name, tag.createdAt, tag.unit, tag.weeklyLimit,
  );
  return tag;
}

export async function updateTag(id: string, update: TagUpdate) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE tags SET name = ?, unit = ?, weekly_limit = ? WHERE id = ?',
    update.name.trim(), update.unit, update.weeklyLimit, id,
  );
}

export async function deleteTag(id: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM tags WHERE id = ?', id);
}

export async function getTagEntries(from?: IsoDate): Promise<TagEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{tag_id: string; date: string; value: number; time_min: number | null}>(
    'SELECT tag_id, date, value, time_min FROM tag_entries WHERE date >= ? ORDER BY date',
    from ?? '0000-00-00',
  );
  return rows.map((r) => ({tagId: r.tag_id, date: r.date, value: r.value, timeMin: r.time_min}));
}

export async function setTagEntry(tagId: string, date: IsoDate, value: number, timeMin: number | null = null) {
  const db = await getDb();
  if (value <= 0) {
    await db.runAsync('DELETE FROM tag_entries WHERE tag_id = ? AND date = ?', tagId, date);
  } else {
    await db.runAsync(
      `INSERT INTO tag_entries (tag_id, date, value, time_min) VALUES (?, ?, ?, ?)
       ON CONFLICT (tag_id, date) DO UPDATE SET value = excluded.value, time_min = COALESCE(excluded.time_min, tag_entries.time_min)`,
      tagId, date, value, timeMin,
    );
  }
}

/** One value a day for metrics typed in by hand (check-ins, weight, blood pressure). */
export async function setManualValue(metric: MetricId, date: IsoDate, value: number | null) {
  const db = await getDb();
  if (value == null || !Number.isFinite(value)) {
    await db.runAsync("DELETE FROM daily_metrics WHERE metric = ? AND date = ? AND source = 'manual'", metric, date);
    return;
  }
  await upsertDaily([{date, metric, source: 'manual', value}]);
}

type ActivityRow = {
  id: string; source: Source; date: string; start_ts: number; duration_min: number; type: string; name: string | null;
  avg_hr: number | null; max_hr: number | null; kcal: number | null; distance_km: number | null;
  aerobic_te: number | null; anaerobic_te: number | null; garmin_load: number | null; zone_min: string | null;
};

export async function upsertActivities(activities: Activity[]) {
  if (!activities.length) return;
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const a of activities) {
      await txn.runAsync(
        `INSERT OR REPLACE INTO activities (id, source, date, start_ts, duration_min, type, name, avg_hr, max_hr, kcal, distance_km, aerobic_te, anaerobic_te, garmin_load, zone_min)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        a.id, a.source, a.date, a.startTs, a.durationMin, a.type, a.name, a.avgHr, a.maxHr, a.kcal, a.distanceKm,
        a.aerobicTe, a.anaerobicTe, a.garminLoad, a.zoneMin ? JSON.stringify(a.zoneMin) : null,
      );
    }
  });
}

export async function deleteActivities(source: Source, from: IsoDate, toExclusive: IsoDate) {
  const db = await getDb();
  await db.runAsync('DELETE FROM activities WHERE source = ? AND date >= ? AND date < ?', source, from, toExclusive);
}

export async function getActivities(from?: IsoDate): Promise<Activity[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ActivityRow>('SELECT * FROM activities WHERE date >= ? ORDER BY start_ts', from ?? '0000-00-00');
  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    date: r.date,
    startTs: r.start_ts,
    durationMin: r.duration_min,
    type: r.type,
    name: r.name,
    avgHr: r.avg_hr,
    maxHr: r.max_hr,
    kcal: r.kcal,
    distanceKm: r.distance_km,
    aerobicTe: r.aerobic_te,
    anaerobicTe: r.anaerobic_te,
    garminLoad: r.garmin_load,
    zoneMin: r.zone_min ? JSON.parse(r.zone_min) : null,
  }));
}

export async function replaceBodyBatteryEvents(date: IsoDate, events: BodyBatteryEvent[]) {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM body_battery_events WHERE date = ?', date);
    for (const e of events) {
      await txn.runAsync(
        'INSERT OR REPLACE INTO body_battery_events (date, start_ts, duration_min, type, impact, feedback) VALUES (?, ?, ?, ?, ?, ?)',
        e.date, e.startTs, e.durationMin, e.type, e.impact, e.feedback,
      );
    }
  });
}

export async function getBodyBatteryEvents(date: IsoDate): Promise<BodyBatteryEvent[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{date: string; start_ts: number; duration_min: number; type: string; impact: number; feedback: string | null}>(
    'SELECT * FROM body_battery_events WHERE date = ? ORDER BY start_ts', date,
  );
  return rows.map((r) => ({date: r.date, startTs: r.start_ts, durationMin: r.duration_min, type: r.type, impact: r.impact, feedback: r.feedback}));
}

export async function getNotes(): Promise<DayNote[]> {
  const db = await getDb();
  return db.getAllAsync<DayNote>('SELECT date, text FROM notes ORDER BY date');
}

export async function setNote(date: IsoDate, text: string) {
  const db = await getDb();
  if (!text.trim()) await db.runAsync('DELETE FROM notes WHERE date = ?', date);
  else await db.runAsync('INSERT INTO notes (date, text) VALUES (?, ?) ON CONFLICT (date) DO UPDATE SET text = excluded.text', date, text.trim());
}

export async function getStatusPeriods(): Promise<StatusPeriod[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{id: string; kind: StatusKind; start_date: string; end_date: string | null; note: string | null}>(
    'SELECT * FROM status_periods ORDER BY start_date',
  );
  return rows.map((r) => ({id: r.id, kind: r.kind, start: r.start_date, end: r.end_date, note: r.note}));
}

export async function startStatus(kind: StatusKind, start: IsoDate, note: string | null = null) {
  const db = await getDb();
  await db.runAsync('UPDATE status_periods SET end_date = ? WHERE end_date IS NULL', start);
  await db.runAsync('INSERT INTO status_periods (id, kind, start_date, end_date, note) VALUES (?, ?, ?, NULL, ?)', randomUUID(), kind, start, note);
}

export async function endStatus(id: string, end: IsoDate) {
  const db = await getDb();
  await db.runAsync('UPDATE status_periods SET end_date = ? WHERE id = ?', end, id);
}

export async function deleteStatus(id: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM status_periods WHERE id = ?', id);
}

type ExperimentRow = {
  id: string; name: string; tag_id: string | null; mode: Experiment['mode']; start_date: string; days: number;
  prediction: Experiment['prediction']; metrics: string; created_at: number; ended_at: string | null;
};

export async function getExperiments(): Promise<Experiment[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ExperimentRow>('SELECT * FROM experiments ORDER BY start_date DESC');
  return rows.map((r) => ({
    id: r.id, name: r.name, tagId: r.tag_id, mode: r.mode, start: r.start_date, days: r.days,
    prediction: r.prediction, metrics: JSON.parse(r.metrics), createdAt: r.created_at, endedAt: r.ended_at,
  }));
}

export async function saveExperiment(e: Omit<Experiment, 'id' | 'createdAt'> & {id?: string}) {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO experiments (id, name, tag_id, mode, start_date, days, prediction, metrics, created_at, ended_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    e.id ?? randomUUID(), e.name.trim(), e.tagId, e.mode, e.start, e.days, e.prediction, JSON.stringify(e.metrics), Date.now(), e.endedAt,
  );
}

export async function endExperiment(id: string, date: IsoDate) {
  const db = await getDb();
  await db.runAsync('UPDATE experiments SET ended_at = ? WHERE id = ?', date, id);
}

export async function deleteExperiment(id: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM experiments WHERE id = ?', id);
}

export async function kvGet(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{value: string}>('SELECT value FROM kv WHERE key = ?', key);
  return row?.value ?? null;
}

export async function kvSet(key: string, value: string) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    key, value,
  );
}

const LEGACY_STORAGE_KEY = 'tracker-items';
const LEGACY_IMPORT_VERSION = '2';
const LEGACY_VERSION_KEY = 'legacy_trackers_import_version';
const LEGACY_REPORT_KEY = 'legacy_trackers_import_report';

export type LegacyImportReport = {
  at: string;
  foundLegacyData: boolean;
  trackers: {
    name: string;
    legacyDays: number;
    added: number;
    alreadyPresent: number;
    firstDate: string | null;
    lastDate: string | null;
    skippedKeys: string[];
  }[];
};

/**
 * Merges the old AsyncStorage trackers into tags by name. Existing tag entries are never overwritten,
 * so re-running it only fills gaps.
 */
export async function migrateLegacyTrackers(force = false): Promise<LegacyImportReport | null> {
  if (!force && (await kvGet(LEGACY_VERSION_KEY)) === LEGACY_IMPORT_VERSION) return null;
  const raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  let trackers: LegacyTracker[] = [];
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    trackers = Array.isArray(parsed) ? parsed : [];
  } catch {
    trackers = [];
  }
  const converted = convertLegacyTrackers(trackers);

  const db = await getDb();
  const existing = await db.getAllAsync<{id: string; name: string}>('SELECT id, name FROM tags');
  const idByName = new Map(existing.map((t) => [t.name.trim().toLowerCase(), t.id]));
  const now = Date.now();
  const report: LegacyImportReport = {at: new Date(now).toISOString(), foundLegacyData: raw != null, trackers: []};

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const [i, t] of converted.entries()) {
      let id = idByName.get(t.name.toLowerCase());
      if (!id) {
        id = randomUUID();
        idByName.set(t.name.toLowerCase(), id);
        await txn.runAsync('INSERT INTO tags (id, name, created_at) VALUES (?, ?, ?)', id, t.name, now + i);
      }
      let added = 0;
      for (const e of t.entries) {
        const res = await txn.runAsync('INSERT OR IGNORE INTO tag_entries (tag_id, date, value) VALUES (?, ?, ?)', id, e.date, e.value);
        added += res.changes;
      }
      report.trackers.push({
        name: t.name,
        legacyDays: t.entries.length,
        added,
        alreadyPresent: t.entries.length - added,
        firstDate: t.entries[0]?.date ?? null,
        lastDate: t.entries[t.entries.length - 1]?.date ?? null,
        skippedKeys: t.skippedKeys,
      });
    }
    await txn.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', LEGACY_VERSION_KEY, LEGACY_IMPORT_VERSION);
    await txn.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', LEGACY_REPORT_KEY, JSON.stringify(report));
  });
  return report;
}

export async function getLegacyImportReport(): Promise<LegacyImportReport | null> {
  const raw = await kvGet(LEGACY_REPORT_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function dumpDatabase(): Promise<Record<string, unknown>> {
  const db = await getDb();
  const count = async (table: string) =>
    (await db.getFirstAsync<{n: number}>(`SELECT COUNT(*) AS n FROM ${table}`))?.n ?? 0;
  return {
    counts: {
      daily_metrics: await count('daily_metrics'),
      samples: await count('samples'),
      sleep_sessions: await count('sleep_sessions'),
      tags: await count('tags'),
      tag_entries: await count('tag_entries'),
      activities: await count('activities'),
      body_battery_events: await count('body_battery_events'),
      notes: await count('notes'),
      status_periods: await count('status_periods'),
      experiments: await count('experiments'),
    },
    kv: await db.getAllAsync('SELECT key, value FROM kv'),
    tags: await db.getAllAsync('SELECT * FROM tags'),
    recentDaily: await db.getAllAsync('SELECT * FROM daily_metrics ORDER BY date DESC, metric LIMIT 80'),
    recentSleep: await db.getAllAsync('SELECT * FROM sleep_sessions ORDER BY date DESC LIMIT 7'),
    recentActivities: await db.getAllAsync('SELECT * FROM activities ORDER BY start_ts DESC LIMIT 10'),
  };
}
