import {addDays, dateRange, IsoDate} from '@/lib/dates';
import {DailyData, MetricId, StatusKind, StatusPeriod} from '@/metrics/types';

export const STATUS_LABEL: Record<StatusKind, {label: string; icon: string; detail: string}> = {
  sick: {label: 'Sick', icon: 'emoticon-sick-outline', detail: 'Targets pause, strain alerts soften and these days stay out of your baselines and patterns.'},
  injured: {label: 'Injured', icon: 'bandage', detail: 'Training targets pause and these days stay out of your baselines and patterns.'},
  travel: {label: 'Travelling', icon: 'airplane', detail: 'Odd sleep and heart rate are expected, so these days stay out of your baselines.'},
  rest: {label: 'Rest week', icon: 'sofa-outline', detail: 'Training targets drop to recovery level while you deload.'},
};

/** Statuses whose days would distort "normal": they're left out of baselines. */
const EXCLUDED_KINDS: StatusKind[] = ['sick', 'injured', 'travel'];

export function statusOn(statuses: StatusPeriod[] | undefined, date: IsoDate): StatusPeriod | null {
  return (statuses ?? []).find((s) => s.start <= date && (s.end == null || s.end >= date)) ?? null;
}

export function excludedDates(statuses: StatusPeriod[] | undefined, today: IsoDate): Set<IsoDate> {
  const out = new Set<IsoDate>();
  for (const s of statuses ?? []) {
    if (!EXCLUDED_KINDS.includes(s.kind)) continue;
    const end = s.end ?? today;
    for (const d of dateRange(s.start, end < today ? end : today)) out.add(d);
  }
  return out;
}

/**
 * Removes status days from every series so baselines reflect normal days. Today and yesterday stay, because
 * today's scores read them directly.
 */
export function withoutStatusDays(daily: DailyData, statuses: StatusPeriod[] | undefined, today: IsoDate): DailyData {
  const dates = excludedDates(statuses, today);
  dates.delete(today);
  dates.delete(addDays(today, -1));
  if (!dates.size) return daily;
  const out: DailyData = {};
  for (const [metric, series] of Object.entries(daily) as [MetricId, Map<IsoDate, number>][]) {
    const copy = new Map(series);
    for (const d of dates) copy.delete(d);
    out[metric] = copy;
  }
  return out;
}
