import {parseClock, parseDuration} from '@/components/settings/EditValueDialog';

describe('settings parsing', () => {
  it('reads clock times and sleep durations', () => {
    expect(['6:45', '0645', '23.30', '25:00', 'x'].map(parseClock)).toEqual([405, 405, 1410, null, null]);
    expect(['7.5', '7:45', '8h 15m', '8', 'abc'].map(parseDuration)).toEqual([450, 465, 495, 480, null]);
  });
});
