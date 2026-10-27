import {addDays, dateRange, dayOfWeek, daysBetween, parseIsoDate, toIsoDate} from '@/lib/dates';

describe('calendar arithmetic', () => {
  it('matches Date-based arithmetic across months, leap years and DST changes', () => {
    for (let i = -800; i <= 800; i += 7) {
      for (const base of ['2024-02-28', '2026-03-29', '2026-10-04', '1999-12-31']) {
        const d = parseIsoDate(base);
        d.setDate(d.getDate() + i);
        expect(addDays(base, i)).toBe(toIsoDate(d));
        expect(dayOfWeek(addDays(base, i))).toBe(d.getDay());
      }
    }
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
    expect(dateRange('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  });
});
