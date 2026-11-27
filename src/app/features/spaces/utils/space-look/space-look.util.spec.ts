import { describe, expect, it } from 'vitest';

import type { LookColorChoice } from '../../models/look/look-color-choice.interface';
import { lookColorChoices, prefixFromName } from './space-look.util';

describe('prefixFromName', () => {
  it('proposes the prefix from the name, as the mockup does', () => {
    expect(prefixFromName('Human resources')).toBe('HUM');
    expect(prefixFromName('Naïve')).toBe('NAI');
    expect(prefixFromName('Q')).toBe('QXX');
    expect(prefixFromName('  ')).toBe('');
  });
});

describe('lookColorChoices', () => {
  it('names the thirteen colors in the mockup order, each with its swatch', () => {
    const choices: readonly LookColorChoice[] = lookColorChoices();

    expect(choices.map((choice: LookColorChoice) => choice.value)).toEqual([
      'gris',
      'violet',
      'indigo',
      'azur',
      'lagon',
      'vert',
      'olive',
      'jaune',
      'orange',
      'rouge',
      'rose',
      'fuchsia',
      'ardoise',
    ]);
    expect(choices[1]).toEqual({ value: 'violet', label: 'Amethyst', swatch: 'bg-amethyste' });
  });
});
