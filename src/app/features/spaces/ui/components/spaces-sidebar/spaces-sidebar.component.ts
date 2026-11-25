import {
  Component,
  computed,
  DOCUMENT,
  effect,
  inject,
  type Signal,
  signal,
  untracked,
  type WritableSignal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  type Event as RouterEvent,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { CwButton } from '@cadenway/ui/components/button';
import { CwSidebarGroup, CwSidebarItem, CwSidebarSpace } from '@cadenway/ui/components/sidebar';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { NgIcon } from '@ng-icons/core';
import { filter, map } from 'rxjs';

import {
  type SidebarTip,
  sidebarTips,
} from '../../../constants/sidebar-tips/sidebar-tips.constants';
import type { Favorite } from '../../../models/favorite/favorite.interface';
import type { Space } from '../../../models/space/space.interface';
import type { ListSummary, SpaceOverview } from '../../../models/task-list/task-list.interface';
import { SpacesNavigationStore } from '../../../state/spaces-navigation/spaces-navigation.store';
import {
  listIconName,
  lookIconName,
  type SidebarSpaceColor,
  sidebarColor,
} from '../../../utils/look/look.util';
import { injectOrganizationSlug } from '../../../utils/workspace-route/workspace-route.util';
import { SidebarTips } from '../sidebar-tips/sidebar-tips.component';

/**
 * Constant TIPS_STORAGE_KEY
 *
 * @description
 * Browser storage key of the dismissed suggestions, as the mockup names it.
 *
 * @type {string}
 */
const TIPS_STORAGE_KEY: string = 'cadenway-tips';

/**
 * Constant LIST_PATH
 *
 * @description
 * Reads the list id of a list address below a slug.
 *
 * @type {RegExp}
 */
const LIST_PATH: RegExp = /^\/[^/?#]+\/l\/([^/?#]+)/u;

/**
 * Interface SidebarSpaceView
 *
 * @description
 * A space of the accordion with its lists.
 */
interface SidebarSpaceView {
  // #region Properties
  /**
   * Property space
   *
   * @description
   * The space.
   *
   * @type {Space}
   * @readonly
   */
  readonly space: Space;

  /**
   * Property icon
   *
   * @description
   * Icon name, or undefined for the initial.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly icon: string | undefined;

  /**
   * Property color
   *
   * @description
   * Hue of the mark.
   *
   * @type {SidebarSpaceColor}
   * @readonly
   */
  readonly color: SidebarSpaceColor;

  /**
   * Property total
   *
   * @description
   * Tasks of its lists, or null when its counts were not read.
   *
   * @type {number | null}
   * @readonly
   */
  readonly total: number | null;

  /**
   * Property lists
   *
   * @description
   * Its lists with their counts.
   *
   * @type {readonly ListSummary[]}
   * @readonly
   */
  readonly lists: readonly ListSummary[];
  // #endregion
}

/**
 * Function readDismissed
 *
 * @description
 * Reads the dismissed suggestions from browser storage; unreadable storage dismisses nothing.
 *
 * @param {Storage | null} storage - Browser storage.
 * @returns {readonly string[]} Dismissed keys.
 */
function readDismissed(storage: Storage | null): readonly string[] {
  try {
    const value: unknown = JSON.parse(storage?.getItem(TIPS_STORAGE_KEY) ?? '[]');
    return Array.isArray(value)
      ? value.filter((key: unknown): key is string => typeof key === 'string')
      : [];
  } catch {
    return [];
  }
}

/**
 * Component SpacesSidebar
 *
 * @description
 * The body of the shell's sidebar (`App.dc.html` lines 216-259): « Favoris » (the caller's
 * favorite lists and saved views, hidden when there are none), « Espaces » (an accordion of the
 * spaces with their lists and task counts, and the space overview on hover) and the suggestion
 * carousel. A container: it follows the route's organization in the workspace's
 * `SpacesNavigationStore`, opens the space of the list shown, and keeps the dismissed suggestions
 * in browser storage. The spaces show skeletons while read and an inline « Réessayer » when the
 * read fails. The « + » button and the right-click menus, whose entries open the dialogs of step
 * 4b, are not built yet.
 */
@Component({
  selector: 'cw-spaces-sidebar',
  imports: [
    CwButton,
    CwSidebarGroup,
    CwSidebarItem,
    CwSidebarSpace,
    CwSkeleton,
    NgIcon,
    RouterLink,
    RouterLinkActive,
    SidebarTips,
  ],
  host: { class: 'flex min-h-0 flex-1 flex-col gap-3' },
  templateUrl: './spaces-sidebar.component.html',
})
export class SpacesSidebar {
  // #region Properties
  /**
   * Property navigation
   *
   * @description
   * The workspace's spaces navigation.
   *
   * @type {InstanceType<typeof SpacesNavigationStore>}
   * @readonly
   */
  protected readonly navigation: InstanceType<typeof SpacesNavigationStore> =
    inject(SpacesNavigationStore);

  /**
   * Property slug
   *
   * @description
   * Organization slug of the route.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly slug: Signal<string> = injectOrganizationSlug();

  /**
   * Property router
   *
   * @description
   * Router whose address names the list shown.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property storage
   *
   * @description
   * Browser storage of the dismissed suggestions, or null without one.
   *
   * @type {Storage | null}
   * @readonly
   */
  private readonly storage: Storage | null = ((): Storage | null => {
    try {
      return inject(DOCUMENT).defaultView?.localStorage ?? null;
    } catch {
      return null;
    }
  })();

  /**
   * Property currentListId
   *
   * @description
   * The list shown, or null on another screen.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  private readonly currentListId: Signal<string | null> = toSignal(
    this.router.events.pipe(
      filter((event: RouterEvent): event is NavigationEnd => event instanceof NavigationEnd),
      map(
        (event: NavigationEnd): string | null =>
          LIST_PATH.exec(event.urlAfterRedirects)?.[1] ?? null,
      ),
    ),
    { initialValue: LIST_PATH.exec(this.router.url)?.[1] ?? null },
  );

  /**
   * Property favorites
   *
   * @description
   * Favorite spaces, lists and saved views, in insertion order.
   *
   * @type {Signal<readonly Favorite[]>}
   * @readonly
   */
  protected readonly favorites: Signal<readonly Favorite[]> = computed((): readonly Favorite[] =>
    this.navigation.favorites.hasValue() ? this.navigation.favorites.value() : [],
  );

  /**
   * Property spaces
   *
   * @description
   * The accordion's spaces with their lists.
   *
   * @type {Signal<readonly SidebarSpaceView[]>}
   * @readonly
   */
  protected readonly spaces: Signal<readonly SidebarSpaceView[]> = computed(
    (): readonly SidebarSpaceView[] => {
      if (!this.navigation.spaces.hasValue()) return [];
      const overviews: Readonly<Record<string, SpaceOverview>> =
        this.navigation.overviews.hasValue() ? this.navigation.overviews.value() : {};
      return this.navigation.spaces.value().map((space: Space): SidebarSpaceView => {
        const overview: SpaceOverview | undefined =
          space.id in overviews ? overviews[space.id] : undefined;
        const lists: readonly ListSummary[] = overview?.lists ?? [];
        return {
          space,
          icon: space.icon ? lookIconName(space.icon) : undefined,
          color: sidebarColor(space.color),
          total: overview
            ? lists.reduce(
                (sum: number, summary: ListSummary): number => sum + summary.counts.total,
                0,
              )
            : null,
          lists,
        };
      });
    },
  );

  /**
   * Property dismissed
   *
   * @description
   * Suggestions the person hid.
   *
   * @type {WritableSignal<readonly string[]>}
   * @readonly
   */
  private readonly dismissed: WritableSignal<readonly string[]> = signal(
    readDismissed(this.storage),
  );

  /**
   * Property tipIndex
   *
   * @description
   * Position in the remaining suggestions, wrapped around.
   *
   * @type {WritableSignal<number>}
   * @readonly
   */
  private readonly tipIndex: WritableSignal<number> = signal(0);

  /**
   * Property tips
   *
   * @description
   * Suggestions not hidden yet.
   *
   * @type {Signal<readonly SidebarTip[]>}
   * @readonly
   */
  protected readonly tips: Signal<readonly SidebarTip[]> = computed((): readonly SidebarTip[] =>
    sidebarTips().filter((tip: SidebarTip): boolean => !this.dismissed().includes(tip.key)),
  );

  /**
   * Property tipPosition
   *
   * @description
   * Zero-based position of the tip shown.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly tipPosition: Signal<number> = computed((): number => {
    const count: number = this.tips().length;
    return count === 0 ? 0 : ((this.tipIndex() % count) + count) % count;
  });
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Follows the route's organization and opens the space holding the list shown.
   *
   * @constructor
   */
  public constructor() {
    effect((): void => {
      const listId: string | null = this.currentListId();
      if (listId === null) return;
      const owner: SidebarSpaceView | undefined = this.spaces().find((view: SidebarSpaceView) =>
        view.lists.some((summary: ListSummary): boolean => summary.list.id === listId),
      );
      if (owner && !untracked(() => this.navigation.expanded()[owner.space.id])) {
        untracked(() => {
          this.navigation.setExpanded(owner.space.id, true);
        });
      }
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method listIcon
   *
   * @description
   * Bold icon of a list in the accordion; the item takes the Fill weight while current.
   *
   * @param {ListSummary} summary - The list.
   * @returns {string} The icon name.
   */
  protected listIcon(summary: ListSummary): string {
    return listIconName(summary.list);
  }

  /**
   * Method overviewLabel
   *
   * @description
   * Name of a space's overview link (« Vue d’ensemble de Produit »).
   *
   * @param {Space} space - The space.
   * @returns {string} The label.
   */
  protected overviewLabel(space: Space): string {
    return $localize`:@@spaces.sidebar.overview:Overview of ${space.name}:name:`;
  }

  /**
   * Method favoriteLink
   *
   * @description
   * Address of a favorite list or saved view.
   *
   * @param {Favorite} favorite - The favorite.
   * @returns {readonly string[]} The link commands.
   */
  protected favoriteLink(favorite: Favorite): readonly string[] {
    return [
      '/',
      this.slug(),
      favorite.kind === 'space' ? 'spaces' : 'l',
      favorite.kind === 'saved-view' ? (favorite.listId ?? '') : favorite.targetId,
    ];
  }

  /**
   * Method favoriteQuery
   *
   * @description
   * Query of a favorite: the saved view, or none.
   *
   * @param {Favorite} favorite - The favorite.
   * @returns {Record<string, string>} The query parameters.
   */
  protected favoriteQuery(favorite: Favorite): Record<string, string> {
    return favorite.kind === 'saved-view' ? { savedView: favorite.targetId } : {};
  }

  /**
   * Method setExpanded
   *
   * @description
   * Opens or closes a space.
   *
   * @param {string} spaceId - The space.
   * @param {boolean} open - Whether its lists show.
   */
  protected setExpanded(spaceId: string, open: boolean): void {
    this.navigation.setExpanded(spaceId, open);
  }

  /**
   * Method moveTip
   *
   * @description
   * Shows the previous or the next suggestion.
   *
   * @param {number} step - `-1` or `1`.
   */
  protected moveTip(step: number): void {
    this.tipIndex.set(this.tipPosition() + step);
  }

  /**
   * Method dismissTips
   *
   * @description
   * Hides every suggestion and remembers it in browser storage.
   */
  protected dismissTips(): void {
    const all: readonly string[] = sidebarTips().map((tip: SidebarTip): string => tip.key);
    this.dismissed.set(all);
    try {
      this.storage?.setItem(TIPS_STORAGE_KEY, JSON.stringify(all));
    } catch {
      return;
    }
  }
  // #endregion
}
