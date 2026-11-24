import type { SlotContribution, SlotFeature } from '@shared/layout-slot';

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
 * Contributes the « Stockage presque plein » banner to the shell's `banners` slot. Bind it on the
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
