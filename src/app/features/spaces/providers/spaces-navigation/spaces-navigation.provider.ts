import { computed, inject, type Provider } from '@angular/core';
import type { SlotContribution, SlotFeature } from '@shared/layout-slot';

import type { SpaceDetails } from '../../models/space/space.interface';
import type { ListSummary, SpaceOverview } from '../../models/task-list/task-list.interface';
import type {
  ListDirectoryEntry,
  ListDirectoryPort,
} from '../../ports/list-directory/list-directory-port.interface';
import { LIST_DIRECTORY } from '../../ports/list-directory/list-directory.token';
import { SpacesNavigationStore } from '../../state/spaces-navigation/spaces-navigation.store';
import { listIconName, lookTone } from '../../utils/look/look.util';
import { SidebarFooterLinks } from '../../ui/components/sidebar-footer-links/sidebar-footer-links.component';
import { SpacesRailItem } from '../../ui/components/spaces-rail-item/spaces-rail-item.component';
import { SpacesSidebar } from '../../ui/components/spaces-sidebar/spaces-sidebar.component';
import { SprintProgress } from '../../ui/components/sprint-progress/sprint-progress.component';

/**
 * Function provideSpacesNavigation
 *
 * @description
 * Provides the workspace's `SpacesNavigationStore`, shared by the sidebar, the sprint progress and
 * the spaces screens, and `LIST_DIRECTORY`, the lists it read, for the other features. Put it in
 * the providers of the `/:org` route that loads the shell.
 *
 * @returns {Provider[]} The store and port providers.
 */
export function provideSpacesNavigation(): Provider[] {
  return [
    SpacesNavigationStore,
    {
      provide: LIST_DIRECTORY,
      useFactory: (): ListDirectoryPort => {
        const navigation: InstanceType<typeof SpacesNavigationStore> =
          inject(SpacesNavigationStore);
        return {
          lists: computed((): readonly ListDirectoryEntry[] => {
            if (!navigation.spaces.hasValue() || !navigation.overviews.hasValue()) return [];
            const overviews: Readonly<Record<string, SpaceOverview>> = navigation.overviews.value();
            return navigation.spaces
              .value()
              .flatMap((space: SpaceDetails): readonly ListDirectoryEntry[] =>
                (space.id in overviews ? overviews[space.id].lists : []).map(
                  (summary: ListSummary): ListDirectoryEntry => ({
                    id: summary.list.id,
                    name: summary.list.name,
                    spaceId: space.id,
                    spaceName: space.name,
                    icon: listIconName(summary.list),
                    tone: lookTone(summary.list.color),
                  }),
                ),
              );
          }),
        };
      },
    },
  ];
}

/**
 * Function withSpacesRailItem
 *
 * @description
 * Contributes `Spaces` to the shell's `railNavigation` slot, after `Inbox`: it
 * shows the spaces screen, and the favorite spaces follow it on desktop.
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

/**
 * Function withSidebarFooterLinks
 *
 * @description
 * Contributes `Trash` and `Archives` with their counts to the shell's `sidebarFooter`
 * slot, between the plan line (order 10) and `Keyboard shortcuts` (order 90). Bind it on the
 * `/:org` route together with `provideSpacesNavigation()`.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withSidebarFooterLinks(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'spaces.footer-links',
      order: 50,
      component: SidebarFooterLinks,
    }),
  };
}
