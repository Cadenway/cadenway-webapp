import { computed, inject, type Provider } from '@angular/core';
import type { SlotContribution, SlotFeature } from '@shared/layout-slot';

import type { OrganizationSubscription } from '../../models/organization-subscription/organization-subscription.interface';
import type { PlanSeats, PlanSeatsPort } from '../../ports/plan-seats/plan-seats-port.interface';
import { PLAN_SEATS } from '../../ports/plan-seats/plan-seats.token';
import { SubscriptionStore } from '../../state/subscription/subscription.store';

import { PlanSummary } from '../../ui/components/plan-summary/plan-summary.component';
import { StorageBanner } from '../../ui/components/storage-banner/storage-banner.component';

/**
 * Function withPlanSummary
 *
 * @description
 * Contributes the plan and seats line to the shell's `sidebarFooter` slot. Bind it on the `/:org`
 * route, whose injector provides `WORKSPACE_CONTEXT`.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withPlanSummary(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'organization.plan-summary',
      order: 10,
      component: PlanSummary,
    }),
  };
}

/**
 * Function withStorageBanner
 *
 * @description
 * Contributes the `Storage nearly full` banner to the shell's `banners` slot. Bind it on the
 * `/:org` route, whose injector provides `WORKSPACE_CONTEXT`.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withStorageBanner(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'organization.storage-banner',
      order: 0,
      component: StorageBanner,
    }),
  };
}

/**
 * Function provideOrganizationUsage
 *
 * @description
 * Provides the one `SubscriptionStore` the plan line and the storage banner share, and
 * `PLAN_SEATS`, its plan and free seats for other features (Spaces' `Invite your team`
 * suggestion), so the shell reads the subscription once. Give it to the `/:org` route, next to the
 * shell slots, whose injector provides `WORKSPACE_CONTEXT`.
 *
 * @returns {Provider[]} The store and the plan seats port.
 */
export function provideOrganizationUsage(): Provider[] {
  return [
    SubscriptionStore,
    {
      provide: PLAN_SEATS,
      useFactory: (): PlanSeatsPort => {
        const store: InstanceType<typeof SubscriptionStore> = inject(SubscriptionStore);
        return {
          seats: computed((): PlanSeats | null => {
            const subscription: OrganizationSubscription | null = store.current();
            return subscription === null
              ? null
              : {
                  plan: subscription.plan,
                  free: Math.max(0, subscription.seatsLimit - subscription.seatsUsed),
                };
          }),
        };
      },
    },
  ];
}
