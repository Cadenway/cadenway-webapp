import { computed, inject, type Provider } from '@angular/core';
import type { SlotContribution, SlotFeature } from '@shared/layout-slot';

import type { SpaceDetails } from '../../models/space/space.interface';
import type { SpacesRailItemVariant } from '../../models/spaces-rail-item/spaces-rail-item-variant.type';
import type { ListSummary, SpaceOverview } from '../../models/task-list/task-list.interface';
import type {
  ListDirectoryEntry,
  ListDirectoryPort,
} from '../../ports/list-directory/list-directory-port.interface';
import { LIST_DIRECTORY } from '../../ports/list-directory/list-directory.token';
import type { NavigationRefreshPort } from '../../ports/navigation-refresh/navigation-refresh-port.interface';
import { NAVIGATION_REFRESH } from '../../ports/navigation-refresh/navigation-refresh.token';
import type {
  SpaceDirectoryEntry,
  SpaceDirectoryPort,
} from '../../ports/space-directory/space-directory-port.interface';
import { SPACE_DIRECTORY } from '../../ports/space-directory/space-directory.token';
import { SpacesNavigationStore } from '../../state/spaces-navigation/spaces-navigation.store';
import { listIconName, lookIconName, lookTone } from '../../utils/look/look.util';
import { FavoriteSpacesRail } from '../../ui/components/favorite-spaces-rail/favorite-spaces-rail.component';
import { SidebarFooterLinks } from '../../ui/components/sidebar-footer-links/sidebar-footer-links.component';
import { SpacesRailItem } from '../../ui/components/spaces-rail-item/spaces-rail-item.component';
import { SpacesSidebar } from '../../ui/components/spaces-sidebar/spaces-sidebar.component';
import { SprintProgress } from '../../ui/components/sprint-progress/sprint-progress.component';

/**
 * Function provideSpacesNavigation
 *
 * @description
 * Provides the workspace's `SpacesNavigationStore`, shared by the sidebar, the sprint progress and
 * the spaces screens, and for the other features `LIST_DIRECTORY` and `SPACE_DIRECTORY`, the lists
 * and spaces it read, and `NAVIGATION_REFRESH`, which reads them again after another feature's
 * write. Put it in the providers of the `/:org` route that loads the shell.
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
    {
      provide: SPACE_DIRECTORY,
      useFactory: (): SpaceDirectoryPort => {
        const navigation: InstanceType<typeof SpacesNavigationStore> =
          inject(SpacesNavigationStore);
        return {
          spaces: computed((): readonly SpaceDirectoryEntry[] =>
            navigation.spaces.hasValue()
              ? navigation.spaces.value().map((space: SpaceDetails): SpaceDirectoryEntry => ({
                  id: space.id,
                  name: space.name,
                  icon: space.icon ? lookIconName(space.icon) : null,
                  tone: lookTone(space.color),
                  callerRole: space.callerRole,
                }))
              : [],
          ),
        };
      },
    },
    {
      provide: NAVIGATION_REFRESH,
      useFactory: (): NavigationRefreshPort => {
        const navigation: InstanceType<typeof SpacesNavigationStore> =
          inject(SpacesNavigationStore);
        const refreshCounts: () => void = (): void => {
          navigation.trashCount.reload();
          navigation.archiveCount.reload();
        };
        return {
          refresh: (): void => {
            navigation.refresh();
            refreshCounts();
          },
          refreshCounts,
        };
      },
    },
  ];
}

/**
 * Function withSpacesRailItem
 *
 * @description
 * Contributes `Spaces` to the shell's `railNavigation` slot (order 30), between `My tasks` and
 * `Dashboards`: it shows the spaces screen, in the application shell and in the settings shell
 * alike.
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
 * Function withFavoriteSpacesRail
 *
 * @description
 * Contributes the favorite spaces to the shell's `railNavigation` slot (order 90), after every
 * application item, on desktop only. In the settings shell, pass `{ variant: 'settings' }`: there
 * is no sidebar to host the space dialogs, so the favorite spaces' menu keeps only `Open the
 * overview` and `Remove from favorite spaces`. Bind it on a route below `/:org`, together with
 * `provideSpacesNavigation()`.
 *
 * @param {{ readonly variant?: SpacesRailItemVariant }} [options] - Hosting shell, `app` by default.
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withFavoriteSpacesRail(
  options: { readonly variant?: SpacesRailItemVariant } = {},
): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'spaces.favorite-spaces-rail',
      order: 90,
      component: FavoriteSpacesRail,
      inputs: { variant: options.variant ?? 'app' },
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
