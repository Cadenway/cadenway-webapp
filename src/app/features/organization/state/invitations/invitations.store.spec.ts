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
  InvitationStanding,
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
 * @type {Record<'list' | 'invite' | 'standing' | 'resend' | 'revoke', Mock>}
 */
type ApiFake = Record<'list' | 'invite' | 'standing' | 'resend' | 'revoke', Mock>;

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
 * Constant NOT_FOUND
 *
 * @description
 * `404 invitation.not-found`, as `getInvitation` answers an invitation the organization does not
 * hold.
 *
 * @type {HttpErrorResponse}
 */
const NOT_FOUND: HttpErrorResponse = refusal(404, { code: 'invitation.not-found' });

/**
 * Function standing
 *
 * @description
 * An invitation as `getInvitation` answers it, mapped by the data access.
 *
 * @param {InvitationStanding['status']} status - Its lifecycle state.
 * @param {PendingInvitation} invitation - The invitation.
 * @returns {InvitationStanding} The answer.
 */
function standing(
  status: InvitationStanding['status'],
  invitation: PendingInvitation,
): InvitationStanding {
  return { status, invitation };
}

/**
 * Function keysOf
 *
 * @description
 * The `Idempotency-Key` of each batch the fake data access was asked to send.
 *
 * @param {Mock} invite - The fake `invite`.
 * @returns {string[]} The keys, in call order.
 */
function keysOf(invite: Mock): string[] {
  return invite.mock.calls.map((call: unknown[]): string => call[2] as string);
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
    invite: vi.fn(() => Promise.resolve({ invited: 2, skipped: 0, notSent: [], unknown: [] })),
    standing: vi.fn().mockRejectedValue(NOT_FOUND),
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
      invite: vi.fn(() => Promise.resolve({ invited: 2, skipped: 1, notSent: [], unknown: [] })),
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

        await expect(store.invite(emails, 'member')).resolves.toEqual({
          kept: emails,
          uncertain: true,
        });
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
          .mockResolvedValueOnce({ invited: 1, skipped: 1, notSent: [], unknown: [] }),
      });
      const emails: readonly string[] = ['lucie@example.com', 'paul@example.com'];

      await expect(store.invite(emails, 'admin')).resolves.toEqual({
        kept: emails,
        uncertain: true,
      });
      await expect(store.invite(emails, 'admin')).resolves.toBe('sent');

      expect(api.invite).toHaveBeenNthCalledWith(2, emails, 'admin', keysOf(api.invite)[0]);
      expect(toasts.success).toHaveBeenCalledWith('1 invitation sent', {
        description: 'They expire in 7 days. 1 address skipped: already a member or invited.',
      });
      expect(toasts.error).not.toHaveBeenCalled();
    });
  });

  describe('the Idempotency-Key of a batch', () => {
    const emails: readonly string[] = ['lucie@example.com', 'paul@example.com'];

    it('is sent with each batch', async () => {
      const { store, api }: Harness = await setup({});

      await expect(store.invite(emails, 'member')).resolves.toBe('sent');

      expect(api.invite).toHaveBeenCalledWith(emails, 'member', expect.any(String));
      expect(keysOf(api.invite)[0]).toMatch(/^[0-9a-f-]{36}$/u);
    });

    const unknown: readonly [string, unknown][] = [
      ['no answer', new HttpErrorResponse({ status: 0 })],
      ['an answer the client could not read', new HttpErrorResponse({ status: 200 })],
      ['a timeout', refusal(408, { code: 'request.timeout' })],
      ['a server failure', refusal(500, {})],
      [
        'a release that cannot replay keyed batches yet',
        refusal(503, {
          code: 'upstream.unavailable',
          details: { service: 'organization-service' },
        }),
      ],
      [
        'the same request still in progress',
        refusal(409, { code: 'idempotency.request-in-progress' }),
      ],
    ];

    for (const [name, error] of unknown) {
      it(`is sent again with the same body after ${name}`, async () => {
        const { store, api, toasts }: Harness = await setup({
          invite: vi
            .fn()
            .mockRejectedValueOnce(error)
            .mockResolvedValueOnce({ invited: 2, skipped: 0, notSent: [], unknown: [] }),
        });

        await expect(store.invite(emails, 'member')).resolves.toEqual({
          kept: emails,
          uncertain: true,
        });
        await expect(store.invite(emails, 'member')).resolves.toBe('sent');

        const [first, second]: string[] = keysOf(api.invite);
        expect(second).toBe(first);
        expect(toasts.error).not.toHaveBeenCalled();
      });
    }

    it('is sent again after a 429, which stores nothing', async () => {
      const { store, api, toasts }: Harness = await setup({
        invite: vi
          .fn()
          .mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }))
          .mockRejectedValueOnce(refusal(429, { code: 'rate.limited' }))
          .mockResolvedValueOnce({ invited: 2, skipped: 0, notSent: [], unknown: [] }),
      });

      await store.invite(emails, 'member');
      await expect(store.invite(emails, 'member')).resolves.toBe('failed');
      await expect(store.invite(emails, 'member')).resolves.toBe('sent');

      expect(new Set(keysOf(api.invite)).size).toBe(1);
      expect(toasts.error).toHaveBeenCalledWith('The invitations could not be sent', {});
    });

    it('is renewed when the addresses or the role change', async () => {
      const { store, api }: Harness = await setup({
        invite: vi.fn().mockRejectedValue(refusal(503, {})),
      });

      await store.invite(emails, 'member');
      await store.invite(['lucie@example.com'], 'member');
      await store.invite(['lucie@example.com'], 'guest');
      await store.invite(['lucie@example.com'], 'guest');

      const [first, edited, role, again]: string[] = keysOf(api.invite);
      expect(edited).not.toBe(first);
      expect(role).not.toBe(edited);
      expect(again).toBe(role);
    });

    it('is renewed after a definite answer', async () => {
      const { store, api }: Harness = await setup({
        invite: vi
          .fn()
          .mockResolvedValueOnce({ invited: 0, skipped: 0, notSent: [], unknown: emails })
          .mockRejectedValueOnce(refusal(403, { code: 'organization.role-forbidden' }))
          .mockRejectedValueOnce(refusal(503, {})),
      });

      await expect(store.invite(emails, 'member')).resolves.toEqual({
        kept: emails,
        uncertain: true,
      });
      await expect(store.invite(emails, 'member')).resolves.toBe('failed');
      await store.invite(emails, 'member');

      expect(new Set(keysOf(api.invite)).size).toBe(3);
    });

    it('reused with another body warns of an unknown outcome and is renewed', async () => {
      const { store, api, toasts }: Harness = await setup({
        invite: vi
          .fn()
          .mockRejectedValueOnce(refusal(422, { code: 'idempotency.key-reused' }))
          .mockResolvedValueOnce({ invited: 2, skipped: 0, notSent: [], unknown: [] }),
      });

      await expect(store.invite(emails, 'member')).resolves.toEqual({
        kept: emails,
        uncertain: true,
      });
      await stable();

      expect(toasts.error).not.toHaveBeenCalled();
      expect(toasts.warning).toHaveBeenCalledWith('The invitations may not have been sent', {
        description: 'Sending again is safe.',
      });
      expect(api.list).toHaveBeenCalledTimes(2);

      await expect(store.invite(emails, 'member')).resolves.toBe('sent');
      const [first, second]: string[] = keysOf(api.invite);
      expect(second).not.toBe(first);
    });

    it('is renewed in the next organization', async () => {
      const { store, api, pin }: Harness = await setup({
        invite: vi.fn().mockRejectedValue(refusal(503, {})),
      });

      await store.invite(emails, 'member');
      pin.set('o2');
      pin.set(ATELIER_NORD.id);
      await store.invite(emails, 'member');

      const [first, second]: string[] = keysOf(api.invite);
      expect(second).not.toBe(first);
    });
  });

  it('keeps the addresses a batch did not send, after the invited ones', async () => {
    const { store, toasts }: Harness = await setup({
      invite: vi.fn(() =>
        Promise.resolve({ invited: 1, skipped: 1, notSent: ['Paul@Example.com'], unknown: [] }),
      ),
    });

    await expect(
      store.invite(['lucie@example.com', 'marc.roux@ateliernord.fr', 'paul@example.com'], 'member'),
    ).resolves.toEqual({ kept: ['paul@example.com'], uncertain: false });

    expect(toasts.success).toHaveBeenCalledWith('1 invitation sent', {
      description: 'They expire in 7 days. 1 address skipped: already a member or invited.',
    });
    expect(toasts.error).toHaveBeenCalledWith('1 address could not be invited', {
      description: 'The addresses stay in the list: press Invite to try again.',
    });
  });

  it('keeps an address the answer left out as of unknown outcome', async () => {
    const { store, toasts }: Harness = await setup({
      invite: vi.fn(() =>
        Promise.resolve({ invited: 1, skipped: 0, notSent: [], unknown: ['paul@example.com'] }),
      ),
    });

    await expect(store.invite(['lucie@example.com', 'paul@example.com'], 'admin')).resolves.toEqual(
      { kept: ['paul@example.com'], uncertain: true },
    );

    expect(toasts.success).toHaveBeenCalledWith('1 invitation sent', {
      description: 'They expire in 7 days.',
    });
    expect(toasts.error).not.toHaveBeenCalled();
    expect(toasts.warning).toHaveBeenCalledWith('The invitations may not have been sent', {
      description: 'Sending again is safe.',
    });
  });

  it('counts the skipped addresses in the summary when none was invited', async () => {
    const { store, toasts }: Harness = await setup({
      invite: vi.fn(() =>
        Promise.resolve({
          invited: 0,
          skipped: 1,
          notSent: ['lucie@example.com', 'paul@example.com'],
          unknown: [],
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
      api.invite.mockResolvedValue({ invited: 1, skipped: 0, notSent: [], unknown: [] });
      switchAwayAndBack(harness);
      answer({ invited: 1, skipped: 0, notSent: [], unknown: [] });

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
      description:
        'The pending invitations and the members show where the invitation to atelier@nordstudio.fr stands.',
    });
    expect(toasts.warning).toHaveBeenCalledWith('The invitation may not have been cancelled', {
      description:
        'The pending invitations and the members show where the invitation to marc.roux@ateliernord.fr stands.',
    });
    expect(api.resend).toHaveBeenCalledTimes(1);
    expect(api.revoke).toHaveBeenCalledTimes(4);
    expect(api.standing.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      'i3',
      'i3',
      'i3',
      'i1',
    ]);
    expect(api.list).toHaveBeenCalledTimes(3);
  });

  it('restores a resend dropped for another session organization, silently', async () => {
    const { store, toasts }: Harness = await setup({
      resend: vi.fn().mockRejectedValue(refusal(412, { code: 'organization.context-changed' })),
    });

    await expect(store.resend(STUDIO)).resolves.toBe(false);

    expect(store.items()[1]).toEqual(STUDIO);
    for (const toast of Object.values(toasts)) expect(toast).not.toHaveBeenCalled();
  });

  it('says a mixed batch left one address unsent and others of unknown outcome', async () => {
    const { store, toasts }: Harness = await setup({
      invite: vi.fn(() =>
        Promise.resolve({
          invited: 0,
          skipped: 0,
          notSent: ['lucie@example.com'],
          unknown: ['paul@example.com'],
        }),
      ),
    });

    await expect(
      store.invite(['lucie@example.com', 'paul@example.com'], 'member'),
    ).resolves.toEqual({ kept: ['lucie@example.com', 'paul@example.com'], uncertain: true });

    expect(toasts.error).toHaveBeenCalledTimes(1);
    expect(toasts.error).toHaveBeenCalledWith('1 address could not be invited', {
      description:
        'Some may already have been sent: sending again is safe. The addresses stay in the list: press Invite to try again.',
    });
  });

  describe('an invite answered once the page is gone', () => {
    /**
     * Function pendingInvite
     *
     * @description
     * Starts an invite whose answer waits.
     *
     * @param {Harness} harness - The store and its fakes.
     * @returns {[Promise<InviteResult>, (outcome: unknown) => void, (error: unknown) => void]} The
     * invite, and how to answer or refuse it.
     */
    function pendingInvite(
      harness: Harness,
    ): [Promise<InviteResult>, (outcome: unknown) => void, (error: unknown) => void] {
      let answer: (outcome: unknown) => void = () => undefined;
      let refuse: (error: unknown) => void = () => undefined;
      harness.api.invite.mockImplementation(
        () =>
          new Promise<unknown>(
            (resolve: (outcome: unknown) => void, reject: (error: unknown) => void) => {
              answer = resolve;
              refuse = reject;
            },
          ),
      );
      const done: Promise<InviteResult> = harness.store.invite(
        ['lucie@example.com', 'paul@example.com'],
        'member',
      );
      return [
        done,
        (outcome: unknown) => {
          answer(outcome);
        },
        (error: unknown) => {
          refuse(error);
        },
      ];
    }

    it('still says what it did, without touching the state', async () => {
      const harness: Harness = await setup({});
      const [done, answer]: [
        Promise<InviteResult>,
        (outcome: unknown) => void,
        (error: unknown) => void,
      ] = pendingInvite(harness);
      expect(harness.store.inviting()).toBe(true);

      TestBed.resetTestingModule();
      answer({ invited: 1, skipped: 0, notSent: ['paul@example.com'], unknown: [] });
      await done;

      expect(harness.store.inviting()).toBe(true);
      expect(harness.toasts.success).toHaveBeenCalledWith('1 invitation sent', {
        description: 'They expire in 7 days.',
      });
      expect(harness.toasts.error).toHaveBeenCalledWith('1 address could not be invited', {
        description: 'Invite them again from the Members page.',
      });
    });

    it('counts the addresses of unknown outcome, without touching the state', async () => {
      const harness: Harness = await setup({});
      const [done, , refuse]: [
        Promise<InviteResult>,
        (outcome: unknown) => void,
        (error: unknown) => void,
      ] = pendingInvite(harness);

      TestBed.resetTestingModule();
      refuse(refusal(503, {}));
      await done;

      expect(harness.store.inviting()).toBe(true);
      expect(harness.toasts.error).not.toHaveBeenCalled();
      expect(harness.toasts.warning).toHaveBeenCalledWith('2 addresses may not have been invited', {
        description: 'Sending them again from the Members page is safe.',
      });
    });

    it('says nothing once the organization changed too', async () => {
      const harness: Harness = await setup({});
      const [done, answer]: [
        Promise<InviteResult>,
        (outcome: unknown) => void,
        (error: unknown) => void,
      ] = pendingInvite(harness);

      harness.pin.set('o2');
      TestBed.resetTestingModule();
      answer({ invited: 2, skipped: 0, notSent: [], unknown: [] });

      await expect(done).resolves.toBe('dropped');
      for (const toast of Object.values(harness.toasts)) expect(toast).not.toHaveBeenCalled();
    });
  });

  describe('a write whose page is gone before it is answered', () => {
    it('says nothing of a cancellation retry answered after the page is gone', async () => {
      let answer: () => void = () => undefined;
      const { store, api, toasts }: Harness = await setup({
        revoke: vi
          .fn()
          .mockRejectedValueOnce(refusal(503, {}))
          .mockImplementationOnce(
            () =>
              new Promise<void>((resolve: () => void) => {
                answer = resolve;
              }),
          ),
      });

      const done: Promise<boolean> = store.revoke(MARC);
      await vi.waitFor(() => {
        expect(api.revoke).toHaveBeenCalledTimes(2);
      });
      TestBed.resetTestingModule();
      answer();

      await expect(done).resolves.toBe(false);
      for (const toast of Object.values(toasts)) expect(toast).not.toHaveBeenCalled();
    });

    it('says nothing of a refused cancellation retry answered after the page is gone', async () => {
      let refuse: (error: unknown) => void = () => undefined;
      const { store, api, toasts }: Harness = await setup({
        revoke: vi
          .fn()
          .mockRejectedValueOnce(refusal(503, {}))
          .mockImplementationOnce(
            () =>
              new Promise<void>((_resolve: () => void, reject: (error: unknown) => void) => {
                refuse = reject;
              }),
          ),
      });

      const done: Promise<boolean> = store.revoke(MARC);
      await vi.waitFor(() => {
        expect(api.revoke).toHaveBeenCalledTimes(2);
      });
      TestBed.resetTestingModule();
      refuse(refusal(403, { code: 'organization.role-forbidden' }));

      await expect(done).resolves.toBe(false);
      for (const toast of Object.values(toasts)) expect(toast).not.toHaveBeenCalled();
    });

    it('says nothing of a resend answered after the page is gone', async () => {
      let answer: (invitation: PendingInvitation) => void = () => undefined;
      const { store, toasts }: Harness = await setup({
        resend: vi.fn(
          () =>
            new Promise<PendingInvitation>((resolve: (invitation: PendingInvitation) => void) => {
              answer = resolve;
            }),
        ),
      });

      const done: Promise<boolean> = store.resend(STUDIO);
      TestBed.resetTestingModule();
      answer({ ...STUDIO, expired: false });

      await expect(done).resolves.toBe(false);
      for (const toast of Object.values(toasts)) expect(toast).not.toHaveBeenCalled();
    });
  });

  describe('the reads settling a resend', () => {
    /**
     * Function pendingSettlement
     *
     * @description
     * Starts a resend or a cancellation of unknown outcome whose first settling read of the
     * invitation waits, rejecting once its signal aborts as the data access does.
     *
     * @param {Harness} harness - The store and its fakes.
     * @param {'resend' | 'revoke'} [write] - The write settled.
     * @returns {Promise<[Promise<boolean>, AbortSignal]>} The write and the signal of its read.
     */
    async function pendingSettlement(
      harness: Harness,
      write: 'resend' | 'revoke' = 'resend',
    ): Promise<[Promise<boolean>, AbortSignal]> {
      const signals: AbortSignal[] = [];
      harness.api.standing.mockImplementation(
        (_id: string, signal: AbortSignal) =>
          new Promise<InvitationStanding>(
            (_resolve: (answer: InvitationStanding) => void, reject: (error: Error) => void) => {
              signals.push(signal);
              signal.addEventListener('abort', () => {
                reject(new Error('aborted'));
              });
            },
          ),
      );
      const done: Promise<boolean> =
        write === 'resend' ? harness.store.resend(STUDIO) : harness.store.revoke(MARC);
      await vi.waitFor(() => {
        expect(signals).toHaveLength(1);
      });
      return [done, signals[0]];
    }

    it('aborts the read once another organization is committed', async () => {
      const harness: Harness = await setup({
        resend: vi.fn().mockRejectedValue(refusal(503, {})),
      });
      const [done, signal]: [Promise<boolean>, AbortSignal] = await pendingSettlement(harness);
      expect(signal.aborted).toBe(false);

      harness.pin.set('o2');

      expect(signal.aborted).toBe(true);
      await expect(done).resolves.toBe(false);
      for (const toast of Object.values(harness.toasts)) expect(toast).not.toHaveBeenCalled();
    });

    it('claims nothing of a cancellation once another organization is committed during its read', async () => {
      const harness: Harness = await setup({
        revoke: vi.fn().mockRejectedValue(refusal(503, {})),
      });
      const [done, signal]: [Promise<boolean>, AbortSignal] = await pendingSettlement(
        harness,
        'revoke',
      );

      harness.pin.set('o2');
      harness.pin.set(ATELIER_NORD.id);

      expect(signal.aborted).toBe(true);
      await expect(done).resolves.toBe(false);
      expect(harness.api.standing).toHaveBeenCalledTimes(1);
      for (const toast of Object.values(harness.toasts)) expect(toast).not.toHaveBeenCalled();
    });

    it('aborts the read once the page is gone', async () => {
      const harness: Harness = await setup({
        resend: vi.fn().mockRejectedValue(refusal(503, {})),
      });
      const [done, signal]: [Promise<boolean>, AbortSignal] = await pendingSettlement(harness);

      TestBed.resetTestingModule();

      expect(signal.aborted).toBe(true);
      await expect(done).resolves.toBe(false);
      for (const toast of Object.values(harness.toasts)) expect(toast).not.toHaveBeenCalled();
    });
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

    it('reads the invitation until it shows the resend, never resending', async () => {
      const resentStudio: PendingInvitation = {
        ...STUDIO,
        expired: false,
        expiresAt: '2026-12-05T10:00:00Z',
      };
      const { store, api, toasts }: Harness = await setup({
        resend: vi.fn().mockRejectedValue(refusal(504, {})),
      });
      api.standing
        .mockResolvedValueOnce(standing('expired', STUDIO))
        .mockResolvedValue(standing('pending', resentStudio));

      const done: Promise<boolean> = store.resend(STUDIO);
      expect(store.pendingIds().has('i3')).toBe(true);
      await expect(done).resolves.toBe(true);
      await stable();

      expect(api.resend).toHaveBeenCalledTimes(1);
      expect(api.standing).toHaveBeenCalledTimes(2);
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
        standing: vi.fn(() => Promise.resolve(standing('expired', STUDIO))),
      });

      await expect(store.resend(STUDIO)).resolves.toBe(false);
      expect(toasts.warning).toHaveBeenCalledWith('The invitation may not have been resent', {
        description:
          'The pending invitations and the members show where the invitation to atelier@nordstudio.fr stands.',
      });
      await expect(store.resend(STUDIO)).resolves.toBe(false);
      await stable();

      expect(toasts.success).not.toHaveBeenCalled();
      expect(toasts.error).not.toHaveBeenCalled();
      expect(toasts.warning).toHaveBeenLastCalledWith('The invitation may not have been resent', {
        description:
          'The invitation was sent less than an hour ago, so it cannot be resent yet: try again later.',
      });
      expect(store.items()[1]).toEqual(STUDIO);
    });

    it('takes a throttle after an unknown resend as resent once the invitation shows it', async () => {
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
      api.standing.mockResolvedValue(standing('pending', resentStudio));
      api.list.mockResolvedValue({ items: [MARC, resentStudio], total: 2 });
      await expect(store.resend(STUDIO)).resolves.toBe(true);
      await stable();

      expect(toasts.success).toHaveBeenCalledWith('Invitation resent', {
        description: 'atelier@nordstudio.fr',
      });
      expect(store.items()[1]).toEqual(resentStudio);
    });

    it('claims nothing from an invitation a read misses after an unknown cancellation', async () => {
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
      expect(toasts.info).not.toHaveBeenCalled();
      expect(toasts.warning).toHaveBeenCalledWith('The invitation may not have been cancelled', {
        description:
          'The pending invitations and the members show where the invitation to marc.roux@ateliernord.fr stands.',
      });
      expect(membersStore.retry).toHaveBeenCalledTimes(1);
      expect(subscription.retry).toHaveBeenCalledTimes(1);
    });

    it('claims nothing from an invitation a read misses after an unknown resend', async () => {
      const { store, api, toasts, membersStore }: Harness = await setup({
        resend: vi.fn().mockRejectedValue(refusal(503, {})),
      });
      api.list.mockResolvedValue({ items: [MARC], total: 1 });

      await expect(store.resend(STUDIO)).resolves.toBe(false);

      expect(api.resend).toHaveBeenCalledTimes(1);
      expect(toasts.success).not.toHaveBeenCalled();
      expect(toasts.info).not.toHaveBeenCalled();
      expect(toasts.warning).toHaveBeenCalledWith('The invitation may not have been resent', {
        description:
          'The pending invitations and the members show where the invitation to atelier@nordstudio.fr stands.',
      });
      expect(membersStore.retry).toHaveBeenCalledTimes(1);
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
      const { store, api, toasts, membersStore }: Harness = await setup({
        revoke: vi
          .fn()
          .mockRejectedValue(
            refusal(409, { code: 'invitation.answered', details: { status: 'accepted' } }),
          ),
      });
      api.list.mockResolvedValue({ items: [STUDIO], total: 1 });

      await expect(store.revoke(MARC)).resolves.toBe(false);
      await stable();

      expect(api.list).toHaveBeenCalledTimes(2);

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
        description:
          'The pending invitations and the members show where the invitation to marc.roux@ateliernord.fr stands.',
      });
    });

    describe('a cancellation every attempt left unknown, read once', () => {
      it('is confirmed when the invitation reads revoked', async () => {
        const { store, api, toasts }: Harness = await setup({
          revoke: vi.fn().mockRejectedValue(refusal(503, {})),
          standing: vi.fn(() => Promise.resolve(standing('revoked', MARC))),
        });

        await expect(store.revoke(MARC)).resolves.toBe(true);
        await stable();

        expect(api.revoke).toHaveBeenCalledTimes(4);
        expect(api.standing).toHaveBeenCalledTimes(1);
        expect(api.standing).toHaveBeenCalledWith('i1', expect.any(AbortSignal));
        expect(store.items()).toEqual([STUDIO]);
        expect(store.total()).toBe(1);
        expect(toasts.success).toHaveBeenCalledWith('Invitation cancelled', {
          description: 'marc.roux@ateliernord.fr',
        });
        expect(toasts.warning).not.toHaveBeenCalled();
      });

      it('says the invitee accepted when the invitation reads accepted', async () => {
        const { store, api, toasts, membersStore }: Harness = await setup({
          revoke: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 0 })),
          standing: vi.fn(() => Promise.resolve(standing('accepted', MARC))),
        });
        api.list.mockResolvedValue({ items: [STUDIO], total: 1 });

        await expect(store.revoke(MARC)).resolves.toBe(false);
        await stable();

        expect(store.items()).toEqual([STUDIO]);
        expect(toasts.info).toHaveBeenCalledWith(
          'The invitation was accepted before it could be cancelled',
          { description: 'marc.roux@ateliernord.fr is now a member of the organization.' },
        );
        expect(membersStore.retry).toHaveBeenCalledTimes(1);
        expect(toasts.warning).not.toHaveBeenCalled();
      });

      it('says the invitee declined when the invitation reads refused', async () => {
        const { store, toasts }: Harness = await setup({
          revoke: vi.fn().mockRejectedValue(refusal(504, {})),
          standing: vi.fn(() => Promise.resolve(standing('refused', MARC))),
        });

        await expect(store.revoke(MARC)).resolves.toBe(false);

        expect(toasts.info).toHaveBeenCalledWith(
          'The invitation was declined before it could be cancelled',
          { description: 'marc.roux@ateliernord.fr' },
        );
        expect(toasts.warning).not.toHaveBeenCalled();
      });

      const unsettling: readonly [string, () => Mock][] = [
        ['still pending', () => vi.fn().mockResolvedValue(standing('pending', MARC))],
        ['expired', () => vi.fn().mockResolvedValue(standing('expired', MARC))],
        [
          'in a state this version does not know',
          () => vi.fn().mockResolvedValue(standing('other', MARC)),
        ],
        ['not found', () => vi.fn().mockRejectedValue(NOT_FOUND)],
        ['unreadable', () => vi.fn().mockRejectedValue(refusal(503, {}))],
      ];

      for (const [name, read] of unsettling) {
        it(`claims nothing when the invitation reads ${name}`, async () => {
          const { store, api, toasts }: Harness = await setup({
            revoke: vi.fn().mockRejectedValue(refusal(503, {})),
            standing: read(),
          });

          await expect(store.revoke(MARC)).resolves.toBe(false);
          await stable();

          expect(api.standing).toHaveBeenCalledTimes(1);
          expect(store.items()).toEqual([MARC, STUDIO]);
          expect(toasts.success).not.toHaveBeenCalled();
          expect(toasts.info).not.toHaveBeenCalled();
          expect(toasts.error).not.toHaveBeenCalled();
          expect(toasts.warning).toHaveBeenCalledWith(
            'The invitation may not have been cancelled',
            {
              description:
                'The pending invitations and the members show where the invitation to marc.roux@ateliernord.fr stands.',
            },
          );
        });
      }

      it('reads it after a refusal that follows an unknown attempt', async () => {
        const { store, api, toasts }: Harness = await setup({
          revoke: vi
            .fn()
            .mockRejectedValueOnce(refusal(503, {}))
            .mockRejectedValueOnce(refusal(403, { code: 'organization.role-forbidden' })),
          standing: vi.fn(() => Promise.resolve(standing('revoked', MARC))),
        });

        await expect(store.revoke(MARC)).resolves.toBe(true);

        expect(api.revoke).toHaveBeenCalledTimes(2);
        expect(api.standing).toHaveBeenCalledTimes(1);
        expect(toasts.success).toHaveBeenCalledWith('Invitation cancelled', {
          description: 'marc.roux@ateliernord.fr',
        });
        expect(toasts.error).not.toHaveBeenCalled();
      });

      it('is never read after a definite refusal of the first attempt', async () => {
        const { store, api, toasts }: Harness = await setup({
          revoke: vi.fn().mockRejectedValue(refusal(403, { code: 'organization.role-forbidden' })),
        });

        await expect(store.revoke(MARC)).resolves.toBe(false);

        expect(api.standing).not.toHaveBeenCalled();
        expect(toasts.error).toHaveBeenCalledWith('The invitation could not be cancelled');
      });
    });

    describe('a resend of unknown outcome, read on its own', () => {
      it('proves nothing while the invitation stays pending with the same expiry', async () => {
        const { store, api, toasts }: Harness = await setup({
          resend: vi.fn().mockRejectedValue(refusal(503, {})),
          standing: vi.fn(() => Promise.resolve(standing('pending', MARC))),
        });

        await expect(store.resend(MARC)).resolves.toBe(false);
        await stable();

        expect(api.resend).toHaveBeenCalledTimes(1);
        expect(api.standing).toHaveBeenCalledTimes(3);
        expect(store.items()[0]).toEqual(MARC);
        expect(toasts.success).not.toHaveBeenCalled();
        expect(toasts.warning).toHaveBeenCalledWith('The invitation may not have been resent', {
          description:
            'The pending invitations and the members show where the invitation to marc.roux@ateliernord.fr stands.',
        });
      });

      it('drops an invitation that reads revoked, as no longer pending', async () => {
        const { store, toasts, membersStore }: Harness = await setup({
          resend: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 0 })),
          standing: vi.fn(() => Promise.resolve(standing('revoked', STUDIO))),
        });

        await expect(store.resend(STUDIO)).resolves.toBe(false);

        expect(store.items()).toEqual([MARC]);
        expect(store.pendingIds().size).toBe(0);
        expect(toasts.success).not.toHaveBeenCalled();
        expect(toasts.warning).not.toHaveBeenCalled();
        expect(toasts.info).toHaveBeenCalledWith('This invitation is no longer pending', {
          description: 'atelier@nordstudio.fr',
        });
        expect(membersStore.retry).not.toHaveBeenCalled();
      });

      it('reads the members again when the invitation reads accepted', async () => {
        const { store, toasts, membersStore }: Harness = await setup({
          resend: vi.fn().mockRejectedValue(refusal(502, {})),
          standing: vi.fn(() => Promise.resolve(standing('accepted', STUDIO))),
        });

        await expect(store.resend(STUDIO)).resolves.toBe(false);

        expect(store.items()).toEqual([MARC]);
        expect(toasts.info).toHaveBeenCalledWith('This invitation is no longer pending', {
          description: 'atelier@nordstudio.fr',
        });
        expect(membersStore.retry).toHaveBeenCalledTimes(1);
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
