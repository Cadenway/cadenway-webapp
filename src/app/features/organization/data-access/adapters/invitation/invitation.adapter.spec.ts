import type { Invitation } from '@cadenway/api-client';
import { describe, expect, it } from 'vitest';

import {
  toInvitationOutcome,
  toInvitationStanding,
  toPendingInvitation,
} from './invitation.adapter';

describe('invitation adapter', () => {
  it('reads an invitation in any state, and a state it does not know as other', () => {
    const marc: Omit<Invitation, 'status'> = {
      id: 'i1',
      email: 'marc.roux@ateliernord.fr',
      role: 'member',
      invitedBy: { userId: 'u-ir', name: 'Inès Robert' },
      sentAt: '2026-11-06T16:20:00Z',
      expiresAt: '2026-11-13T16:20:00Z',
      version: 2,
    };

    for (const status of ['pending', 'expired', 'accepted', 'refused', 'revoked']) {
      expect(toInvitationStanding({ ...marc, status }).status).toBe(status);
    }
    expect(toInvitationStanding({ ...marc, status: 'archived' })).toEqual({
      status: 'other',
      invitation: {
        id: 'i1',
        email: 'marc.roux@ateliernord.fr',
        role: 'member',
        invitedBy: 'Inès Robert',
        expired: false,
        expiresAt: '2026-11-13T16:20:00Z',
      },
    });
  });

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
