import {METRIC_BY_ID} from '@/metrics/registry';
import {DailyData, DailyRow, MetricId, Source} from '@/metrics/types';

export function resolveDaily(rows: DailyRow[]): DailyData {
  const best = new Map<string, {rank: number; value: number}>();
  for (const row of rows) {
    const def = METRIC_BY_ID[row.metric];
    if (!def) continue;
    const rank = rankOf(def.sources, row.source);
    const key = `${row.metric}|${row.date}`;
    const existing = best.get(key);
    if (!existing || rank < existing.rank) best.set(key, {rank, value: row.value});
  }

  const out: DailyData = {};
  const sortedKeys = [...best.keys()].sort();
  for (const key of sortedKeys) {
    const [metric, date] = key.split('|') as [MetricId, string];
    (out[metric] ??= new Map()).set(date, best.get(key)!.value);
  }
  return out;
}

function rankOf(sources: Source[], source: Source): number {
  const i = sources.indexOf(source);
  return i === -1 ? sources.length : i;
}
