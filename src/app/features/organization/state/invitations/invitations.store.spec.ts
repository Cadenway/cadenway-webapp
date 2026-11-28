import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { OrganizationPin, OrganizationSwitchPendingError } from '@core/api';
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
import { MembersStore } from '../members/members.store';
import { SubscriptionStore } from '../subscription/subscription.store';
import {
  type InviteResult,
  InvitationsStore,
  type InvitationsStoreInstance,
} from './invitations.store';
import { INVITATION_SETTLE_DELAYS_MS } from './invitation-settle-delays.token';

/**
 * Type ToastTone
 *
 * @description
 * The toast methods the store calls.
 *
 * @type {'success' | 'error' | 'info' | 'warning'}
 */
type ToastTone = 'success' | 'error' | 'info' | 'warning';

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
   * @type {Record<ToastTone, Mock>}
   * @readonly
   */
  readonly toasts: Record<ToastTone, Mock>;

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

  /**
   * Property pin
   *
   * @description
   * The organization pin, pinned to the workspace organization.
   *
   * @type {OrganizationPin}
   * @readonly
   */
  readonly pin: OrganizationPin;

  /**
   * Property membersStore
   *
   * @description
   * Fake of the page's members store.
   *
   * @type {Record<'retry', Mock>}
   * @readonly
   */
  readonly membersStore: Record<'retry', Mock>;

  /**
   * Property subscription
   *
   * @description
   * Fake of the shared subscription store, whose seats an owner reads.
   *
   * @type {Record<'retry', Mock>}
   * @readonly
   */
  readonly subscription: Record<'retry', Mock>;
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
 * @param {readonly number[]} [delays] - Waits before each settling attempt, in milliseconds.
 * @returns {Promise<Harness>} The store and its fakes.
 */
async function setup(
  overrides: Partial<ApiFake>,
  role: WorkspaceRole = 'admin',
  delays: readonly number[] = [0, 0, 0],
): Promise<Harness> {
  const api: ApiFake = {
    list: vi.fn(() => Promise.resolve(LIST)),
    invite: vi.fn(() => Promise.resolve({ invited: 2, skipped: 0, notSent: [] })),
    resend: vi.fn((): Promise<PendingInvitation> => Promise.resolve({ ...STUDIO, expired: false })),
    revoke: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
  const membersStore: Record<'retry', Mock> = { retry: vi.fn() };
  const subscription: Record<'retry', Mock> = { retry: vi.fn() };
  const toasts: Record<ToastTone, Mock> = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
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
      { provide: INVITATION_SETTLE_DELAYS_MS, useValue: delays },
      { provide: MembersStore, useValue: membersStore },
      { provide: SubscriptionStore, useValue: subscription },
    ],
  });
  const pin: OrganizationPin = TestBed.inject(OrganizationPin);
  pin.set(ATELIER_NORD.id);
  const store: InvitationsStoreInstance = TestBed.inject(InvitationsStore);
  await stable();
  return { store, api, toasts, organization, pin, membersStore, subscription };
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
    refuse(refusal(403, { code: 'organization.role-forbidden' }));

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
      invite: vi.fn(() => Promise.resolve({ invited: 2, skipped: 1, notSent: [] })),
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

  describe('an invite whose outcome is unknown', () => {
    const uncertain: readonly [string, unknown][] = [
      ['a server failure', refusal(503, { code: 'service.unavailable' })],
      ['no answer', new HttpErrorResponse({ status: 0 })],
      ['a timeout', refusal(408, { code: 'request.timeout' })],
      [
        'the same request still in progress',
        refusal(409, { code: 'idempotency.request-in-progress' }),
      ],
    ];

    for (const [name, error] of uncertain) {
      it(`keeps every address without a failure toast after ${name}`, async () => {
        const { store, api, toasts }: Harness = await setup({
          invite: vi.fn().mockRejectedValue(error),
        });
        const emails: readonly string[] = ['lucie@example.com', 'paul@example.com'];

        await expect(store.invite(emails, 'member')).resolves.toEqual({ kept: emails });
        await stable();

        expect(store.inviting()).toBe(false);
        expect(toasts.error).not.toHaveBeenCalled();
        expect(toasts.warning).toHaveBeenCalledWith('The invitations may not have been sent', {
          description: 'Sending again is safe.',
        });
        expect(api.list).toHaveBeenCalledTimes(2);
      });
    }

    it('sends the same addresses again, which the first send may have reached', async () => {
      const { store, api, toasts }: Harness = await setup({
        invite: vi
          .fn()
          .mockRejectedValueOnce(refusal(502, {}))
          .mockResolvedValueOnce({ invited: 1, skipped: 1, notSent: [] }),
      });
      const emails: readonly string[] = ['lucie@example.com', 'paul@example.com'];

      await expect(store.invite(emails, 'admin')).resolves.toEqual({ kept: emails });
      await expect(store.invite(emails, 'admin')).resolves.toBe('sent');

      expect(api.invite).toHaveBeenNthCalledWith(2, emails, 'admin');
      expect(toasts.success).toHaveBeenCalledWith('1 invitation sent', {
        description: 'They expire in 7 days. 1 address skipped: already a member or invited.',
      });
      expect(toasts.error).not.toHaveBeenCalled();
    });
  });

  it('keeps the addresses a batch did not send, after the invited ones', async () => {
    const { store, toasts }: Harness = await setup({
      invite: vi.fn(() =>
        Promise.resolve({ invited: 1, skipped: 1, notSent: ['Paul@Example.com'] }),
      ),
    });

    await expect(
      store.invite(['lucie@example.com', 'marc.roux@ateliernord.fr', 'paul@example.com'], 'member'),
    ).resolves.toEqual({ kept: ['paul@example.com'] });

    expect(toasts.success).toHaveBeenCalledWith('1 invitation sent', {
      description: 'They expire in 7 days. 1 address skipped: already a member or invited.',
    });
    expect(toasts.error).toHaveBeenCalledWith('1 address could not be invited', {
      description: 'The addresses stay in the list: press Invite to try again.',
    });
  });

  it('counts the skipped addresses in the summary when none was invited', async () => {
    const { store, toasts }: Harness = await setup({
      invite: vi.fn(() =>
        Promise.resolve({
          invited: 0,
          skipped: 1,
          notSent: ['lucie@example.com', 'paul@example.com'],
        }),
      ),
    });

    await store.invite(
      ['lucie@example.com', 'marc.roux@ateliernord.fr', 'paul@example.com'],
      'member',
    );

    expect(toasts.success).not.toHaveBeenCalled();
    expect(toasts.info).not.toHaveBeenCalled();
    expect(toasts.error).toHaveBeenCalledWith('2 addresses could not be invited', {
      description:
        '1 address skipped: already a member or invited. The addresses stay in the list: press Invite to try again.',
    });
  });

  it('drops a batch blocked by a switch or refused for another organization, silently', async () => {
    const { store, toasts }: Harness = await setup({
      invite: vi
        .fn()
        .mockRejectedValueOnce(new OrganizationSwitchPendingError())
        .mockRejectedValueOnce(refusal(412, { code: 'organization.context-changed' })),
    });

    await expect(store.invite(['lucie@example.com'], 'member')).resolves.toBe('dropped');
    await expect(store.invite(['lucie@example.com'], 'member')).resolves.toBe('dropped');

    expect(store.inviting()).toBe(false);
    for (const toast of Object.values(toasts)) expect(toast).not.toHaveBeenCalled();
  });

  describe('a write pending through a switch away and back', () => {
    /**
     * Function switchAwayAndBack
     *
     * @description
     * Commits another organization, then the first one again, before anything settles.
     *
     * @param {Harness} harness - The store and its fakes.
     */
    function switchAwayAndBack({ pin, organization }: Harness): void {
      pin.set('o2');
      organization.set({ ...ATELIER_NORD, id: 'o2', slug: 'lumen', name: 'Lumen' });
      pin.set(ATELIER_NORD.id);
      organization.set(ATELIER_NORD);
    }

    it('applies and says nothing of an invite', async () => {
      let answer: (outcome: unknown) => void = () => undefined;
      const harness: Harness = await setup({
        invite: vi.fn(
          () =>
            new Promise<unknown>((resolve: (outcome: unknown) => void) => {
              answer = resolve;
            }),
        ),
      });
      const { store, api, toasts }: Harness = harness;

      const done: Promise<InviteResult> = store.invite(['lucie@example.com'], 'member');
      api.invite.mockResolvedValue({ invited: 1, skipped: 0, notSent: [] });
      switchAwayAndBack(harness);
      answer({ invited: 1, skipped: 0, notSent: [] });

      await expect(done).resolves.toBe('dropped');
      await stable();
      for (const toast of Object.values(toasts)) expect(toast).not.toHaveBeenCalled();
      expect(store.inviting()).toBe(false);
      await expect(store.invite(['paul@example.com'], 'member')).resolves.toBe('sent');
    });

    it('says nothing of an invite that fails', async () => {
      let fail: (error: unknown) => void = () => undefined;
      const harness: Harness = await setup({
        invite: vi.fn(
          () =>
            new Promise<void>((_resolve: () => void, reject: (error: unknown) => void) => {
              fail = reject;
            }),
        ),
      });

      const done: Promise<InviteResult> = harness.store.invite(['lucie@example.com'], 'member');
      switchAwayAndBack(harness);
      fail(refusal(503, {}));

      await expect(done).resolves.toBe('dropped');
      for (const toast of Object.values(harness.toasts)) expect(toast).not.toHaveBeenCalled();
    });

    it('applies and says nothing of a resend or a cancellation', async () => {
      let resent: (invitation: PendingInvitation) => void = () => undefined;
      let revoked: () => void = () => undefined;
      const harness: Harness = await setup({
        resend: vi.fn(
          () =>
            new Promise<PendingInvitation>((resolve: (invitation: PendingInvitation) => void) => {
              resent = resolve;
            }),
        ),
        revoke: vi.fn(
          () =>
            new Promise<void>((resolve: () => void) => {
              revoked = resolve;
            }),
        ),
      });
      const { store, toasts }: Harness = harness;

      const resend: Promise<boolean> = store.resend(STUDIO);
      const revoke: Promise<boolean> = store.revoke(MARC);
      switchAwayAndBack(harness);
      resent({ ...STUDIO, expired: false });
      revoked();

      await expect(resend).resolves.toBe(false);
      await expect(revoke).resolves.toBe(false);
      await stable();
      expect(store.items()).toEqual([MARC, STUDIO]);
      expect(store.pendingIds().size).toBe(0);
      expect(toasts.success).not.toHaveBeenCalled();
    });
  });

  it('says a resend and a cancellation of unknown outcome may not have been made', async () => {
    const { store, api, toasts }: Harness = await setup({
      resend: vi.fn().mockRejectedValue(refusal(500, {})),
      revoke: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 0 })),
    });

    await expect(store.resend(STUDIO)).resolves.toBe(false);
    await expect(store.revoke(MARC)).resolves.toBe(false);
    await stable();

    expect(store.items()).toEqual([MARC, STUDIO]);
    expect(toasts.error).not.toHaveBeenCalled();
    expect(toasts.warning).toHaveBeenCalledWith('The invitation may not have been resent', {
      description: 'atelier@nordstudio.fr',
    });
    expect(toasts.warning).toHaveBeenCalledWith('The invitation may not have been cancelled', {
      description: 'marc.roux@ateliernord.fr',
    });
    expect(api.resend).toHaveBeenCalledTimes(1);
    expect(api.revoke).toHaveBeenCalledTimes(4);
    expect(api.list).toHaveBeenCalledTimes(7);
  });

  it('restores a resend dropped for another session organization, silently', async () => {
    const { store, toasts }: Harness = await setup({
      resend: vi.fn().mockRejectedValue(refusal(412, { code: 'organization.context-changed' })),
    });

    await expect(store.resend(STUDIO)).resolves.toBe(false);

    expect(store.items()[1]).toEqual(STUDIO);
    for (const toast of Object.values(toasts)) expect(toast).not.toHaveBeenCalled();
  });

  describe('settling a write of unknown outcome', () => {
    it('cancels again until the cancellation is confirmed, past a read from before it', async () => {
      const { store, api, toasts }: Harness = await setup({
        revoke: vi.fn().mockRejectedValueOnce(refusal(503, {})).mockResolvedValueOnce(undefined),
      });

      const done: Promise<boolean> = store.revoke(MARC);
      expect(store.items()).toEqual([STUDIO]);
      await expect(done).resolves.toBe(true);
      await stable();

      expect(api.revoke).toHaveBeenCalledTimes(2);
      expect(store.items()).toEqual([STUDIO]);
      expect(store.total()).toBe(1);
      expect(toasts.success).toHaveBeenCalledWith('Invitation cancelled', {
        description: 'marc.roux@ateliernord.fr',
      });
      expect(toasts.warning).not.toHaveBeenCalled();
    });

    it('reads the list until it shows the resend, never resending', async () => {
      const resentStudio: PendingInvitation = {
        ...STUDIO,
        expired: false,
        expiresAt: '2026-12-05T10:00:00Z',
      };
      const { store, api, toasts }: Harness = await setup({
        resend: vi.fn().mockRejectedValue(refusal(504, {})),
      });
      api.list
        .mockResolvedValueOnce(LIST)
        .mockResolvedValue({ items: [MARC, resentStudio], total: 2 });

      const done: Promise<boolean> = store.resend(STUDIO);
      expect(store.pendingIds().has('i3')).toBe(true);
      await expect(done).resolves.toBe(true);
      await stable();

      expect(api.resend).toHaveBeenCalledTimes(1);
      expect(store.items()[1]).toEqual(resentStudio);
      expect(store.pendingIds().size).toBe(0);
      expect(toasts.success).toHaveBeenCalledWith('Invitation resent', {
        description: 'atelier@nordstudio.fr',
      });
      expect(toasts.warning).not.toHaveBeenCalled();
    });

    it('takes no throttle after an unknown resend as proof while the expiry stays', async () => {
      const { store, toasts }: Harness = await setup({
        resend: vi
          .fn()
          .mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }))
          .mockRejectedValueOnce(refusal(429, { code: 'invitation.resend-throttled' })),
      });

      await expect(store.resend(STUDIO)).resolves.toBe(false);
      expect(toasts.warning).toHaveBeenCalledWith('The invitation may not have been resent', {
        description: 'atelier@nordstudio.fr',
      });
      await expect(store.resend(STUDIO)).resolves.toBe(false);
      await stable();

      expect(toasts.success).not.toHaveBeenCalled();
      expect(toasts.error).not.toHaveBeenCalled();
      expect(toasts.warning).toHaveBeenLastCalledWith('The invitation may not have been resent', {
        description: 'This invitation was just resent: try again in an hour.',
      });
      expect(store.items()[1]).toEqual(STUDIO);
    });

    it('takes a throttle after an unknown resend as resent once the list shows it', async () => {
      const resentStudio: PendingInvitation = {
        ...STUDIO,
        expired: false,
        expiresAt: '2026-12-05T10:00:00Z',
      };
      const { store, api, toasts }: Harness = await setup({
        resend: vi
          .fn()
          .mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }))
          .mockRejectedValueOnce(refusal(429, { code: 'invitation.resend-throttled' })),
      });

      await expect(store.resend(STUDIO)).resolves.toBe(false);
      api.list.mockResolvedValue({ items: [MARC, resentStudio], total: 2 });
      await expect(store.resend(STUDIO)).resolves.toBe(true);
      await stable();

      expect(toasts.success).toHaveBeenCalledWith('Invitation resent', {
        description: 'atelier@nordstudio.fr',
      });
      expect(store.items()[1]).toEqual(resentStudio);
    });

    it('claims no outcome of an invitation gone after an unknown cancellation', async () => {
      const { store, api, toasts, membersStore, subscription }: Harness = await setup(
        {
          revoke: vi
            .fn()
            .mockRejectedValueOnce(refusal(503, {}))
            .mockRejectedValueOnce(refusal(403, { code: 'organization.role-forbidden' })),
        },
        'owner',
      );
      api.list.mockResolvedValue({ items: [STUDIO], total: 1 });

      await expect(store.revoke(MARC)).resolves.toBe(false);
      await stable();

      expect(store.items()).toEqual([STUDIO]);
      expect(toasts.success).not.toHaveBeenCalled();
      expect(toasts.error).not.toHaveBeenCalled();
      expect(toasts.warning).not.toHaveBeenCalled();
      expect(toasts.info).toHaveBeenCalledTimes(1);
      expect(toasts.info).toHaveBeenCalledWith('This invitation is no longer pending', {
        description:
          'The invitation of marc.roux@ateliernord.fr may have been cancelled, accepted or declined: the members list shows who joined.',
      });
      expect(membersStore.retry).toHaveBeenCalledTimes(1);
      expect(subscription.retry).toHaveBeenCalledTimes(1);
    });

    it('says a cancellation answered as declined was declined', async () => {
      const { store, toasts, membersStore }: Harness = await setup({
        revoke: vi
          .fn()
          .mockRejectedValue(
            refusal(409, { code: 'invitation.answered', details: { status: 'refused' } }),
          ),
      });

      await expect(store.revoke(MARC)).resolves.toBe(false);

      expect(store.items()).toEqual([STUDIO]);
      expect(toasts.success).not.toHaveBeenCalled();
      expect(toasts.info).toHaveBeenCalledWith(
        'The invitation was declined before it could be cancelled',
        { description: 'marc.roux@ateliernord.fr' },
      );
      expect(membersStore.retry).not.toHaveBeenCalled();
    });

    it('says a cancellation answered as accepted was accepted', async () => {
      const { store, toasts, membersStore }: Harness = await setup({
        revoke: vi
          .fn()
          .mockRejectedValue(
            refusal(409, { code: 'invitation.answered', details: { status: 'accepted' } }),
          ),
      });

      await expect(store.revoke(MARC)).resolves.toBe(false);

      expect(store.items()).toEqual([STUDIO]);
      expect(toasts.success).not.toHaveBeenCalled();
      expect(toasts.info).toHaveBeenCalledWith(
        'The invitation was accepted before it could be cancelled',
        { description: 'marc.roux@ateliernord.fr is now a member of the organization.' },
      );
      expect(membersStore.retry).toHaveBeenCalledTimes(1);
    });

    it('warns, not fails, of a cancellation refused after an unknown attempt it lists', async () => {
      const { store, toasts }: Harness = await setup({
        revoke: vi
          .fn()
          .mockRejectedValueOnce(refusal(503, {}))
          .mockRejectedValueOnce(refusal(403, { code: 'organization.role-forbidden' })),
      });

      await expect(store.revoke(MARC)).resolves.toBe(false);
      await stable();

      expect(store.items()).toEqual([MARC, STUDIO]);
      expect(toasts.error).not.toHaveBeenCalled();
      expect(toasts.warning).toHaveBeenCalledWith('The invitation may not have been cancelled', {
        description: 'marc.roux@ateliernord.fr',
      });
    });

    it('stops settling once another organization is committed', async () => {
      const { store, api, toasts, pin }: Harness = await setup(
        { revoke: vi.fn().mockRejectedValue(refusal(503, {})) },
        'admin',
        [20, 20, 20],
      );

      const done: Promise<boolean> = store.revoke(MARC);
      pin.set('o2');
      pin.set(ATELIER_NORD.id);

      await expect(done).resolves.toBe(false);
      expect(api.revoke).toHaveBeenCalledTimes(1);
      for (const toast of Object.values(toasts)) expect(toast).not.toHaveBeenCalled();
    });
  });
});
