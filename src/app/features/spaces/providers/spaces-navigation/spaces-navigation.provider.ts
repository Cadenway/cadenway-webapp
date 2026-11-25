import type { Provider } from '@angular/core';
import type { SlotContribution, SlotFeature } from '@shared/layout-slot';

import { SpacesNavigationStore } from '../../state/spaces-navigation/spaces-navigation.store';
import { SpacesRailItem } from '../../ui/components/spaces-rail-item/spaces-rail-item.component';
import { SpacesSidebar } from '../../ui/components/spaces-sidebar/spaces-sidebar.component';
import { SprintProgress } from '../../ui/components/sprint-progress/sprint-progress.component';

/**
 * Function provideSpacesNavigation
 *
 * @description
 * Provides the workspace's `SpacesNavigationStore`, shared by the sidebar, the sprint progress and
 * the spaces screens. Put it in the providers of the `/:org` route that loads the shell.
 *
 * @returns {Provider[]} The store provider.
 */
export function provideSpacesNavigation(): Provider[] {
  return [SpacesNavigationStore];
}

/**
 * Function withSpacesRailItem
 *
 * @description
 * Contributes « Espaces » to the shell's `railNavigation` slot, after « Boîte de réception »: it
 * toggles the sidebar through `SHELL_SIDEBAR`.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withSpacesRailItem(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'spaces.rail-item',
      order: 30,
      component: SpacesRailItem,
    }),
  };
}

/**
 * Function withSpacesSidebar
 *
 * @description
 * Contributes the favorites, the spaces and the suggestions to the shell's `sidebar` slot. Bind it
 * on the `/:org` route together with `provideSpacesNavigation()`.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withSpacesSidebar(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'spaces.sidebar',
      order: 0,
      component: SpacesSidebar,
    }),
  };
}

/**
 * Function withSprintProgress
 *
 * @description
 * Contributes the current sprint's progress first in the shell's `sidebarFooter` slot. Bind it on
 * the `/:org` route together with `provideSpacesNavigation()`.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withSprintProgress(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'spaces.sprint-progress',
      order: 0,
      component: SprintProgress,
    }),
  };
}
