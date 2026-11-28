import { ApplicationRef, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, type Mock, vi } from 'vitest';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
  type WorkspaceRole,
} from '@features/workspace/ports/workspace-context';

import { BillingApi } from '../../data-access/services/billing-api/billing-api.service';
import type { OrganizationSubscription } from '../../models/organization-subscription/organization-subscription.interface';
import type { PlanSeatsPort } from '../../ports/plan-seats/plan-seats-port.interface';
import { PLAN_SEATS } from '../../ports/plan-seats/plan-seats.token';
import { SubscriptionStore } from '../../state/subscription/subscription.store';
import { provideOrganizationUsage } from './usage.provider';

/**
 * Constant TEAM
 *
 * @description
 * The Team plan of Atelier Nord with 18 of its 25 seats taken.
 *
 * @type {OrganizationSubscription}
 */
const TEAM: OrganizationSubscription = {
  plan: 'team',
  seatsUsed: 18,
  seatsLimit: 25,
  storageUsedBytes: 40_000_000_000,
  storageLimitBytes: 100_000_000_000,
  guestCount: 4,
};

/**
 * Function setup
 *
 * @description
 * Provides the organization usage on a workspace whose caller has the given role.
 *
 * @param {WorkspaceRole} role - The caller's role.
 * @param {OrganizationSubscription} subscription - What the billing read answers.
 * @returns {Mock} The billing read.
 */
function setup(role: WorkspaceRole, subscription: OrganizationSubscription = TEAM): Mock {
  const read: Mock = vi.fn(() => Promise.resolve(subscription));
  const roleValue: WritableSignal<WorkspaceRole> = signal(role);
  const workspace: Pick<WorkspaceContextPort, 'organization' | 'role'> = {
    organization: signal({
      id: 'o1',
      slug: 'atelier-nord',
      name: 'Atelier Nord',
      initials: 'AN',
      role,
      plan: 'team',
    }),
    role: roleValue,
  };
  TestBed.configureTestingModule({
    providers: [
      ...provideOrganizationUsage(),
      { provide: WORKSPACE_CONTEXT, useValue: workspace },
      { provide: BillingApi, useValue: { subscription: read } },
    ],
  });
  return read;
}

describe('provideOrganizationUsage', () => {
  it('gives the plan seats from the one subscription read the shell shares', async () => {
    const read: Mock = setup('owner');
    TestBed.inject(SubscriptionStore);
    const seats: PlanSeatsPort = TestBed.inject(PLAN_SEATS);
    await TestBed.inject(ApplicationRef).whenStable();

    await expect.poll(() => seats.seats()).toEqual({ plan: 'team', free: 7 });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('never counts free seats below zero', async () => {
    setup('owner', { ...TEAM, plan: 'free', seatsUsed: 6, seatsLimit: 5 });
    const seats: PlanSeatsPort = TestBed.inject(PLAN_SEATS);
    await TestBed.inject(ApplicationRef).whenStable();

    await expect.poll(() => seats.seats()).toEqual({ plan: 'free', free: 0 });
  });

  it('stays unknown, without a read, for a caller who is not the owner', async () => {
    const read: Mock = setup('member');
    const seats: PlanSeatsPort = TestBed.inject(PLAN_SEATS);
    await TestBed.inject(ApplicationRef).whenStable();

    expect(seats.seats()).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
});
