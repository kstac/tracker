import {dailyCsv, toCsv} from '@/lib/exportCsv';

jest.mock('expo-file-system', () => ({}));
jest.mock('expo-sharing', () => ({}));

describe('CSV export', () => {
  it('quotes awkward cells', () => {
    expect(toCsv(['a', 'b'], [['x, y', 'say "hi"'], [null, 3]])).toBe('a,b\n"x, y","say ""hi"""\n,3');
  });

  it('writes a row per day with metrics, tags and notes', () => {
    const csv = dailyCsv(
      {steps: new Map([['2026-10-09', 8000], ['2026-10-10', 9500.456]])},
      null,
      [{id: 't', name: 'Alcohol', createdAt: 0, unit: null, weeklyLimit: null}],
      [{tagId: 't', date: '2026-10-10', value: 2}],
      [{date: '2026-10-09', text: 'long day'}],
    );
    expect(csv.split('\n')).toEqual([
      'date,steps,readiness,sleep_score_app,activity_score,tag: Alcohol,note',
      '2026-10-09,8000,,,,,long day',
      '2026-10-10,9500.46,,,,2,',
    ]);
  });
});
