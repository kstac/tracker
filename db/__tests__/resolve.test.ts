import {resolveDaily} from '@/db/resolve';

describe('resolveDaily', () => {
  it('prefers each metric\'s highest-priority source per date', () => {
    const resolved = resolveDaily([
      {date: '2026-10-01', metric: 'steps', source: 'health_connect', value: 9000},
      {date: '2026-10-01', metric: 'steps', source: 'garmin', value: 9100},
      {date: '2026-10-02', metric: 'steps', source: 'health_connect', value: 5000},
      {date: '2026-10-01', metric: 'weight_kg', source: 'garmin', value: 80},
      {date: '2026-10-01', metric: 'weight_kg', source: 'health_connect', value: 79.5},
    ]);
    expect(resolved).toEqual({
      steps: new Map([
        ['2026-10-01', 9100],
        ['2026-10-02', 5000],
      ]),
      weight_kg: new Map([['2026-10-01', 79.5]]),
    });
  });
});
