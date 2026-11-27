import { takesSingular } from './plural.util';

describe('takesSingular', () => {
  it('reads one with the singular and other counts with the plural in English', () => {
    expect(takesSingular(1)).toBe(true);
    expect(takesSingular(0)).toBe(false);
    expect(takesSingular(4)).toBe(false);
  });
});
