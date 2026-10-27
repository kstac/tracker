import {addDays, IsoDate, isWeekend} from '@/lib/dates';
import {DailyData, SleepNight} from '@/metrics/types';
import {InsightSettings} from '@/insights/types';
import {windowPoints, windowValues} from '@/insights/baseline';
import {asleepMinutes} from '@/insights/sleepScore';
import {computeSleepDebt, DEFAULT_SLEEP_NEED_MIN, SleepDebt} from '@/insights/sleepDebt';
import {median, quantile} from '@/insights/stats';

const NEED_WINDOW_NIGHTS = 90;
const MIN_NIGHTS_FOR_AUTO_NEED = 14;
const MIN_NEED = 7 * 60;
const MAX_NEED = 9 * 60;
const MAX_REPAY_MIN = 60;
const REPAY_NIGHTS = 4;
const MAX_STRAIN_MIN = 30;
const MAX_NAP_CREDIT_MIN = 60;
const MAX_GRADUAL_STEP_MIN = 30;
/** More than an extra hour a night is rarely realistic, and "always sleep more" advice gets ignored. */
const MAX_EXTRA_MIN = 60;

export type NeedSource = 'setting' | 'auto' | 'default';

export type SleepNeed = {
  baselineMin: number;
  source: NeedSource;
  debtRepayMin: number;
  strainMin: number;
  napMin: number;
  tonightMin: number;
};

export type DebtLevel = 'none' | 'low' | 'moderate' | 'high';

export type SleepPlan = {
  /** The morning this plan is for. */
  wakeDate: IsoDate;
  need: SleepNeed;
  /** Minutes after midnight of the wake date. */
  wakeTarget: number;
  wakeSource: 'setting' | 'usual' | 'default';
  usualAwakeMin: number;
  /** When to be asleep by, minutes from midnight of the wake date (negative is the evening before). */
  bedtime: number;
  /** A smaller step towards `bedtime` when it's far earlier than usual and gradual mode is on. */
  stepBedtime: number | null;
  usualBedtime: number | null;
  debt: SleepDebt | null;
  debtLevel: DebtLevel;
};

export function debtLevel(debtMin: number): DebtLevel {
  if (debtMin < 15) return 'none';
  if (debtMin < 120) return 'low';
  if (debtMin <= 300) return 'moderate';
  return 'high';
}

export const DEBT_LEVEL_LABEL: Record<DebtLevel, string> = {none: 'None', low: 'Low', moderate: 'Moderate', high: 'High'};

/**
 * Your baseline need: the length of your longer nights (75th percentile over 90 days), kept within 7–9 hours.
 * Typical sleep underestimates need for people who are often short, so the longer nights are the better guide.
 */
export function baselineNeed(nights: SleepNight[], today: IsoDate, settings: InsightSettings = {}): {min: number; source: NeedSource} {
  if (settings.sleepNeedMin) return {min: settings.sleepNeedMin, source: 'setting'};
  const from = addDays(today, -NEED_WINDOW_NIGHTS);
  const asleep = nights.filter((n) => n.date > from && n.date <= today).map(asleepMinutes).filter((m) => m >= 180);
  if (asleep.length < MIN_NIGHTS_FOR_AUTO_NEED) return {min: DEFAULT_SLEEP_NEED_MIN, source: 'default'};
  const p75 = quantile(asleep, 0.75)!;
  return {min: Math.round(Math.min(MAX_NEED, Math.max(MIN_NEED, p75)) / 5) * 5, source: 'auto'};
}

function usualWake(daily: DailyData, wakeDate: IsoDate, today: IsoDate): number | null {
  const points = windowPoints(daily.sleep_end, today, 28);
  const sameType = points.filter((p) => isWeekend(p.date) === isWeekend(wakeDate)).map((p) => p.value);
  if (sameType.length >= 3) return median(sameType);
  return points.length >= 3 ? median(points.map((p) => p.value)) : null;
}

export type SleepPlanInput = {
  daily: DailyData;
  nights: SleepNight[];
  today: IsoDate;
  wakeDate: IsoDate;
  settings?: InsightSettings;
  /** Today's training load and your usual daily load, for the strain adjustment. */
  todayLoad?: number | null;
  chronicLoad?: number | null;
};

export function computeSleepPlan(input: SleepPlanInput): SleepPlan {
  const {daily, nights, today, wakeDate, settings = {}} = input;
  const base = baselineNeed(nights, today, settings);
  const debt = computeSleepDebt(nights, today, base.min);
  const debtMin = debt?.debtMin ?? 0;

  let strainMin = 0;
  const {todayLoad, chronicLoad} = input;
  if (todayLoad != null && chronicLoad != null && chronicLoad > 0 && todayLoad > chronicLoad * 1.3) {
    strainMin = Math.min(MAX_STRAIN_MIN, Math.round(((todayLoad / chronicLoad - 1) * 20) / 5) * 5);
  }
  const debtRepayMin = debtMin >= 30 ? Math.min(MAX_REPAY_MIN, MAX_EXTRA_MIN - strainMin, Math.round(debtMin / REPAY_NIGHTS / 5) * 5) : 0;
  const nap = daily.nap_min?.get(today) ?? 0;
  const napMin = nap >= 10 ? Math.min(MAX_NAP_CREDIT_MIN, Math.round(nap / 5) * 5) : 0;
  const tonightMin = Math.max(base.min - 30, base.min + debtRepayMin + strainMin - napMin);

  const weekend = isWeekend(wakeDate);
  const fixedWake = weekend ? settings.wakeWeekend : settings.wakeWeekday;
  const usual = usualWake(daily, wakeDate, today);
  const wakeTarget = fixedWake ?? (usual != null ? Math.round(usual / 5) * 5 : 7 * 60);
  const wakeSource = fixedWake != null ? 'setting' : usual != null ? 'usual' : 'default';
  const usualAwakeMin = Math.round(median(windowValues(daily.sleep_awake_min, today, 28)) ?? 15);

  const bedtime = Math.round((wakeTarget - tonightMin - usualAwakeMin) / 5) * 5;
  const recentStarts = windowValues(daily.sleep_start, today, 28);
  const usualBedtime = recentStarts.length >= 5 ? Math.round(median(recentStarts)!) : null;
  const stepBedtime =
    settings.gradualBedtime && usualBedtime != null && usualBedtime - bedtime > MAX_GRADUAL_STEP_MIN
      ? usualBedtime - MAX_GRADUAL_STEP_MIN
      : null;

  return {
    wakeDate,
    need: {baselineMin: base.min, source: base.source, debtRepayMin, strainMin, napMin, tonightMin},
    wakeTarget,
    wakeSource,
    usualAwakeMin,
    bedtime,
    stepBedtime,
    usualBedtime,
    debt,
    debtLevel: debtLevel(debtMin),
  };
}

/** After midnight but before 4am, "tonight" is the sleep you're already in, ending this morning. */
export function planWakeDate(today: IsoDate, now: Date): IsoDate {
  return now.getHours() < 4 ? today : addDays(today, 1);
}
