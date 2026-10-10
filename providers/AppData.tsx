import {createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {AppState} from 'react-native';
import * as repo from '@/db/repo';
import {computeInsights, InsightReport} from '@/insights';
import {today} from '@/lib/dates';
import {DailyData, SleepNight, Tag, TagEntry, TagUpdate} from '@/metrics/types';
import {lastSyncReport, runSync, SyncProgress, SyncReport} from '@/sync';
import {registerBackgroundSync} from '@/lib/backgroundSync';
import {applySchedules, runNotificationChecks} from '@/lib/notifications';

type AppData = {
  loading: boolean;
  daily: DailyData;
  sleep: SleepNight[];
  tags: Tag[];
  tagEntries: TagEntry[];
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
};

const Ctx = createContext<AppData | null>(null);

const AUTO_SYNC_INTERVAL_MS = 15 * 60_000;

export function AppDataProvider({children}: {children: ReactNode}) {
  const [loading, setLoading] = useState(true);
  const [daily, setDaily] = useState<DailyData>({});
  const [sleep, setSleep] = useState<SleepNight[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagEntries, setTagEntries] = useState<TagEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [lastSync, setLastSync] = useState<SyncReport | null>(null);
  const lastAutoSync = useRef(0);

  const reloadTags = useCallback(async () => {
    const [t, e] = await Promise.all([repo.listTags(), repo.getTagEntries()]);
    setTags(t);
    setTagEntries(e);
  }, []);

  const reload = useCallback(async () => {
    const [d, s] = await Promise.all([repo.loadDailyData(), repo.getSleepNights()]);
    setDaily(d);
    setSleep(s);
    await reloadTags();
    setLastSync(await lastSyncReport());
  }, [reloadTags]);

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
      if (state === 'active' && Date.now() - lastAutoSync.current > AUTO_SYNC_INTERVAL_MS) {
        lastAutoSync.current = Date.now();
        sync().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [sync]);

  const setTagValue = useCallback(async (tagId: string, date: string, value: number) => {
    setTagEntries((prev) => {
      const rest = prev.filter((e) => !(e.tagId === tagId && e.date === date));
      return value > 0 ? [...rest, {tagId, date, value}] : rest;
    });
    await repo.setTagEntry(tagId, date, value);
  }, []);

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

  const report = useMemo(
    () => (loading ? null : computeInsights({today: today(), daily, sleep, tags, tagEntries})),
    [loading, daily, sleep, tags, tagEntries],
  );

  const dailyWithScores = useMemo<DailyData>(
    () => (report?.sleepScores.size ? {...daily, sleep_score: report.sleepScores} : daily),
    [daily, report],
  );

  const value: AppData = {
    loading, daily: dailyWithScores, sleep, tags, tagEntries, report, syncing, progress, lastSync,
    sync, reload, setTagValue, createTag, updateTag, deleteTag,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData(): AppData {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
  return ctx;
}
