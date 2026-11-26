import type { SlotContribution, SlotFeature } from '@shared/layout-slot';

import { HomeRailItem } from '../../ui/components/home-rail-item/home-rail-item.component';

/**
 * Function withHomeRailItem
 *
 * @description
 * Contributes `Home`, first in the shell's `railNavigation` slot. Bind it on the `/:org`
 * route, whose injector provides `WORKSPACE_CONTEXT`.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withHomeRailItem(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'home.rail-item',
      order: 0,
      component: HomeRailItem,
    }),
  };
}
