import { describe, expect, it } from 'vitest';

import { slugFromName } from './slug.util';

describe('slugFromName', () => {
  it('derives the address the gateway derives from the name', () => {
    expect(slugFromName('Coopérative Lumen')).toBe('cooperative-lumen');
    expect(slugFromName('  Atelier — Nord & Co!  ')).toBe('atelier-nord-co');
    expect(slugFromName('é')).toBe('e');
    expect(slugFromName('***')).toBe('');
  });

  it('cuts the address to 63 characters without a trailing dash', () => {
    const slug: string = slugFromName(`${'a'.repeat(62)} b`);
    expect(slug).toBe('a'.repeat(62));
    expect(slugFromName('x'.repeat(80))).toHaveLength(63);
  });
});
