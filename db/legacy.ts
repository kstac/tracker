import {IsoDate, parseLegacyDateKey} from '@/lib/dates';

export type LegacyTracker = {
  label: string;
  type?: number;
  value?: number;
  dateAwareValues?: Record<string, number>;
};

export type ConvertedTag = {
  name: string;
  entries: {date: IsoDate; value: number}[];
  skippedKeys: string[];
};

export function convertLegacyTrackers(trackers: LegacyTracker[]): ConvertedTag[] {
  return trackers
    .filter((t) => typeof t?.label === 'string' && t.label.trim() !== '')
    .map((t) => {
      const entries: {date: IsoDate; value: number}[] = [];
      const skippedKeys: string[] = [];
      for (const [key, value] of Object.entries(t.dateAwareValues ?? {})) {
        const date = parseLegacyDateKey(key);
        if (!date || typeof value !== 'number') skippedKeys.push(key);
        else if (value > 0) entries.push({date, value});
      }
      entries.sort((a, b) => a.date.localeCompare(b.date));
      return {name: t.label.trim(), entries, skippedKeys};
    });
}
