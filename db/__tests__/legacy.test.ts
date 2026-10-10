import {convertLegacyTrackers} from '@/db/legacy';
import {parseLegacyDateKey} from '@/lib/dates';

describe('legacy tracker migration', () => {
  it('parses en-AU D/M/YYYY keys without relying on the device locale', () => {
    expect(parseLegacyDateKey('3/2/2025')).toBe('2025-02-03');
    expect(parseLegacyDateKey('30/01/2025')).toBe('2025-01-30');
    expect(parseLegacyDateKey('13/13/2025')).toBeNull();
  });

  it('converts trackers into tags with sorted entries, dropping zero counts and reporting bad keys', () => {
    expect(
      convertLegacyTrackers([
        {label: ' Coffee ', type: 0, dateAwareValues: {'30/1/2025': 2, '28/1/2025': 1, '29/1/2025': 0, 'garbage': 3}},
        {label: '', dateAwareValues: {'1/1/2025': 1}},
        {label: 'Alcohol'},
      ]),
    ).toEqual([
      {
        name: 'Coffee',
        entries: [
          {date: '2025-01-28', value: 1},
          {date: '2025-01-30', value: 2},
        ],
        skippedKeys: ['garbage'],
      },
      {name: 'Alcohol', entries: [], skippedKeys: []},
    ]);
  });
});

describe('legacy date key formats', () => {
  it('accepts the formats a hand-edited tracker JSON might contain', () => {
    expect(
      ['03/05/2025', '3-5-2025', '3.5.25', '2025-05-03', '2025/5/3', 'Sat May 03 2025', '31/02/2025', ''].map(parseLegacyDateKey),
    ).toEqual(['2025-05-03', '2025-05-03', '2025-05-03', '2025-05-03', '2025-05-03', '2025-05-03', null, null]);
  });
});
