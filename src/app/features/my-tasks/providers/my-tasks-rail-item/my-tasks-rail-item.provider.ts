import type { SlotContribution, SlotFeature } from '@shared/layout-slot';

import { MyTasksRailItem } from '../../ui/components/my-tasks-rail-item/my-tasks-rail-item.component';

/**
 * Function withMyTasksRailItem
 *
 * @description
 * Contributes `My tasks` to the shell's `railNavigation` slot (order 20), between `Inbox`
 * and `Spaces`. Bind it on a route below `/:org`, whose injector provides
 * `WORKSPACE_CONTEXT`.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withMyTasksRailItem(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'my-tasks.rail-item',
      order: 20,
      component: MyTasksRailItem,
    }),
  };
}
