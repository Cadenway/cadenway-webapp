import { describe, expect, it } from 'vitest';

import { toOrganizationMenuEntry } from './organization-menu-entry.adapter';

describe('toOrganizationMenuEntry', () => {
  it('keeps the display fields and the member count', () => {
    expect(
      toOrganizationMenuEntry({
        id: 'o1',
        name: 'Atelier Nord',
        slug: 'atelier-nord',
        role: 'owner',
        memberCount: 18,
        plan: 'team',
        joinedAt: '2026-11-01T10:00:00Z',
      }),
    ).toEqual({
      id: 'o1',
      name: 'Atelier Nord',
      slug: 'atelier-nord',
      initials: 'AN',
      role: 'owner',
      plan: 'team',
      memberCount: 18,
    });
  });
});
