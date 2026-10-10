import {backupSummary, restorableRows, validateBackup} from '@/db/backup';

const empty = {daily_metrics: [], samples: [], sleep_sessions: [], tags: [], tag_entries: [], kv: []};

describe('backup', () => {
  it('rejects files that are not tracker backups', () => {
    expect(() => validateBackup({foo: 1})).toThrow('not a Health Tracker backup');
    expect(() => validateBackup({app: 'tracker', version: 1, tables: {...empty, samples: undefined}})).toThrow('missing the samples table');
  });

  it('accepts a valid backup and summarises it', () => {
    const b = validateBackup({
      app: 'tracker', version: 1, exportedAt: '2026-10-10T00:00:00Z',
      tables: {...empty, tags: [{id: 'a'}], tag_entries: [{tag_id: 'a'}, {tag_id: 'a'}], daily_metrics: [{}, {}, {}]},
    });
    expect(backupSummary(b)).toBe('1 tags, 2 tag entries, 3 daily values, 0 nights of sleep');
  });

  it('drops device-specific sync state from kv on restore', () => {
    expect(
      restorableRows('kv', [
        {key: 'legacy_trackers_import_version', value: '2'},
        {key: 'garmin.oldest_synced', value: '2026-01-01'},
        {key: 'hc.last_sync_date', value: '2026-10-10'},
        {key: 'sync.last_report', value: '{}'},
      ]),
    ).toEqual([{key: 'legacy_trackers_import_version', value: '2'}]);
  });
});
