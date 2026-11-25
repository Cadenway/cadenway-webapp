import { describe, expect, it } from 'vitest';

import { initials } from './initials.util';

describe('initials', () => {
  it('takes the first letter of the first two words, upper-cased', () => {
    expect(initials('Atelier Nord')).toBe('AN');
    expect(initials('  coopérative   lumen  durable ')).toBe('CL');
    expect(initials('Studio')).toBe('S');
  });

  it('gives an empty mark for a blank name', () => {
    expect(initials('   ')).toBe('');
  });
});
