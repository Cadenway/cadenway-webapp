import { TestBed } from '@angular/core/testing';
import { type InvitationPage, InvitationsService } from '@cadenway/api-client';
import { NEVER, of } from 'rxjs';
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
      TestBed.inject(InvitationsApi).invite(
        ['lucie@example.com', 'paul@example.com'],
        'member',
        'k-1',
      ),
    ).resolves.toEqual({ invited: 1, skipped: 0, notSent: [], unknown: ['paul@example.com'] });
  });

  it('sends the batch under its Idempotency-Key', async () => {
    const inviteMembers: Mock = vi.fn(() => of({ invitations: [] }));
    TestBed.configureTestingModule({
      providers: [InvitationsApi, { provide: InvitationsService, useValue: { inviteMembers } }],
    });

    await TestBed.inject(InvitationsApi).invite(['lucie@example.com'], 'guest', 'k-2');

    expect(inviteMembers).toHaveBeenCalledWith(
      { emails: ['lucie@example.com'], role: 'guest' },
      { headers: { 'Idempotency-Key': 'k-2' } },
    );
  });

  it('reads one invitation in any state of its lifecycle', async () => {
    const getInvitation: Mock = vi.fn(() =>
      of({
        ...page('i1', null).items[0],
        status: 'revoked',
        answeredAt: null,
        revokedAt: '2026-11-26T09:00:00Z',
      }),
    );
    TestBed.configureTestingModule({
      providers: [InvitationsApi, { provide: InvitationsService, useValue: { getInvitation } }],
    });

    await expect(TestBed.inject(InvitationsApi).standing('i1')).resolves.toEqual({
      status: 'revoked',
      invitation: {
        id: 'i1',
        email: 'i1@ateliernord.fr',
        role: 'member',
        invitedBy: 'Inès Robert',
        expired: false,
        expiresAt: '2026-12-02T10:00:00Z',
      },
    });
    expect(getInvitation).toHaveBeenCalledWith('i1');
  });

  it('reads a state this version does not know as other, and asks again each time', async () => {
    const getInvitation: Mock = vi.fn(() =>
      of({ ...page('i1', null).items[0], status: 'archived', answeredAt: null, revokedAt: null }),
    );
    TestBed.configureTestingModule({
      providers: [InvitationsApi, { provide: InvitationsService, useValue: { getInvitation } }],
    });
    const api: InvitationsApi = TestBed.inject(InvitationsApi);

    await expect(api.standing('i1')).resolves.toMatchObject({ status: 'other' });
    await api.standing('i1');

    expect(getInvitation).toHaveBeenCalledTimes(2);
  });

  it('gives the read of one invitation up once its signal is aborted', async () => {
    const getInvitation: Mock = vi.fn(() => NEVER);
    TestBed.configureTestingModule({
      providers: [InvitationsApi, { provide: InvitationsService, useValue: { getInvitation } }],
    });
    const controller: AbortController = new AbortController();

    const read: Promise<unknown> = TestBed.inject(InvitationsApi).standing('i1', controller.signal);
    controller.abort();

    await expect(read).rejects.toBeDefined();
  });
});
