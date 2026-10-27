import {createContext, ReactNode, useCallback, useContext, useDeferredValue, useEffect, useMemo, useRef, useState} from 'react';
import {AppState} from 'react-native';
import * as repo from '@/db/repo';
import {computeInsights, InsightReport, InsightSettings} from '@/insights';
import {minutesFromMidnight, today} from '@/lib/dates';
import {DEFAULT_SETTINGS, getSettings, saveSettings} from '@/lib/settings';
import {
  Activity,
  DailyData,
  DayNote,
  Experiment,
  MetricId,
  SleepNight,
  StatusKind,
  StatusPeriod,
  Tag,
  TagEntry,
  TagUpdate,
} from '@/metrics/types';
import {lastSyncReport, runSync, SyncProgress, SyncReport} from '@/sync';
import {registerBackgroundSync} from '@/lib/backgroundSync';
import {applySchedules, runNotificationChecks} from '@/lib/notifications';

type AppData = {
  loading: boolean;
  daily: DailyData;
  sleep: SleepNight[];
  /** Active tags; `allTags` also includes archived ones. */
  tags: Tag[];
  allTags: Tag[];
  tagEntries: TagEntry[];
  activities: Activity[];
  statuses: StatusPeriod[];
  experiments: Experiment[];
  notes: DayNote[];
  settings: InsightSettings;
  report: InsightReport | null;
  syncing: boolean;
  progress: SyncProgress | null;
  lastSync: SyncReport | null;
  sync: () => Promise<void>;
  reload: () => Promise<void>;
  setTagValue: (tagId: string, date: string, value: number) => Promise<void>;
  createTag: (update: TagUpdate) => Promise<void>;
  updateTag: (id: string, update: TagUpdate) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  setTagArchived: (id: string, archived: boolean) => Promise<void>;
  setManualValue: (metric: MetricId, date: string, value: number | null) => Promise<void>;
  setNote: (date: string, text: string) => Promise<void>;
  startStatus: (kind: StatusKind, start: string) => Promise<void>;
  endStatus: (id: string, end: string) => Promise<void>;
  deleteStatus: (id: string) => Promise<void>;
  saveExperiment: (e: Omit<Experiment, 'id' | 'createdAt'> & {id?: string}) => Promise<void>;
  endExperiment: (id: string, date: string) => Promise<void>;
  deleteExperiment: (id: string) => Promise<void>;
  updateSettings: (patch: Partial<InsightSettings>) => Promise<void>;
};

const Ctx = createContext<AppData | null>(null);

const AUTO_SYNC_INTERVAL_MS = 15 * 60_000;

export function AppDataProvider({children}: {children: ReactNode}) {
  const [loading, setLoading] = useState(true);
  const [daily, setDaily] = useState<DailyData>({});
  const [sleep, setSleep] = useState<SleepNight[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagEntries, setTagEntries] = useState<TagEntry[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [statuses, setStatuses] = useState<StatusPeriod[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [notes, setNotes] = useState<DayNote[]>([]);
  const [settings, setSettings] = useState<InsightSettings>(DEFAULT_SETTINGS);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [lastSync, setLastSync] = useState<SyncReport | null>(null);
  const lastAutoSync = useRef(0);
  const [day, setDay] = useState(today());

  const reloadTags = useCallback(async () => {
    const [t, e] = await Promise.all([repo.listTags(true), repo.getTagEntries()]);
    setAllTags(t);
    setTagEntries(e);
  }, []);

  const reloadJournal = useCallback(async () => {
    const [s, x, n] = await Promise.all([repo.getStatusPeriods(), repo.getExperiments(), repo.getNotes()]);
    setStatuses(s);
    setExperiments(x);
    setNotes(n);
  }, []);

  const reloadDaily = useCallback(async () => {
    setDaily(await repo.loadDailyData());
  }, []);

  const reload = useCallback(async () => {
    const [d, s, a, st] = await Promise.all([repo.loadDailyData(), repo.getSleepNights(), repo.getActivities(), getSettings()]);
    setDaily(d);
    setSleep(s);
    setActivities(a);
    setSettings(st);
    await Promise.all([reloadTags(), reloadJournal()]);
    setLastSync(await lastSyncReport());
  }, [reloadTags, reloadJournal]);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      setLastSync(await runSync(setProgress));
      await reload();
      runNotificationChecks({foreground: true}).catch(() => {});
    } finally {
      setSyncing(false);
      setProgress(null);
    }
  }, [reload]);

  useEffect(() => {
    (async () => {
      try {
        await repo.migrateLegacyTrackers();
        await reload();
      } finally {
        setLoading(false);
      }
      lastAutoSync.current = Date.now();
      sync().catch(() => {});
      registerBackgroundSync().catch(() => {});
      applySchedules().catch(() => {});
    })();
  }, [reload, sync]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setDay(today());
      if (state === 'active' && Date.now() - lastAutoSync.current > AUTO_SYNC_INTERVAL_MS) {
        lastAutoSync.current = Date.now();
        sync().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [sync]);

  const setTagValue = useCallback(async (tagId: string, date: string, value: number) => {
    const previous = tagEntries.find((e) => e.tagId === tagId && e.date === date)?.value ?? 0;
    const timeMin = date === today() && value > previous ? minutesFromMidnight(Date.now(), date) : null;
    setTagEntries((prev) => {
      const existing = prev.find((e) => e.tagId === tagId && e.date === date);
      const rest = prev.filter((e) => e !== existing);
      return value > 0 ? [...rest, {tagId, date, value, timeMin: timeMin ?? existing?.timeMin ?? null}] : rest;
    });
    await repo.setTagEntry(tagId, date, value, timeMin);
  }, [tagEntries]);

  const createTag = useCallback(async (update: TagUpdate) => {
    await repo.createTag(update);
    await reloadTags();
  }, [reloadTags]);

  const updateTag = useCallback(async (id: string, update: TagUpdate) => {
    await repo.updateTag(id, update);
    await reloadTags();
  }, [reloadTags]);

  const deleteTag = useCallback(async (id: string) => {
    await repo.deleteTag(id);
    await reloadTags();
  }, [reloadTags]);

  const setTagArchived = useCallback(async (id: string, archived: boolean) => {
    await repo.setTagArchived(id, archived);
    await reloadTags();
  }, [reloadTags]);

  const setManualValue = useCallback(async (metric: MetricId, date: string, value: number | null) => {
    setDaily((prev) => {
      const series = new Map(prev[metric] ?? []);
      if (value == null) series.delete(date);
      else series.set(date, value);
      return {...prev, [metric]: series};
    });
    await repo.setManualValue(metric, date, value);
    // Removing a manual value can reveal a synced one underneath, so re-resolve from the database.
    if (value == null) await reloadDaily();
  }, [reloadDaily]);

  const setNote = useCallback(async (date: string, text: string) => {
    await repo.setNote(date, text);
    setNotes(await repo.getNotes());
  }, []);

  const startStatus = useCallback(async (kind: StatusKind, start: string) => {
    await repo.startStatus(kind, start);
    await reloadJournal();
  }, [reloadJournal]);

  const endStatus = useCallback(async (id: string, end: string) => {
    await repo.endStatus(id, end);
    await reloadJournal();
  }, [reloadJournal]);

  const deleteStatus = useCallback(async (id: string) => {
    await repo.deleteStatus(id);
    await reloadJournal();
  }, [reloadJournal]);

  const saveExperiment = useCallback(async (e: Omit<Experiment, 'id' | 'createdAt'> & {id?: string}) => {
    await repo.saveExperiment(e);
    await reloadJournal();
  }, [reloadJournal]);

  const endExperiment = useCallback(async (id: string, date: string) => {
    await repo.endExperiment(id, date);
    await reloadJournal();
  }, [reloadJournal]);

  const deleteExperiment = useCallback(async (id: string) => {
    await repo.deleteExperiment(id);
    await reloadJournal();
  }, [reloadJournal]);

  const updateSettings = useCallback(async (patch: Partial<InsightSettings>) => {
    const next = {...(await getSettings()), ...patch};
    setSettings(next);
    await saveSettings(next);
  }, []);

  const tags = useMemo(() => allTags.filter((t) => !t.archived), [allTags]);

  // The engine recomputes a year of history; deferring keeps taps responsive while it catches up.
  // Archived tags still have history worth analysing, and still need accounting for in other tags' effects.
  const rawInputs = useMemo(
    () => ({daily, sleep, tags: allTags, tagEntries, activities, statuses, experiments, settings}),
    [daily, sleep, allTags, tagEntries, activities, statuses, experiments, settings],
  );
  const inputs = useDeferredValue(rawInputs);
  const report = useMemo(
    () => (loading ? null : computeInsights({today: day, ...inputs})),
    [loading, inputs, day],
  );

  const dailyWithScores = useMemo<DailyData>(
    () => (report?.sleepScores.size ? {...daily, sleep_score: report.sleepScores} : daily),
    [daily, report],
  );

  const value: AppData = {
    loading, daily: dailyWithScores, sleep, tags, allTags, tagEntries, activities, statuses, experiments, notes, settings, report,
    syncing, progress, lastSync, sync, reload, setTagValue, createTag, updateTag, deleteTag, setTagArchived, setManualValue,
    setNote, startStatus, endStatus, deleteStatus, saveExperiment, endExperiment, deleteExperiment, updateSettings,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData(): AppData {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
  return ctx;
}
