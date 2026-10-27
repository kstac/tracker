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

// Calendar arithmetic on day numbers (days since 1970-01-01) instead of Date objects: the insights engine does this
// millions of times, and building Dates for each step made a full recompute take seconds on a phone.
const dayNumberCache = new Map<IsoDate, number>();

function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

const civilCache = new Map<number, IsoDate>();

function civilFromDays(n: number): IsoDate {
  const cached = civilCache.get(n);
  if (cached) return cached;
  const iso = computeCivil(n);
  if (civilCache.size > 20_000) civilCache.clear();
  civilCache.set(n, iso);
  return iso;
}

function computeCivil(n: number): IsoDate {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function dayNumber(date: IsoDate): number {
  let n = dayNumberCache.get(date);
  if (n == null) {
    const [y, m, d] = date.split('-').map(Number);
    n = daysFromCivil(y, m, d);
    if (dayNumberCache.size > 20_000) dayNumberCache.clear();
    dayNumberCache.set(date, n);
  }
  return n;
}

export function fromDayNumber(n: number): IsoDate {
  return civilFromDays(n);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return days === 0 ? date : civilFromDays(dayNumber(date) + days);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return dayNumber(to) - dayNumber(from);
}

export function dateRange(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function dayOfWeek(date: IsoDate): number {
  // 1970-01-01 was a Thursday.
  return (((dayNumber(date) + 4) % 7) + 7) % 7;
}

export function isWeekend(date: IsoDate): boolean {
  const dow = dayOfWeek(date);
  return dow === 0 || dow === 6;
}

export function startOfDayTs(date: IsoDate): number {
  return parseIsoDate(date).getTime();
}

// Minutes since local midnight of `date`; times before midnight are negative (e.g. 23:00 the evening before = -60).
// Uses the local wall clock, so a night that crosses a daylight-saving change still reads 23:00 → 07:00.
export function minutesFromMidnight(ts: number, date: IsoDate): number {
  const d = new Date(ts);
  return daysBetween(date, toIsoDate(d)) * 1440 + d.getHours() * 60 + d.getMinutes() + Math.round(d.getSeconds() / 60);
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
