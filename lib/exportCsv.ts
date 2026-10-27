import {File, Paths} from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {InsightReport} from '@/insights';
import {today} from '@/lib/dates';
import {METRICS} from '@/metrics/registry';
import {Activity, DailyData, DayNote, Tag, TagEntry} from '@/metrics/types';

function cell(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\n');
}

/** One row per day: every metric, your scores, tags and notes. */
export function dailyCsv(daily: DailyData, report: InsightReport | null, tags: Tag[], tagEntries: TagEntry[], notes: DayNote[]): string {
  const metrics = METRICS.filter((m) => !m.hidden && daily[m.id]?.size);
  const dates = new Set<string>();
  for (const m of metrics) daily[m.id]!.forEach((_, d) => dates.add(d));
  for (const e of tagEntries) dates.add(e.date);
  const history = new Map((report?.history.days ?? []).map((d) => [d.date, d]));
  const entry = new Map(tagEntries.map((e) => [`${e.tagId}|${e.date}`, e.value]));
  const note = new Map(notes.map((n) => [n.date, n.text]));
  const header = ['date', ...metrics.map((m) => (m.unit ? `${m.id} (${m.unit})` : m.id)), 'readiness', 'sleep_score_app', 'activity_score', ...tags.map((t) => `tag: ${t.name}`), 'note'];
  const rows = [...dates].sort().map((d) => {
    const h = history.get(d);
    return [
      d,
      ...metrics.map((m) => {
        const v = daily[m.id]!.get(d);
        return v == null ? null : Math.round(v * 100) / 100;
      }),
      h?.readiness?.value, h?.sleep?.value, h?.activity?.value,
      ...tags.map((t) => entry.get(`${t.id}|${d}`)),
      note.get(d),
    ];
  });
  return toCsv(header, rows);
}

export function activitiesCsv(activities: Activity[]): string {
  return toCsv(
    ['date', 'start', 'source', 'type', 'name', 'duration_min', 'distance_km', 'avg_hr', 'max_hr', 'kcal', 'aerobic_te', 'anaerobic_te'],
    activities.map((a) => [a.date, new Date(a.startTs).toISOString(), a.source, a.type, a.name, Math.round(a.durationMin), a.distanceKm, a.avgHr, a.maxHr, a.kcal, a.aerobicTe, a.anaerobicTe]),
  );
}

export async function shareCsv(name: string, csv: string) {
  const file = new File(Paths.cache, `${name}-${today()}.csv`);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);
  await Sharing.shareAsync(file.uri, {mimeType: 'text/csv', dialogTitle: 'Export CSV'});
}
