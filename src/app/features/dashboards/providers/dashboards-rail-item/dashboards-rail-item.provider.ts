import type { SlotContribution, SlotFeature } from '@shared/layout-slot';

import { DashboardsRailItem } from '../../ui/components/dashboards-rail-item/dashboards-rail-item.component';

/**
 * Function withDashboardsRailItem
 *
 * @description
 * Contributes `Dashboards` to the shell's `railNavigation` slot (order 40), after
 * `Spaces`. Bind it on a route below `/:org`, whose injector provides
 * `WORKSPACE_CONTEXT`.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withDashboardsRailItem(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'dashboards.rail-item',
      order: 40,
      component: DashboardsRailItem,
    }),
  };
}
