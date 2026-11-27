import type { SlotContribution, SlotFeature } from '@shared/layout-slot';

import { GoalsRailItem } from '../../ui/components/goals-rail-item/goals-rail-item.component';

/**
 * Function withGoalsRailItem
 *
 * @description
 * Contributes `Goals` to the shell's `railNavigation` slot (order 50), after
 * `Dashboards`. Bind it on a route below `/:org`, whose injector provides
 * `WORKSPACE_CONTEXT`.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withGoalsRailItem(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'goals.rail-item',
      order: 50,
      component: GoalsRailItem,
    }),
  };
}
