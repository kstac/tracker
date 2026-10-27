import {APP_VERSION, CHANGELOG} from '@/lib/changelog';

describe('changelog', () => {
  it('has the current version first, newest to oldest, with something to test', () => {
    expect(CHANGELOG[0].version).toBe(APP_VERSION);
    const nums = CHANGELOG.map((e) => e.version.split('.').map(Number));
    nums.slice(1).forEach((v, i) => expect(v[0] * 1000 + v[1] < nums[i][0] * 1000 + nums[i][1] || v[2] < nums[i][2]).toBe(true));
    CHANGELOG.forEach((e) => expect(e.test.length).toBeGreaterThan(0));
  });
});
