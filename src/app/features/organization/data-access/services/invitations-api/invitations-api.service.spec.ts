import { TestBed } from '@angular/core/testing';
import { type InvitationPage, InvitationsService } from '@cadenway/api-client';
import { of } from 'rxjs';
import { describe, expect, it, type Mock, vi } from 'vitest';

import type { InvitationList } from '../../../models/invitation/invitation.interface';
import { InvitationsApi } from './invitations-api.service';

/**
 * Function page
 *
 * @description
 * A page of pending invitations with one invitation.
 *
 * @param {string} id - Id of its invitation.
 * @param {string | null} nextCursor - Cursor of the next page.
 * @returns {InvitationPage} The page.
 */
function page(id: string, nextCursor: string | null): InvitationPage {
  return {
    items: [
      {
        id,
        email: `${id}@ateliernord.fr`,
        role: 'member',
        invitedBy: { userId: 'u-ir', name: 'Inès Robert' },
        status: 'pending',
        sentAt: '2026-11-25T10:00:00Z',
        expiresAt: '2026-12-02T10:00:00Z',
        version: 1,
      },
    ],
    nextCursor,
    total: 2,
  };
}

describe('InvitationsApi', () => {
  it('reads every page of pending invitations', async () => {
    const listInvitations: Mock = vi.fn((params: { cursor?: string }) =>
      of(params.cursor === undefined ? page('i1', 'c2') : page('i2', null)),
    );
    TestBed.configureTestingModule({
      providers: [InvitationsApi, { provide: InvitationsService, useValue: { listInvitations } }],
    });

    const list: InvitationList = await TestBed.inject(InvitationsApi).list();

    expect(listInvitations.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      { limit: 100 },
      { limit: 100, cursor: 'c2' },
    ]);
    expect(list.items.map((item: InvitationList['items'][number]) => item.id)).toEqual([
      'i1',
      'i2',
    ]);
    expect(list.total).toBe(2);
  });

  it('requests no further page once its signal is aborted', async () => {
    const controller: AbortController = new AbortController();
    const listInvitations: Mock = vi.fn((params: { cursor?: string }) => {
      if (params.cursor === undefined) controller.abort();
      return of(params.cursor === undefined ? page('i1', 'c2') : page('i2', null));
    });
    TestBed.configureTestingModule({
      providers: [InvitationsApi, { provide: InvitationsService, useValue: { listInvitations } }],
    });

    await expect(TestBed.inject(InvitationsApi).list(controller.signal)).rejects.toBeDefined();

    expect(listInvitations).toHaveBeenCalledTimes(1);
  });

  it('gives an address the batch answer leaves out an unknown outcome', async () => {
    const inviteMembers: Mock = vi.fn(() =>
      of({
        invitations: [{ email: 'lucie@example.com', outcome: 'invited', invitationId: 'i5' }],
      }),
    );
    TestBed.configureTestingModule({
      providers: [InvitationsApi, { provide: InvitationsService, useValue: { inviteMembers } }],
    });

    await expect(
      TestBed.inject(InvitationsApi).invite(['lucie@example.com', 'paul@example.com'], 'member'),
    ).resolves.toEqual({ invited: 1, skipped: 0, notSent: [], unknown: ['paul@example.com'] });
  });
});
