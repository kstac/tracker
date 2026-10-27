import {kvGet, kvSet} from '@/db/repo';
import {InsightSettings} from '@/insights/types';

const KEY = 'settings.user';

export const DEFAULT_SETTINGS: InsightSettings = {
  stepGoal: null,
  sleepNeedMin: null,
  wakeWeekday: null,
  wakeWeekend: null,
  birthYear: null,
  sex: null,
  maxHr: null,
  onlyJournaledDays: false,
  gradualBedtime: true,
};

export async function getSettings(): Promise<InsightSettings> {
  const raw = await kvGet(KEY);
  return raw ? {...DEFAULT_SETTINGS, ...JSON.parse(raw)} : DEFAULT_SETTINGS;
}

export async function saveSettings(settings: InsightSettings) {
  await kvSet(KEY, JSON.stringify(settings));
}
