import {describe, expect, it} from '@jest/globals';
import {addDays} from '@/lib/dates';
import {excludedDates, statusOn, withoutStatusDays} from '@/insights/status';
import {steady, TODAY} from '@/insights/__fixtures__/series';
import {StatusPeriod} from '@/metrics/types';

describe('status periods', () => {
  const sick: StatusPeriod = {id: 's', kind: 'sick', start: addDays(TODAY, -4), end: null, note: null};
  const rest: StatusPeriod = {id: 'r', kind: 'rest', start: addDays(TODAY, -20), end: addDays(TODAY, -14), note: null};

  it('finds the status on a day and which days to leave out of baselines', () => {
    expect(statusOn([rest, sick], TODAY)).toBe(sick);
    expect(statusOn([rest, sick], addDays(TODAY, -15))).toBe(rest);
    expect(statusOn([rest, sick], addDays(TODAY, -10))).toBeNull();
    expect(excludedDates([rest, sick], TODAY).size).toBe(5);
  });

  it('removes status days from series but keeps today and yesterday', () => {
    const out = withoutStatusDays({resting_hr: steady(TODAY, 10, 55)}, [sick], TODAY);
    expect([...out.resting_hr!.keys()].length).toBe(7);
    expect(out.resting_hr!.has(TODAY) && out.resting_hr!.has(addDays(TODAY, -1))).toBe(true);
    expect(out.resting_hr!.has(addDays(TODAY, -2))).toBe(false);
  });
});
