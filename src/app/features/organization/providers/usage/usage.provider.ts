import type { Provider } from '@angular/core';
import type { SlotContribution, SlotFeature } from '@shared/layout-slot';

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
 * Provides the one `SubscriptionStore` the plan line and the storage banner share. Give it to the
 * `/:org` route, next to the shell slots, whose injector provides `WORKSPACE_CONTEXT`.
 *
 * @returns {Provider[]} The store.
 */
export function provideOrganizationUsage(): Provider[] {
  return [SubscriptionStore];
}
