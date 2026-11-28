import { inject, type Provider } from '@angular/core';
import type { SlotContribution, SlotFeature } from '@shared/layout-slot';

import type { CommandPaletteLauncherPort } from '../../ports/command-palette-launcher/command-palette-launcher-port.interface';
import { COMMAND_PALETTE_LAUNCHER } from '../../ports/command-palette-launcher/command-palette-launcher.token';
import { CommandPalette } from '../../services/command-palette/command-palette.service';
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

/**
 * Function provideCommandPaletteLauncher
 *
 * @description
 * Provides `COMMAND_PALETTE_LAUNCHER` for the other features, over the palette's open state. Put
 * it in the providers of the `/:org` route, whose shells all contribute `withCommandPalette()`.
 *
 * @returns {Provider} The port provider.
 */
export function provideCommandPaletteLauncher(): Provider {
  return {
    provide: COMMAND_PALETTE_LAUNCHER,
    useFactory: (): CommandPaletteLauncherPort => {
      const palette: CommandPalette = inject(CommandPalette);
      return {
        open: (): void => {
          palette.setOpen(true);
        },
      };
    },
  };
}
