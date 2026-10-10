export const MIGRATIONS: string[] = [
  `
  CREATE TABLE daily_metrics (
    date TEXT NOT NULL,
    metric TEXT NOT NULL,
    source TEXT NOT NULL,
    value REAL NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (date, metric, source)
  );
  CREATE INDEX idx_daily_metric_date ON daily_metrics (metric, date);

  CREATE TABLE samples (
    metric TEXT NOT NULL,
    ts INTEGER NOT NULL,
    source TEXT NOT NULL,
    value REAL NOT NULL,
    PRIMARY KEY (metric, ts, source)
  );

  CREATE TABLE sleep_sessions (
    date TEXT NOT NULL,
    source TEXT NOT NULL,
    start_ts INTEGER NOT NULL,
    end_ts INTEGER NOT NULL,
    deep_min REAL NOT NULL,
    light_min REAL NOT NULL,
    rem_min REAL NOT NULL,
    awake_min REAL NOT NULL,
    PRIMARY KEY (date, source)
  );

  CREATE TABLE tags (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE tag_entries (
    tag_id TEXT NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    value REAL NOT NULL,
    PRIMARY KEY (tag_id, date)
  );

  CREATE TABLE kv (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
  `
  ALTER TABLE tags ADD COLUMN unit TEXT;
  ALTER TABLE tags ADD COLUMN weekly_limit REAL;
  `,
];
