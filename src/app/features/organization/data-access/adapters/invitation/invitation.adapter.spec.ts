import { describe, expect, it } from 'vitest';

import { toInvitationOutcome, toPendingInvitation } from './invitation.adapter';

describe('invitation adapter', () => {
  it('reads an expired invitation and the name of its sender', () => {
    expect(
      toPendingInvitation({
        id: 'i3',
        email: 'atelier@nordstudio.fr',
        role: 'member',
        invitedBy: { userId: 'u-hd', name: 'Hugo Dubois' },
        status: 'expired',
        sentAt: '2026-10-26T10:00:00Z',
        expiresAt: '2026-11-02T10:00:00Z',
        version: 1,
      }),
    ).toEqual({
      id: 'i3',
      email: 'atelier@nordstudio.fr',
      role: 'member',
      invitedBy: 'Hugo Dubois',
      expired: true,
      expiresAt: '2026-11-02T10:00:00Z',
    });
  });

  it('lists an unknown outcome as not sent, apart from the skipped addresses', () => {
    expect(
      toInvitationOutcome(
        {
          invitations: [
            { email: 'marc.roux@ateliernord.fr', outcome: 'invited', invitationId: 'i1' },
            { email: 'ines.robert@ateliernord.fr', outcome: 'already-member', invitationId: null },
            { email: 'paul@example.com', outcome: 'already-invited', invitationId: 'i4' },
            { email: 'lucie@example.com', outcome: 'seat-limit', invitationId: null },
          ],
        },
        [
          'marc.roux@ateliernord.fr',
          'ines.robert@ateliernord.fr',
          'paul@example.com',
          'lucie@example.com',
        ],
      ),
    ).toEqual({ invited: 1, skipped: 2, notSent: ['lucie@example.com'], unknown: [] });
  });

  it('counts no address the answer leaves out or gives conflicting results', () => {
    expect(
      toInvitationOutcome(
        {
          invitations: [
            { email: 'marc.roux@ateliernord.fr', outcome: 'invited', invitationId: 'i1' },
            { email: 'marc.roux@ateliernord.fr', outcome: 'invited', invitationId: 'i1' },
            { email: 'paul@example.com', outcome: 'invited', invitationId: 'i4' },
            { email: 'paul@example.com', outcome: 'already-invited', invitationId: 'i4' },
          ],
        },
        ['Marc.Roux@ateliernord.fr', 'paul@example.com', 'lucie@example.com'],
      ),
    ).toEqual({
      invited: 1,
      skipped: 0,
      notSent: [],
      unknown: ['paul@example.com', 'lucie@example.com'],
    });
  });
});
