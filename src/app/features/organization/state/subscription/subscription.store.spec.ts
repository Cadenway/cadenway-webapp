import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, type Mock, vi } from 'vitest';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
  type WorkspaceOrganization,
  type WorkspaceRole,
} from '@features/workspace/ports/workspace-context';

import { BillingApi } from '../../data-access/services/billing-api/billing-api.service';
import type { OrganizationSubscription } from '../../models/organization-subscription/organization-subscription.interface';
import { SubscriptionStore } from './subscription.store';

/**
 * Constant workspace
 *
 * @description
 * Atelier Nord, whose owner is signed in.
 *
 * @type {WorkspaceContextPort}
 */
const workspace: WorkspaceContextPort = {
  user: signal({
    id: 'u1',
    name: 'Camille Martin',
    firstName: 'Camille',
    displayName: null,
    email: 'camille.martin@ateliernord.fr',
    initials: 'CM',
  }),
  organization: signal({
    id: 'o1',
    slug: 'atelier-nord',
    name: 'Atelier Nord',
    initials: 'AN',
    role: 'owner',
    plan: 'team',
  }),
  role: signal('owner'),
  can: () => true,
};

/**
 * Function store
 *
 * @description
 * Creates the store over a subscription and waits for its read.
 *
 * @param {OrganizationSubscription} subscription - What billing answers.
 * @returns {Promise<InstanceType<typeof SubscriptionStore>>} The store after the read.
 */
async function store(
  subscription: OrganizationSubscription,
): Promise<InstanceType<typeof SubscriptionStore>> {
  TestBed.configureTestingModule({
    providers: [
      SubscriptionStore,
      { provide: WORKSPACE_CONTEXT, useValue: workspace },
      { provide: BillingApi, useValue: { subscription: () => Promise.resolve(subscription) } },
    ],
  });
  const instance: InstanceType<typeof SubscriptionStore> = TestBed.inject(SubscriptionStore);
  await TestBed.inject(ApplicationRef).whenStable();
  return instance;
}

describe('SubscriptionStore', () => {
  it.each([
    ['the storage', 18, 25, 92_400_000_000, true],
    ['the seats', 23, 25, 40_000_000_000, true],
    ['neither', 18, 25, 80_000_000_000, false],
  ] as const)(
    'flags a critical quota when %s reaches 90 %%',
    async (_case: string, used: number, limit: number, bytes: number, critical: boolean) => {
      const instance: InstanceType<typeof SubscriptionStore> = await store({
        plan: 'team',
        seatsUsed: used,
        seatsLimit: limit,
        storageUsedBytes: bytes,
        storageLimitBytes: 100_000_000_000,
        guestCount: 4,
      });

      expect(instance.quotaCritical()).toBe(critical);
    },
  );
});

/**
 * Constant TEAM
 *
 * @description
 * The mockup's Team plan: 18 of 25 seats, 92.4 of 100 GB, 4 guests.
 *
 * @type {OrganizationSubscription}
 */
const TEAM: OrganizationSubscription = {
  plan: 'team',
  seatsUsed: 18,
  seatsLimit: 25,
  storageUsedBytes: 92_400_000_000,
  storageLimitBytes: 100_000_000_000,
  guestCount: 4,
};

/**
 * Function storeOver
 *
 * @description
 * Creates the store over a faked Billing read and, unless told otherwise, waits for its first read.
 *
 * @param {Mock<() => Promise<OrganizationSubscription>>} read - Fake of the Billing read.
 * @param {boolean} settled - Whether to wait for the first read to settle.
 * @param {WorkspaceContextPort} port - Workspace the store follows.
 * @returns {Promise<InstanceType<typeof SubscriptionStore>>} The store.
 */
async function storeOver(
  read: Mock<() => Promise<OrganizationSubscription>>,
  settled: boolean = true,
  port: WorkspaceContextPort = workspace,
): Promise<InstanceType<typeof SubscriptionStore>> {
  TestBed.configureTestingModule({
    providers: [
      SubscriptionStore,
      { provide: WORKSPACE_CONTEXT, useValue: port },
      { provide: BillingApi, useValue: { subscription: read } },
    ],
  });
  const instance: InstanceType<typeof SubscriptionStore> = TestBed.inject(SubscriptionStore);
  if (settled) await TestBed.inject(ApplicationRef).whenStable();
  else TestBed.tick();
  return instance;
}

/**
 * Constant FREE
 *
 * @description
 * The Free plan of an organization that has not paid yet: 3 of 5 seats.
 *
 * @type {OrganizationSubscription}
 */
const FREE: OrganizationSubscription = {
  plan: 'free',
  seatsUsed: 3,
  seatsLimit: 5,
  storageUsedBytes: 120_000_000,
  storageLimitBytes: 2_000_000_000,
  guestCount: 1,
};

/**
 * Interface MovableWorkspace
 *
 * @description
 * A workspace port whose organization and role a spec changes.
 */
interface MovableWorkspace {
  // #region Properties
  /**
   * Property port
   *
   * @description
   * The port given to the store.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  readonly port: WorkspaceContextPort;

  /**
   * Property organization
   *
   * @description
   * The workspace organization.
   *
   * @type {WritableSignal<WorkspaceOrganization>}
   * @readonly
   */
  readonly organization: WritableSignal<WorkspaceOrganization>;
  // #endregion
}

/**
 * Function movableWorkspace
 *
 * @description
 * Atelier Nord's owner, in a workspace that can switch to Lumen.
 *
 * @returns {MovableWorkspace} The port and its organization.
 */
function movableWorkspace(): MovableWorkspace {
  const organization: WritableSignal<WorkspaceOrganization> = signal(workspace.organization());
  const role: WritableSignal<WorkspaceRole> = signal<WorkspaceRole>('owner');
  return {
    port: { ...workspace, organization, role, can: () => role() === 'owner' },
    organization,
  };
}

/**
 * Function deferred
 *
 * @description
 * A Billing answer the spec settles when it chooses.
 *
 * @returns {{ promise: Promise<OrganizationSubscription>; resolve: (value: OrganizationSubscription) => void }} The answer and its resolver.
 */
function deferred(): {
  promise: Promise<OrganizationSubscription>;
  resolve: (value: OrganizationSubscription) => void;
} {
  let resolve: (value: OrganizationSubscription) => void = () => undefined;
  const promise: Promise<OrganizationSubscription> = new Promise<OrganizationSubscription>(
    (done: (value: OrganizationSubscription) => void) => {
      resolve = done;
    },
  );
  return { promise, resolve };
}

describe('SubscriptionStore.refresh', () => {
  it('drops a refresh answer once a newer subscription was set meanwhile', async () => {
    const late: ReturnType<typeof deferred> = deferred();
    const read: Mock<() => Promise<OrganizationSubscription>> = vi
      .fn<() => Promise<OrganizationSubscription>>()
      .mockResolvedValueOnce(FREE)
      .mockReturnValueOnce(late.promise);
    const instance: InstanceType<typeof SubscriptionStore> = await storeOver(read);

    const refreshed: Promise<boolean> = instance.refresh();
    instance.subscription.set({ ...FREE, plan: 'team', seatsLimit: 25 });
    late.resolve(FREE);

    expect(await refreshed).toBe(false);
    expect(instance.current()?.plan).toBe('team');
    expect(instance.refreshFailed()).toBe(false);
  });

  it('drops a refresh answer once a retry read the subscription again meanwhile', async () => {
    const late: ReturnType<typeof deferred> = deferred();
    const read: Mock<() => Promise<OrganizationSubscription>> = vi
      .fn<() => Promise<OrganizationSubscription>>()
      .mockResolvedValueOnce(TEAM)
      .mockReturnValueOnce(late.promise)
      .mockResolvedValueOnce({ ...TEAM, seatsUsed: 21 });
    const instance: InstanceType<typeof SubscriptionStore> = await storeOver(read);

    const refreshed: Promise<boolean> = instance.refresh();
    instance.retry();
    await TestBed.inject(ApplicationRef).whenStable();
    late.resolve({ ...TEAM, seatsUsed: 19 });

    expect(await refreshed).toBe(false);
    expect(instance.current()?.seatsUsed).toBe(21);
  });

  it('shares a refresh under way only with the same organization', async () => {
    const lumen: OrganizationSubscription = { ...TEAM, seatsUsed: 9 };
    const late: ReturnType<typeof deferred> = deferred();
    const read: Mock<() => Promise<OrganizationSubscription>> = vi
      .fn<() => Promise<OrganizationSubscription>>()
      .mockResolvedValueOnce(TEAM)
      .mockReturnValueOnce(late.promise)
      .mockResolvedValueOnce(lumen)
      .mockResolvedValueOnce({ ...lumen, seatsUsed: 10 });
    const moving: MovableWorkspace = movableWorkspace();
    const instance: InstanceType<typeof SubscriptionStore> = await storeOver(
      read,
      true,
      moving.port,
    );

    const first: Promise<boolean> = instance.refresh();
    moving.organization.set({ ...moving.organization(), id: 'o2', slug: 'lumen', name: 'Lumen' });
    await TestBed.inject(ApplicationRef).whenStable();
    expect(instance.current()?.seatsUsed).toBe(9);

    const second: Promise<boolean> = instance.refresh();
    expect(second).not.toBe(first);
    expect(await second).toBe(true);
    late.resolve(TEAM);

    expect(await first).toBe(false);
    expect(read).toHaveBeenCalledTimes(4);
    expect(instance.current()?.seatsUsed).toBe(10);
  });

  it('clears the figures of an owner whose refresh is refused with a 403', async () => {
    const read: Mock<() => Promise<OrganizationSubscription>> = vi
      .fn<() => Promise<OrganizationSubscription>>()
      .mockResolvedValueOnce(TEAM)
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 403 }))
      .mockResolvedValue(TEAM);
    const instance: InstanceType<typeof SubscriptionStore> = await storeOver(read);
    expect(instance.quotaCritical()).toBe(true);

    expect(await instance.refresh()).toBe(false);

    expect(instance.current()).toBeNull();
    expect(instance.failed()).toBe(false);
    expect(instance.refreshFailed()).toBe(false);
    expect(instance.quotaCritical()).toBe(false);
    expect(instance.storageNearlyFull()).toBe(false);

    instance.retry();
    await TestBed.inject(ApplicationRef).whenStable();
    expect(instance.current()).toEqual(TEAM);
  });

  it('reads again and shows the answer, keeping the figures shown meanwhile', async () => {
    let answer: (value: OrganizationSubscription) => void = () => undefined;
    const read: Mock<() => Promise<OrganizationSubscription>> = vi
      .fn<() => Promise<OrganizationSubscription>>()
      .mockResolvedValueOnce(TEAM)
      .mockImplementationOnce(
        () =>
          new Promise<OrganizationSubscription>((resolve) => {
            answer = resolve;
          }),
      );
    const instance: InstanceType<typeof SubscriptionStore> = await storeOver(read);

    const refreshed: Promise<boolean> = instance.refresh();
    expect(instance.refreshing()).toBe(true);
    expect(instance.current()).toEqual(TEAM);
    expect(instance.refresh()).toBe(refreshed);
    answer({ ...TEAM, seatsUsed: 20 });

    expect(await refreshed).toBe(true);
    expect(read).toHaveBeenCalledTimes(2);
    expect(instance.current()?.seatsUsed).toBe(20);
    expect(instance.refreshing()).toBe(false);
    expect(instance.refreshFailed()).toBe(false);
  });

  it('keeps the figures shown and flags the failure apart when the refresh fails', async () => {
    const read: Mock<() => Promise<OrganizationSubscription>> = vi
      .fn<() => Promise<OrganizationSubscription>>()
      .mockResolvedValueOnce(TEAM)
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }))
      .mockResolvedValue({ ...TEAM, seatsUsed: 19 });
    const instance: InstanceType<typeof SubscriptionStore> = await storeOver(read);

    expect(await instance.refresh()).toBe(false);
    expect(instance.current()).toEqual(TEAM);
    expect(instance.refreshFailed()).toBe(true);
    expect(instance.failed()).toBe(false);

    expect(await instance.refresh()).toBe(true);
    expect(instance.current()?.seatsUsed).toBe(19);
    expect(instance.refreshFailed()).toBe(false);
  });

  it('flags nothing when billing refuses the refresh with a 403', async () => {
    const read: Mock<() => Promise<OrganizationSubscription>> = vi
      .fn<() => Promise<OrganizationSubscription>>()
      .mockResolvedValueOnce(TEAM)
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 403 }));
    const instance: InstanceType<typeof SubscriptionStore> = await storeOver(read);

    expect(await instance.refresh()).toBe(false);
    expect(instance.refreshFailed()).toBe(false);
  });

  it('sends nothing while the first read is under way', async () => {
    const read: Mock<() => Promise<OrganizationSubscription>> = vi.fn(
      () => new Promise<OrganizationSubscription>(() => undefined),
    );
    const instance: InstanceType<typeof SubscriptionStore> = await storeOver(read, false);

    expect(await instance.refresh()).toBe(false);
    expect(read).toHaveBeenCalledTimes(1);
  });
});
