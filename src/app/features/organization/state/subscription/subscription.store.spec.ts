import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

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
      });

      expect(instance.quotaCritical()).toBe(critical);
    },
  );
});
