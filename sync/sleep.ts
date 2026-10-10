import {minutesFromMidnight} from '@/lib/dates';
import {DailyRow, SleepNight} from '@/metrics/types';

export function sleepDerivedRows(night: SleepNight): DailyRow[] {
  const asleep = night.deepMin + night.lightMin + night.remMin;
  const inBed = (night.endTs - night.startTs) / 60_000;
  const start = minutesFromMidnight(night.startTs, night.date);
  const end = minutesFromMidnight(night.endTs, night.date);
  const base = {date: night.date, source: night.source};
  const rows: DailyRow[] = [
    {...base, metric: 'sleep_total_min', value: asleep},
    {...base, metric: 'sleep_deep_min', value: night.deepMin},
    {...base, metric: 'sleep_light_min', value: night.lightMin},
    {...base, metric: 'sleep_rem_min', value: night.remMin},
    {...base, metric: 'sleep_awake_min', value: night.awakeMin},
    {...base, metric: 'sleep_start', value: start},
    {...base, metric: 'sleep_end', value: end},
    {...base, metric: 'sleep_midpoint', value: Math.round((start + end) / 2)},
  ];
  if (inBed > 0) rows.push({...base, metric: 'sleep_efficiency', value: Math.min(100, (asleep / inBed) * 100)});
  return rows;
}
