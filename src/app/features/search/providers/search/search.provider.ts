import type { SlotContribution, SlotFeature } from '@shared/layout-slot';

import { SearchButton } from '../../ui/components/search-button/search-button.component';
import { SearchRailItem } from '../../ui/components/search-rail-item/search-rail-item.component';
import { CommandPaletteDialog } from '../../ui/dialogs/command-palette/command-palette.component';

/**
 * Function withSearchRailItem
 *
 * @description
 * Contributes the `Search` item, first in the shell's `railFooter` slot.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withSearchRailItem(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'search.rail-item',
      order: 0,
      component: SearchRailItem,
    }),
  };
}

/**
 * Function withSearchButton
 *
 * @description
 * Contributes the `Search…` button to the shell's `sidebarHeader` slot.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withSearchButton(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'search.sidebar-button',
      order: 10,
      component: SearchButton,
    }),
  };
}

/**
 * Function withCommandPalette
 *
 * @description
 * Contributes the Ctrl K command palette to the shell's `overlays` slot. Bind it on the `/:org`
 * route, whose injector provides `WORKSPACE_CONTEXT`.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withCommandPalette(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'search.command-palette',
      order: 0,
      component: CommandPaletteDialog,
    }),
  };
}
