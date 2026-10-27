import {File, Paths} from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import {getDb} from '@/db';
import {today} from '@/lib/dates';

export const BACKUP_TABLES = [
  'daily_metrics', 'samples', 'sleep_sessions', 'tags', 'tag_entries', 'kv',
  'activities', 'body_battery_events', 'notes', 'status_periods', 'experiments',
] as const;
type Table = (typeof BACKUP_TABLES)[number];

/** Tables added after the first backup format; older files simply don't have them. */
const OPTIONAL_TABLES: Table[] = ['activities', 'body_battery_events', 'notes', 'status_periods', 'experiments'];
type Row = Record<string, string | number | null>;

/** `missing` lists tables the file didn't contain (older backups); restoring leaves those tables alone. */
export type Backup = {app: 'tracker'; version: 1; exportedAt: string; tables: Record<Table, Row[]>; missing?: Table[]};

/** Sync cursors are device-specific; restoring them would make a new phone skip data it hasn't fetched. */
const DEVICE_KV_PREFIXES = ['hc.', 'garmin.', 'sync.'];

export function validateBackup(raw: unknown): Backup {
  const b = raw as Partial<Backup> | null;
  if (!b || b.app !== 'tracker' || b.version !== 1 || typeof b.tables !== 'object' || !b.tables) {
    throw new Error('This file is not a Health Tracker backup');
  }
  const missing: Table[] = [];
  for (const t of BACKUP_TABLES) {
    if (Array.isArray(b.tables[t])) continue;
    if (!OPTIONAL_TABLES.includes(t)) throw new Error(`Backup is missing the ${t} table`);
    b.tables[t] = [];
    missing.push(t);
  }
  return {...(b as Backup), missing};
}

export function restorableRows(table: Table, rows: Row[]): Row[] {
  if (table !== 'kv') return rows;
  return rows.filter((r) => !DEVICE_KV_PREFIXES.some((p) => String(r.key).startsWith(p)));
}

export function backupSummary(b: Backup): string {
  const n = (t: Table) => b.tables[t].length.toLocaleString();
  const extra = b.tables.activities.length ? `, ${n('activities')} workouts` : '';
  return `${n('tags')} tags, ${n('tag_entries')} tag entries, ${n('daily_metrics')} daily values, ${n('sleep_sessions')} nights of sleep${extra}`;
}

export async function exportBackup(): Promise<string> {
  const db = await getDb();
  const tables = {} as Record<Table, Row[]>;
  for (const t of BACKUP_TABLES) tables[t] = await db.getAllAsync<Row>(`SELECT * FROM ${t}`);
  const backup: Backup = {app: 'tracker', version: 1, exportedAt: new Date().toISOString(), tables};

  const file = new File(Paths.cache, `health-tracker-backup-${today()}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(backup));
  await Sharing.shareAsync(file.uri, {mimeType: 'application/json', dialogTitle: 'Save backup'});
  return backupSummary(backup);
}

export async function pickBackup(): Promise<Backup | null> {
  const res = await DocumentPicker.getDocumentAsync({type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true});
  if (res.canceled || !res.assets?.length) return null;
  const text = await new File(res.assets[0].uri).text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON');
  }
  return validateBackup(parsed);
}

/** Replaces all stored data with the backup's contents. */
export async function restoreBackup(backup: Backup) {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const t of [...BACKUP_TABLES].reverse()) {
      if (backup.missing?.includes(t)) continue;
      if (t === 'kv') {
        const prefixes = DEVICE_KV_PREFIXES.map((p) => `key NOT LIKE '${p}%'`).join(' AND ');
        await txn.runAsync(`DELETE FROM kv WHERE ${prefixes}`);
      } else {
        await txn.runAsync(`DELETE FROM ${t}`);
      }
    }
    for (const t of BACKUP_TABLES) {
      const rows = restorableRows(t, backup.tables[t]);
      if (!rows.length) continue;
      const cols = Object.keys(rows[0]);
      const batch = Math.max(1, Math.floor(900 / cols.length));
      for (let i = 0; i < rows.length; i += batch) {
        const chunk = rows.slice(i, i + batch);
        const placeholders = chunk.map(() => `(${cols.map(() => '?').join(', ')})`).join(', ');
        await txn.runAsync(
          `INSERT OR REPLACE INTO ${t} (${cols.join(', ')}) VALUES ${placeholders}`,
          chunk.flatMap((r) => cols.map((c) => r[c] ?? null)),
        );
      }
    }
  });
}
