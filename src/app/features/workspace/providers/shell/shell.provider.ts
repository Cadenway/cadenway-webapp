import type { SlotContribution, SlotFeature } from '@shared/layout-slot';

import { ShortcutsButton } from '../../ui/components/shortcuts-button/shortcuts-button.component';
import { ThemeRailItem } from '../../ui/components/theme-rail-item/theme-rail-item.component';
import { ShortcutsDialog } from '../../ui/dialogs/shortcuts-dialog/shortcuts-dialog.component';

/**
 * Function withThemeRailItem
 *
 * @description
 * Contributes the theme button to the shell's `railFooter` slot, between search and the account
 * menu.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withThemeRailItem(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'workspace.theme',
      order: 10,
      component: ThemeRailItem,
    }),
  };
}

/**
 * Function withShortcutsDialog
 *
 * @description
 * Contributes the keyboard shortcuts dialog, opened by `?`, to the shell's `overlays` slot.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withShortcutsDialog(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'workspace.shortcuts-dialog',
      order: 10,
      component: ShortcutsDialog,
    }),
  };
}

/**
 * Function withShortcutsButton
 *
 * @description
 * Contributes the `Keyboard shortcuts` row, last in the shell's `sidebarFooter` slot.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withShortcutsButton(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'workspace.shortcuts-button',
      order: 90,
      component: ShortcutsButton,
    }),
  };
}
