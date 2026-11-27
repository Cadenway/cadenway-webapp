import type { SlotContribution, SlotFeature } from '@shared/layout-slot';

import { DocsRailItem } from '../../ui/components/docs-rail-item/docs-rail-item.component';

/**
 * Function withDocsRailItem
 *
 * @description
 * Contributes `Documents` to the shell's `railNavigation` slot (order 60), the last
 * application, before the favorite spaces (order 90). Bind it on a route below `/:org`, whose injector provides
 * `WORKSPACE_CONTEXT`.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withDocsRailItem(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'docs.rail-item',
      order: 60,
      component: DocsRailItem,
    }),
  };
}
