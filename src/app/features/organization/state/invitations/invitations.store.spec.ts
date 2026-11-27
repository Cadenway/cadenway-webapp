import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { describe, expect, it, type Mock, vi } from 'vitest';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
  type WorkspaceRole,
} from '@features/workspace/ports/workspace-context';

import { InvitationsApi } from '../../data-access/services/invitations-api/invitations-api.service';
import type {
  InvitationList,
  PendingInvitation,
} from '../../models/invitation/invitation.interface';
import { InvitationsStore, type InvitationsStoreInstance } from './invitations.store';

/**
 * Constant MARC
 *
 * @description
 * The mockup's invitation of Marc Roux, pending.
 *
 * @type {PendingInvitation}
 */
const MARC: PendingInvitation = {
  id: 'i1',
  email: 'marc.roux@ateliernord.fr',
  role: 'member',
  invitedBy: 'Inès Robert',
  expired: false,
  expiresAt: '2026-12-02T10:00:00Z',
};

/**
 * Constant STUDIO
 *
 * @description
 * The mockup's expired invitation of the studio.
 *
 * @type {PendingInvitation}
 */
const STUDIO: PendingInvitation = {
  id: 'i3',
  email: 'atelier@nordstudio.fr',
  role: 'member',
  invitedBy: 'Hugo Dubois',
  expired: true,
  expiresAt: '2026-11-02T10:00:00Z',
};

/**
 * Constant LIST
 *
 * @description
 * The pending invitations the fake API answers.
 *
 * @type {InvitationList}
 */
const LIST: InvitationList = { items: [MARC, STUDIO], total: 2 };

/**
 * Interface Harness
 *
 * @description
 * The store under test and its fakes.
 */
interface Harness {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * The store.
   *
   * @type {InvitationsStoreInstance}
   * @readonly
   */
  readonly store: InvitationsStoreInstance;

  /**
   * Property api
   *
   * @description
   * Fake of the invitations data access.
   *
   * @type {Record<'list' | 'invite' | 'resend' | 'revoke', Mock>}
   * @readonly
   */
  readonly api: Record<'list' | 'invite' | 'resend' | 'revoke', Mock>;

  /**
   * Property toasts
   *
   * @description
   * Fake of the toast service.
   *
   * @type {Record<'success' | 'error' | 'info', Mock>}
   * @readonly
   */
  readonly toasts: Record<'success' | 'error' | 'info', Mock>;
  // #endregion
}

/**
 * Function setup
 *
 * @description
 * Creates the store for a role over a fake data access and waits for its read.
 *
 * @param {Partial<Record<'list' | 'invite' | 'resend' | 'revoke', Mock>>} overrides - Fakes.
 * @param {WorkspaceRole} [role] - The person's role.
 * @returns {Promise<Harness>} The store and its fakes.
 */
async function setup(
  overrides: Partial<Record<'list' | 'invite' | 'resend' | 'revoke', Mock>>,
  role: WorkspaceRole = 'admin',
): Promise<Harness> {
  const api: Record<'list' | 'invite' | 'resend' | 'revoke', Mock> = {
    list: vi.fn(() => Promise.resolve(LIST)),
    invite: vi.fn(() => Promise.resolve({ invited: 2, skipped: 0 })),
    resend: vi.fn((): Promise<PendingInvitation> => Promise.resolve({ ...STUDIO, expired: false })),
    revoke: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
  const toasts: Record<'success' | 'error' | 'info', Mock> = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  };
  const workspace: WorkspaceContextPort = {
    user: signal({
      id: 'u-ir',
      name: 'Inès Robert',
      firstName: 'Inès',
      displayName: null,
      email: 'ines.robert@ateliernord.fr',
      initials: 'IR',
    }),
    organization: signal({
      id: 'o1',
      slug: 'atelier-nord',
      name: 'Atelier Nord',
      initials: 'AN',
      role,
      plan: 'team',
    }),
    role: signal(role),
    can: (): boolean => role === 'owner' || role === 'admin',
  };
  TestBed.configureTestingModule({
    providers: [
      InvitationsStore,
      { provide: InvitationsApi, useValue: api },
      { provide: CwToastService, useValue: toasts },
      { provide: WORKSPACE_CONTEXT, useValue: workspace },
    ],
  });
  const store: InvitationsStoreInstance = TestBed.inject(InvitationsStore);
  await TestBed.inject(ApplicationRef).whenStable();
  return { store, api, toasts };
}

describe('InvitationsStore', () => {
  it('reads nothing for a member, who may not manage invitations', async () => {
    const { store, api }: Harness = await setup({}, 'member');

    expect(store.readable()).toBe(false);
    expect(api.list).not.toHaveBeenCalled();
    expect(store.total()).toBeNull();
  });

  it('shows a resent invitation as pending at once and keeps the answer', async () => {
    const { store, toasts }: Harness = await setup({});

    const done: Promise<boolean> = store.resend(STUDIO);
    expect(store.items()[1]?.expired).toBe(false);
    expect(store.pendingIds().has('i3')).toBe(true);

    await expect(done).resolves.toBe(true);
    expect(store.items()[1]?.expired).toBe(false);
    expect(store.pendingIds().size).toBe(0);
    expect(toasts.success).toHaveBeenCalledWith('Invitation resent', {
      description: 'atelier@nordstudio.fr',
    });
  });

  it('restores an invitation whose resend is throttled', async () => {
    const { store, toasts }: Harness = await setup({
      resend: vi
        .fn()
        .mockRejectedValue(
          new HttpErrorResponse({ status: 429, error: { code: 'invitation.resend-throttled' } }),
        ),
    });

    await expect(store.resend(STUDIO)).resolves.toBe(false);

    expect(store.items()[1]).toEqual(STUDIO);
    expect(toasts.error).toHaveBeenCalledWith('The invitation could not be resent', {
      description: 'This invitation was just resent: try again in an hour.',
    });
  });

  it('hides a cancelled invitation and shows it again when the cancellation fails', async () => {
    let refuse: (error: unknown) => void = () => undefined;
    const { store, toasts }: Harness = await setup({
      revoke: vi.fn(
        () =>
          new Promise<void>((_resolve: () => void, reject: (error: unknown) => void) => {
            refuse = reject;
          }),
      ),
    });

    const done: Promise<boolean> = store.revoke(MARC);
    expect(store.items()).toEqual([STUDIO]);
    expect(store.total()).toBe(1);
    refuse(new HttpErrorResponse({ status: 500 }));

    await expect(done).resolves.toBe(false);
    expect(store.items()).toEqual([MARC, STUDIO]);
    expect(toasts.error).toHaveBeenCalledWith('The invitation could not be cancelled');
  });

  it('sends a batch, reads the list again and counts the invitations sent', async () => {
    const { store, api, toasts }: Harness = await setup({
      invite: vi.fn(() => Promise.resolve({ invited: 2, skipped: 1 })),
    });

    await expect(
      store.invite(['lucie@example.com', 'marc.roux@ateliernord.fr', 'paul@example.com'], 'member'),
    ).resolves.toBe(true);
    await TestBed.inject(ApplicationRef).whenStable();

    expect(api.list).toHaveBeenCalledTimes(2);
    expect(toasts.success).toHaveBeenCalledWith('2 invitations sent', {
      description: 'They expire in 7 days. 1 address skipped: already a member or invited.',
    });
  });

  it('keeps the dialog data when the daily limit refuses the batch', async () => {
    const { store, toasts }: Harness = await setup({
      invite: vi
        .fn()
        .mockRejectedValue(
          new HttpErrorResponse({ status: 429, error: { code: 'invitation.daily-limit-reached' } }),
        ),
    });

    await expect(store.invite(['lucie@example.com'], 'guest')).resolves.toBe(false);

    expect(store.inviting()).toBe(false);
    expect(toasts.error).toHaveBeenCalledWith('The invitations could not be sent', {
      description: 'The daily invitation limit is reached: try again later.',
    });
  });
});
