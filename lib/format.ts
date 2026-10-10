import {MetricDef} from '@/metrics/registry';
import {formatClock, formatMinutes} from '@/lib/dates';

export function formatMetricValue(def: MetricDef, value: number | null | undefined, withUnit = true): string {
  if (value == null || Number.isNaN(value)) return '–';
  if (def.format === 'duration') return formatMinutes(value);
  if (def.format === 'clock') return formatClock(value);
  const num = value.toLocaleString(undefined, {
    minimumFractionDigits: def.decimals,
    maximumFractionDigits: def.decimals,
  });
  return withUnit && def.unit ? `${num} ${def.unit}` : num;
}

export function formatDelta(def: MetricDef, delta: number): string {
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±';
  const abs = Math.abs(delta);
  if (def.format === 'duration' || def.format === 'clock') return `${sign}${formatMinutes(abs)}`;
  return `${sign}${abs.toFixed(def.decimals)}${def.unit ? ` ${def.unit}` : ''}`;
}
