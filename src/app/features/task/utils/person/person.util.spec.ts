import { describe, expect, it } from 'vitest';

import { initialsOf, personOf } from './person.util';

describe('person utils', () => {
  it('takes the first and last words of a name', () => {
    expect(initialsOf('Jean-Paul de la Fontaine')).toBe('JF');
    expect(initialsOf('hugo')).toBe('H');
    expect(initialsOf('   ')).toBe('');
  });

  it('builds the person of a member read elsewhere', () => {
    expect(personOf('u1', 'Inès Robert')).toEqual({
      id: 'u1',
      name: 'Inès Robert',
      initials: 'IR',
      avatar: null,
    });
  });
});
