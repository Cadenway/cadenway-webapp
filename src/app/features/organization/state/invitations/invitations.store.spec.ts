import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { describe, expect, it, type Mock, vi } from 'vitest';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
  type WorkspaceOrganization,
  type WorkspaceRole,
} from '@features/workspace/ports/workspace-context';

import { InvitationsApi } from '../../data-access/services/invitations-api/invitations-api.service';
import type {
  InvitationList,
  PendingInvitation,
} from '../../models/invitation/invitation.interface';
import { InvitationsStore, type InvitationsStoreInstance } from './invitations.store';

/**
 * Type ApiFake
 *
 * @description
 * Fake of the invitations data access, one mock per method.
 *
 * @type {Record<'list' | 'invite' | 'resend' | 'revoke', Mock>}
 */
type ApiFake = Record<'list' | 'invite' | 'resend' | 'revoke', Mock>;

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
 * Constant ATELIER_NORD
 *
 * @description
 * The organization of the workspace.
 *
 * @type {WorkspaceOrganization}
 */
const ATELIER_NORD: WorkspaceOrganization = {
  id: 'o1',
  slug: 'atelier-nord',
  name: 'Atelier Nord',
  initials: 'AN',
  role: 'admin',
  plan: 'team',
};

/**
 * Function refusal
 *
 * @description
 * An API refusal as the generated client rejects it.
 *
 * @param {number} status - HTTP status.
 * @param {Record<string, unknown>} body - Problem body.
 * @returns {HttpErrorResponse} The refusal.
 */
function refusal(status: number, body: Record<string, unknown>): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

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
   * @type {ApiFake}
   * @readonly
   */
  readonly api: ApiFake;

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

  /**
   * Property organization
   *
   * @description
   * The workspace organization, switchable.
   *
   * @type {WritableSignal<WorkspaceOrganization>}
   * @readonly
   */
  readonly organization: WritableSignal<WorkspaceOrganization>;
  // #endregion
}

/**
 * Function setup
 *
 * @description
 * Creates the store for a role over a fake data access and waits for its read.
 *
 * @param {Partial<ApiFake>} overrides - Fakes.
 * @param {WorkspaceRole} [role] - The person's role.
 * @returns {Promise<Harness>} The store and its fakes.
 */
async function setup(overrides: Partial<ApiFake>, role: WorkspaceRole = 'admin'): Promise<Harness> {
  const api: ApiFake = {
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
  const organization: WritableSignal<WorkspaceOrganization> = signal({ ...ATELIER_NORD, role });
  const workspace: WorkspaceContextPort = {
    user: signal({
      id: 'u-ir',
      name: 'Inès Robert',
      firstName: 'Inès',
      displayName: null,
      email: 'ines.robert@ateliernord.fr',
      initials: 'IR',
    }),
    organization,
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
  await stable();
  return { store, api, toasts, organization };
}

/**
 * Function stable
 *
 * @description
 * Waits for the reads and the effects.
 *
 * @returns {Promise<void>} Resolves once stable.
 */
async function stable(): Promise<void> {
  await TestBed.inject(ApplicationRef).whenStable();
}

/**
 * Function flush
 *
 * @description
 * Runs the effects and the microtasks while a read is still pending.
 *
 * @returns {Promise<void>} Resolves once flushed.
 */
async function flush(): Promise<void> {
  TestBed.tick();
  await new Promise<void>((done: () => void) => {
    setTimeout(done, 0);
  });
  TestBed.tick();
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
      resend: vi.fn().mockRejectedValue(refusal(429, { code: 'invitation.resend-throttled' })),
    });

    await expect(store.resend(STUDIO)).resolves.toBe(false);

    expect(store.items()[1]).toEqual(STUDIO);
    expect(toasts.error).toHaveBeenCalledWith('The invitation could not be resent', {
      description: 'This invitation was just resent: try again in an hour.',
    });
  });

  it('tells a resend refused by the daily limit apart', async () => {
    const { store, toasts }: Harness = await setup({
      resend: vi.fn().mockRejectedValue(refusal(429, { code: 'invitation.daily-limit-reached' })),
    });

    await store.resend(STUDIO);

    expect(toasts.error).toHaveBeenCalledWith('The invitation could not be resent', {
      description: 'The daily invitation limit is reached: try again later.',
    });
  });

  it('drops an invitation answered meanwhile and reads the list again', async () => {
    const { store, api, toasts }: Harness = await setup({
      resend: vi.fn().mockRejectedValue(refusal(409, { code: 'invitation.answered' })),
      revoke: vi.fn().mockRejectedValue(refusal(409, { code: 'invitation.answered' })),
    });

    await expect(store.resend(STUDIO)).resolves.toBe(false);
    expect(store.items()).toEqual([MARC]);
    await stable();
    api.list.mockResolvedValue({ items: [], total: 0 });
    await expect(store.revoke(MARC)).resolves.toBe(false);
    await stable();

    expect(api.list).toHaveBeenCalledTimes(3);
    expect(store.items()).toEqual([]);
    expect(toasts.info).toHaveBeenCalledWith('This invitation is no longer pending', {
      description: 'marc.roux@ateliernord.fr',
    });
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('hides a cancelled invitation and shows it again when the cancellation fails', async () => {
    let refuse: (error: Error) => void = () => undefined;
    const { store, toasts }: Harness = await setup({
      revoke: vi.fn(
        () =>
          new Promise<void>((_resolve: () => void, reject: (error: Error) => void) => {
            refuse = reject;
          }),
      ),
    });

    const done: Promise<boolean> = store.revoke(MARC);
    expect(store.items()).toEqual([STUDIO]);
    expect(store.total()).toBe(1);
    refuse(new Error('Server error'));

    await expect(done).resolves.toBe(false);
    expect(store.items()).toEqual([MARC, STUDIO]);
    expect(toasts.error).toHaveBeenCalledWith('The invitation could not be cancelled');
  });

  it('keeps a confirmed cancellation over a read issued before it settled', async () => {
    let answer: () => void = () => undefined;
    let stale: (list: InvitationList) => void = () => undefined;
    const { store, api }: Harness = await setup({
      revoke: vi.fn(
        () =>
          new Promise<void>((resolve: () => void) => {
            answer = resolve;
          }),
      ),
    });

    const done: Promise<boolean> = store.revoke(MARC);
    api.list.mockReturnValueOnce(
      new Promise<InvitationList>((resolve: (list: InvitationList) => void) => {
        stale = resolve;
      }),
    );
    store.retry();
    await flush();
    answer();
    await done;
    stale(LIST);
    await stable();

    expect(store.items()).toEqual([STUDIO]);
    expect(store.total()).toBe(1);
    store.retry();
    await stable();
    expect(store.items()).toEqual([MARC, STUDIO]);
  });

  it('reads the list again after a batch, even while a read is under way', async () => {
    let first: (list: InvitationList) => void = () => undefined;
    const { store, api, toasts }: Harness = await setup({
      invite: vi.fn(() => Promise.resolve({ invited: 2, skipped: 1 })),
    });
    api.list.mockReturnValueOnce(
      new Promise<InvitationList>((resolve: (list: InvitationList) => void) => {
        first = resolve;
      }),
    );
    store.retry();
    await flush();

    await expect(
      store.invite(['lucie@example.com', 'marc.roux@ateliernord.fr', 'paul@example.com'], 'member'),
    ).resolves.toBe('sent');
    first(LIST);
    await stable();

    expect(api.list).toHaveBeenCalledTimes(3);
    expect(toasts.success).toHaveBeenCalledWith('2 invitations sent', {
      description: 'They expire in 7 days. 1 address skipped: already a member or invited.',
    });
  });

  it('answers the addresses a 400 names, without a toast', async () => {
    const { store, toasts }: Harness = await setup({
      invite: vi.fn().mockRejectedValue(
        refusal(400, {
          code: 'request.invalid',
          details: { issues: [{ path: 'emails.1', message: 'Invalid email' }] },
        }),
      ),
    });

    await expect(store.invite(['lucie@example.com', 'bad@x.y'], 'member')).resolves.toEqual({
      refused: ['bad@x.y'],
    });
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('shows the daily limit when it refuses the batch', async () => {
    const { store, toasts }: Harness = await setup({
      invite: vi.fn().mockRejectedValue(refusal(429, { code: 'invitation.daily-limit-reached' })),
    });

    await expect(store.invite(['lucie@example.com'], 'guest')).resolves.toBe('failed');

    expect(store.inviting()).toBe(false);
    expect(toasts.error).toHaveBeenCalledWith('The invitations could not be sent', {
      description: 'The daily invitation limit is reached: try again later.',
    });
  });

  it('forgets a write that settles after an organization switch', async () => {
    let answer: () => void = () => undefined;
    const { store, toasts, organization }: Harness = await setup({
      revoke: vi.fn(
        () =>
          new Promise<void>((resolve: () => void) => {
            answer = resolve;
          }),
      ),
    });

    const done: Promise<boolean> = store.revoke(MARC);
    organization.set({ ...ATELIER_NORD, id: 'o2', slug: 'lumen', name: 'Lumen' });
    await stable();
    answer();

    await expect(done).resolves.toBe(false);
    expect(store.pendingIds().size).toBe(0);
    expect(toasts.success).not.toHaveBeenCalled();
  });
});
