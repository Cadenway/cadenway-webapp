import { describe, expect, it } from 'vitest';

import { organizationChoice, receivedInvitation } from './organization.adapter';

describe('organization adapters', () => {
  it('keeps the chooser fields of an organization', () => {
    expect(
      organizationChoice({
        id: 'org-atelier-nord',
        name: 'Atelier Nord',
        slug: 'atelier-nord',
        role: 'owner',
        memberCount: 18,
        plan: 'team',
        joinedAt: '2026-11-01T10:00:00Z',
      }),
    ).toEqual({
      id: 'org-atelier-nord',
      name: 'Atelier Nord',
      slug: 'atelier-nord',
      role: 'owner',
      memberCount: 18,
      plan: 'team',
    });
  });

  it('flattens the inviting organization and the inviter of an invitation', () => {
    expect(
      receivedInvitation({
        id: 'invitation-lumen',
        organization: {
          id: 'org-lumen',
          name: 'Coopérative Lumen',
          slug: 'lumen',
          description: null,
          memberCount: 41,
        },
        role: 'member',
        invitedBy: { userId: 'user-ines', name: 'Inès Robert' },
        expiresAt: '2026-11-15T10:00:00Z',
      }),
    ).toEqual({
      id: 'invitation-lumen',
      organizationName: 'Coopérative Lumen',
      role: 'member',
      inviterName: 'Inès Robert',
      expiresAt: '2026-11-15T10:00:00Z',
    });
  });
});
