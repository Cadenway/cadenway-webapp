import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, type Mock, vi } from 'vitest';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
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
 * @returns {Promise<InstanceType<typeof SubscriptionStore>>} The store.
 */
async function storeOver(
  read: Mock<() => Promise<OrganizationSubscription>>,
  settled: boolean = true,
): Promise<InstanceType<typeof SubscriptionStore>> {
  TestBed.configureTestingModule({
    providers: [
      SubscriptionStore,
      { provide: WORKSPACE_CONTEXT, useValue: workspace },
      { provide: BillingApi, useValue: { subscription: read } },
    ],
  });
  const instance: InstanceType<typeof SubscriptionStore> = TestBed.inject(SubscriptionStore);
  if (settled) await TestBed.inject(ApplicationRef).whenStable();
  else TestBed.tick();
  return instance;
}

describe('SubscriptionStore.refresh', () => {
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
