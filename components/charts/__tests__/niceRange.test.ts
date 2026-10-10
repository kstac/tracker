import {niceRange} from '@/components/charts/TrendChart';

describe('niceRange', () => {
  it('never runs past the cap', () => {
    expect(niceRange([40, 100], false, 100)).toEqual({lo: 32, step: 17, hi: 100});
    expect(niceRange([20, 95], true, 100)).toEqual({lo: 0, step: 25, hi: 100});
  });

  it('leaves uncapped ranges alone', () => {
    expect(niceRange([50, 60], false)).toEqual({lo: 49, step: 3, hi: 61});
  });
});
