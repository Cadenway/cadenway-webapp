import { describe, expect, it } from 'vitest';

import { toPerson } from './person.adapter';

describe('toPerson', () => {
  it('identifies a member by the user id assignees use, with initials', () => {
    expect(
      toPerson({
        id: 'm1',
        userId: 'u1',
        name: 'Camille Martin',
        email: 'camille.martin@ateliernord.fr',
        role: 'owner',
        joinedAt: '2026-11-01T10:00:00Z',
        version: 1,
      }),
    ).toEqual({ id: 'u1', name: 'Camille Martin', initials: 'CM', avatar: null });
  });
});
