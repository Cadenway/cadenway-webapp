import { describe, expect, it } from 'vitest';

import { initialsOf } from './initials.util';

describe('initialsOf', () => {
  it.each([
    ['Atelier Nord', 'AN'],
    ['Lumen Cooperative', 'LC'],
    ['Atelier Nord Est', 'AE'],
    ['  camille   martin  ', 'CM'],
    ['Élodie de la Tour', 'ÉT'],
    ['Cadenway', 'CA'],
    ['A', 'A'],
    ['\u{1D49C}telier Nord', '\u{1D49C}N'],
  ])('derives the initials of “%s” as “%s”', (name: string, initials: string) => {
    expect(initialsOf(name)).toBe(initials);
  });

  it('gives an empty mark for a blank name', () => {
    expect(initialsOf('')).toBe('');
    expect(initialsOf('   ')).toBe('');
  });
});
