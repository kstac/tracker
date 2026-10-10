export type IsoDate = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toIsoDate(d: Date): IsoDate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseIsoDate(date: IsoDate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(): IsoDate {
  return toIsoDate(new Date());
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = parseIsoDate(date);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  const ms = parseIsoDate(to).getTime() - parseIsoDate(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function dateRange(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function dayOfWeek(date: IsoDate): number {
  return parseIsoDate(date).getDay();
}

export function isWeekend(date: IsoDate): boolean {
  const dow = dayOfWeek(date);
  return dow === 0 || dow === 6;
}

export function startOfDayTs(date: IsoDate): number {
  return parseIsoDate(date).getTime();
}

// Minutes since local midnight of `date`; times before midnight are negative (e.g. 23:00 the evening before = -60).
export function minutesFromMidnight(ts: number, date: IsoDate): number {
  return Math.round((ts - startOfDayTs(date)) / 60_000);
}

// The old tracker keyed values by toLocaleDateString() on an en-AU device (D/M/YYYY), but the raw JSON was hand-editable.
export function parseLegacyDateKey(key: string): IsoDate | null {
  const k = key.trim();
  const valid = (y: number, mo: number, d: number) => {
    const date = new Date(y, mo - 1, d);
    return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? `${y}-${pad(mo)}-${pad(d)}` : null;
  };
  let m = k.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = k.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (m) return valid(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  if (/[a-z]/i.test(k)) {
    const ts = Date.parse(k);
    if (!Number.isNaN(ts)) return toIsoDate(new Date(ts));
  }
  return null;
}

export function formatMinutes(min: number): string {
  const sign = min < 0 ? '-' : '';
  const abs = Math.abs(Math.round(min));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return h > 0 ? `${sign}${h}h ${pad(m)}m` : `${sign}${m}m`;
}

export function formatClock(minutesFromMidnightValue: number): string {
  const total = ((Math.round(minutesFromMidnightValue) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** Sleep is stored under the wake-up date; people think of it as the night it started. */
export function nightOf(wakeDate: IsoDate): IsoDate {
  return addDays(wakeDate, -1);
}

export function nightLabel(wakeDate: IsoDate, opts: Intl.DateTimeFormatOptions = {weekday: 'short', day: 'numeric', month: 'short'}): string {
  return `${parseIsoDate(nightOf(wakeDate)).toLocaleDateString(undefined, opts)} night`;
}
