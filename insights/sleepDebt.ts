import {addDays, IsoDate} from '@/lib/dates';
import {DailyData, SleepNight} from '@/metrics/types';
import {asleepMinutes} from '@/insights/sleepScore';
import {median} from '@/insights/stats';

export const DEFAULT_SLEEP_NEED_MIN = 8 * 60;
export const DEBT_WINDOW_NIGHTS = 14;
const MIN_NIGHTS_FOR_DEBT = 3;
const USUAL_BEDTIME_WINDOW = 28;
const MIN_NIGHTS_FOR_USUAL = 5;

export type NightBalance = {date: IsoDate; asleepMin: number | null; diffMin: number | null};

export type SleepDebt = {
  /** Sum of (need − sleep) over the window, floored at zero so a surplus can repay debt but not bank sleep. */
  debtMin: number;
  needMin: number;
  nightsCounted: number;
  nights: NightBalance[];
  /** Debt as of a week earlier, for a "getting better/worse" comparison. */
  weekAgoDebtMin: number | null;
};

function debtEnding(byDate: Map<IsoDate, SleepNight>, end: IsoDate, needMin: number) {
  const nights: NightBalance[] = [];
  let sum = 0;
  let counted = 0;
  for (let i = DEBT_WINDOW_NIGHTS - 1; i >= 0; i--) {
    const date = addDays(end, -i);
    const night = byDate.get(date);
    const asleep = night ? asleepMinutes(night) : null;
    const diff = asleep == null ? null : asleep - needMin;
    if (diff != null) {
      sum -= diff;
      counted++;
    }
    nights.push({date, asleepMin: asleep, diffMin: diff});
  }
  return {debtMin: Math.max(0, Math.round(sum)), counted, nights};
}

export function computeSleepDebt(nights: SleepNight[], today: IsoDate, needMin = DEFAULT_SLEEP_NEED_MIN): SleepDebt | null {
  const byDate = new Map(nights.map((n) => [n.date, n]));
  const now = debtEnding(byDate, today, needMin);
  if (now.counted < MIN_NIGHTS_FOR_DEBT) return null;
  const weekAgo = debtEnding(byDate, addDays(today, -7), needMin);
  return {
    debtMin: now.debtMin,
    needMin,
    nightsCounted: now.counted,
    nights: now.nights,
    weekAgoDebtMin: weekAgo.counted >= MIN_NIGHTS_FOR_DEBT ? weekAgo.debtMin : null,
  };
}

export type BedtimeShift = {
  /** Last night's bedtime, minutes from midnight of the wake date (negative = before midnight). */
  last: number;
  usual: number;
  /** Positive means later than usual. */
  lastDelta: number;
  weekAvgDelta: number | null;
};

export function computeBedtimeShift(daily: DailyData, date: IsoDate): BedtimeShift | null {
  const starts = daily.sleep_start;
  if (!starts) return null;
  const lastDate = [...starts.keys()].filter((d) => d <= date).sort().pop();
  if (!lastDate || lastDate < addDays(date, -1)) return null;

  const prior: number[] = [];
  for (let i = 1; i <= USUAL_BEDTIME_WINDOW; i++) {
    const v = starts.get(addDays(lastDate, -i));
    if (v != null) prior.push(v);
  }
  if (prior.length < MIN_NIGHTS_FOR_USUAL) return null;
  const usual = Math.round(median(prior)!);
  const last = starts.get(lastDate)!;

  const week: number[] = [];
  for (let i = 0; i < 7; i++) {
    const v = starts.get(addDays(lastDate, -i));
    if (v != null) week.push(v);
  }
  const weekAvg = week.length >= 3 ? week.reduce((a, b) => a + b, 0) / week.length : null;

  return {last, usual, lastDelta: last - usual, weekAvgDelta: weekAvg == null ? null : Math.round(weekAvg - usual)};
}
