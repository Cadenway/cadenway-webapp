import { SPACES_RETRY } from '../../../constants/data-table-texts/data-table-texts.constants';
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
import {
  CwAlertDialog,
  CwAlertDialogAction,
  CwAlertDialogCancel,
  CwAlertDialogDescription,
  CwAlertDialogMedia,
  CwAlertDialogTitle,
  provideCwAlertDialogLabels,
} from '@cadenway/ui/components/alert-dialog';
import { CwButton } from '@cadenway/ui/components/button';
import { CwContextMenuTriggerFor } from '@cadenway/ui/components/context-menu';
import { CwMenu, CwMenuItem, CwMenuSeparator } from '@cadenway/ui/components/menu';
import { CwSidebarGroup, CwSidebarItem, CwSidebarSpace } from '@cadenway/ui/components/sidebar';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwToastService } from '@cadenway/ui/components/toast';
import { NgIcon } from '@ng-icons/core';
import { filter, map } from 'rxjs';

import { AppLinkService } from '@core/routing';
import { PLAN_SEATS, type PlanSeatsPort } from '@features/organization/ports/plan-seats';
import { TaskCreate } from '@features/task';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import {
  type SidebarTip,
  sidebarTips,
} from '../../../constants/sidebar-tips/sidebar-tips.constants';
import type { Favorite } from '../../../models/favorite/favorite.interface';
import type { SpaceDetails, SpaceDraft } from '../../../models/space/space.interface';
import type {
  ListDraft,
  ListSummary,
  SpaceOverview,
  TaskList,
} from '../../../models/task-list/task-list.interface';
import {
  type SpaceCreationResult,
  type SpacesDialog,
  SpacesNavigationStore,
} from '../../../state/spaces-navigation/spaces-navigation.store';
import { todayIso } from '../../../utils/calendar-date/calendar-date.util';
import {
  listIconName,
  lookIconName,
  type SidebarSpaceColor,
  sidebarColor,
} from '../../../utils/look/look.util';
import { injectOrganizationSlug } from '../../../utils/workspace-route/workspace-route.util';
import { addDays, ListDialog } from '../../dialogs/list-dialog/list-dialog.component';
import { SpaceDialog } from '../../dialogs/space-dialog/space-dialog.component';
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
 * Constant SPACE_PATH
 *
 * @description
 * Reads the space id of a space overview address below a slug.
 *
 * @type {RegExp}
 */
const SPACE_PATH: RegExp = /^\/[^/?#]+\/spaces\/([^/?#]+)/u;

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
   * @type {SpaceDetails}
   * @readonly
   */
  readonly space: SpaceDetails;

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
 * Interface SidebarFavoriteView
 *
 * @description
 * A favorite list or saved view of `Favorites`, with the list it opens when it is known.
 */
interface SidebarFavoriteView {
  // #region Properties
  /**
   * Property favorite
   *
   * @description
   * The favorite.
   *
   * @type {Favorite}
   * @readonly
   */
  readonly favorite: Favorite;

  /**
   * Property list
   *
   * @description
   * The favorite list as the sidebar shows it, or null for a saved view or an unread list.
   *
   * @type {TaskList | null}
   * @readonly
   */
  readonly list: TaskList | null;

  /**
   * Property icon
   *
   * @description
   * Bold icon; the item takes the Fill weight while current.
   *
   * @type {string}
   * @readonly
   */
  readonly icon: string;
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
 * Function draftOfSpace
 *
 * @description
 * The settings of a space as a draft, to put them back.
 *
 * @param {SpaceDetails} space - The space.
 * @returns {SpaceDraft} Its settings.
 */
function draftOfSpace(space: SpaceDetails): SpaceDraft {
  return {
    name: space.name,
    prefix: space.prefix,
    description: space.description,
    icon: space.icon,
    color: space.color,
    private: space.private,
  };
}

/**
 * Function draftOfList
 *
 * @description
 * The values of a list as a draft, to open its dialog or put them back.
 *
 * @param {TaskList} list - The list.
 * @returns {ListDraft} Its values.
 */
function draftOfList(list: TaskList): ListDraft {
  return { name: list.name, icon: list.icon, color: list.color, sprint: list.sprint };
}

/**
 * Component SpacesSidebar
 *
 * @description
 * The body of the shell's sidebar (`App.dc.html` lines 197-259): `Favorites` (the caller's
 * favorite lists and saved views, hidden when there are none; favorite spaces sit in the rail),
 * `Spaces` (`Create a space`, an accordion of the spaces with their lists and task counts,
 * and `Edit the space` and the space overview on hover) and the suggestion carousel. Spaces,
 * lists, favorites and the background open their context menus (right click, ContextMenu key,
 * Shift + F10, long press) with the mockup's items. A container: it follows the route's
 * organization in the workspace's `SpacesNavigationStore`, opens the space of the list shown,
 * keeps the dismissed suggestions in browser storage, and hosts the navigation's dialogs (space,
 * list or sprint, space deletion) for every screen that opens them through the store, with their
 * toasts and their `Undo`. The spaces show skeletons while read and an inline `Retry`
 * when the read fails.
 */
@Component({
  selector: 'cw-spaces-sidebar',
  imports: [
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogMedia,
    CwAlertDialogTitle,
    CwButton,
    CwContextMenuTriggerFor,
    CwMenu,
    CwMenuItem,
    CwMenuSeparator,
    CwSidebarGroup,
    CwSidebarItem,
    CwSidebarSpace,
    CwSkeleton,
    ListDialog,
    NgIcon,
    RouterLink,
    RouterLinkActive,
    SidebarTips,
    SpaceDialog,
  ],
  providers: [
    provideCwAlertDialogLabels(() => ({
      confirm: $localize`:@@spaces.labels.confirm:To confirm, type`,
      more: (count: number): string => $localize`:@@spaces.labels.more:+ ${count}:count: others`,
    })),
  ],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  templateUrl: './spaces-sidebar.component.html',
})
export class SpacesSidebar {
  // #region Properties
  /**
   * Property retryLabel
   *
   * @description
   * Label for retrying a failed read.
   *
   * @type {string}
   * @readonly
   */
  protected readonly retryLabel: string = SPACES_RETRY;

  /**
   * Property planSeats
   *
   * @description
   * The plan and free seats of Organization's shared subscription read, absent outside a workspace
   * that provides it.
   *
   * @type {PlanSeatsPort | null}
   * @readonly
   */
  private readonly planSeats: PlanSeatsPort | null = inject(PLAN_SEATS, { optional: true });

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
   * Property organizationName
   *
   * @description
   * Name of the committed organization, for the confidentiality of a space.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly organizationName: Signal<string>;

  /**
   * Property router
   *
   * @description
   * Router whose address names the list or space shown.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property toasts
   *
   * @description
   * Feedback of the menus and dialogs.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property taskCreate
   *
   * @description
   * Task's create dialog, for `New task`.
   *
   * @type {TaskCreate}
   * @readonly
   */
  private readonly taskCreate: TaskCreate = inject(TaskCreate);

  /**
   * Property document
   *
   * @description
   * Document whose window holds the clipboard.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);

  /**
   * Property links
   *
   * @description
   * Builds the shareable addresses below the current locale segment.
   *
   * @type {AppLinkService}
   * @readonly
   */
  private readonly links: AppLinkService = inject(AppLinkService);

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
   * Property url
   *
   * @description
   * The address shown, after redirects.
   *
   * @type {Signal<string>}
   * @readonly
   */
  private readonly url: Signal<string> = toSignal(
    this.router.events.pipe(
      filter((event: RouterEvent): event is NavigationEnd => event instanceof NavigationEnd),
      map((event: NavigationEnd): string => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /**
   * Property currentListId
   *
   * @description
   * The list shown, or null on another screen.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  private readonly currentListId: Signal<string | null> = computed(
    (): string | null => LIST_PATH.exec(this.url())?.[1] ?? null,
  );

  /**
   * Property favorites
   *
   * @description
   * Favorite lists and saved views, in insertion order; favorite spaces sit in the rail.
   *
   * @type {Signal<readonly SidebarFavoriteView[]>}
   * @readonly
   */
  protected readonly favorites: Signal<readonly SidebarFavoriteView[]> = computed(
    (): readonly SidebarFavoriteView[] => {
      if (!this.navigation.favorites.hasValue()) return [];
      const lists: ReadonlyMap<string, TaskList> = new Map(
        this.spaces().flatMap((view: SidebarSpaceView) =>
          view.lists.map((summary: ListSummary): [string, TaskList] => [
            summary.list.id,
            summary.list,
          ]),
        ),
      );
      return this.navigation.favorites
        .value()
        .filter((favorite: Favorite): boolean => favorite.kind !== 'space')
        .map((favorite: Favorite): SidebarFavoriteView => {
          const list: TaskList | null =
            favorite.kind === 'list' ? (lists.get(favorite.targetId) ?? null) : null;
          return {
            favorite,
            list,
            icon:
              favorite.kind === 'saved-view'
                ? 'phosphorFunnelSimpleBold'
                : list
                  ? listIconName(list)
                  : 'phosphorListBulletsBold',
          };
        });
    },
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
      return this.navigation.spaces.value().map((space: SpaceDetails): SidebarSpaceView => {
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
   * Property allTips
   *
   * @description
   * Every suggestion the workspace can offer now: `Invite your team` needs free seats.
   *
   * @type {Signal<readonly SidebarTip[]>}
   * @readonly
   */
  private readonly allTips: Signal<readonly SidebarTip[]> = computed((): readonly SidebarTip[] =>
    sidebarTips(this.planSeats?.seats() ?? null),
  );

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
    this.allTips().filter((tip: SidebarTip): boolean => !this.dismissed().includes(tip.key)),
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

  /**
   * Property dialog
   *
   * @description
   * The navigation's dialog open, or null.
   *
   * @type {Signal<SpacesDialog | null>}
   * @readonly
   */
  protected readonly dialog: Signal<SpacesDialog | null> = computed((): SpacesDialog | null =>
    this.navigation.dialog(),
  );

  /**
   * Property spaceDialog
   *
   * @description
   * The space dialog's request, or null.
   *
   * @type {Signal<{ kind: 'space'; space: SpaceDetails | null } | null>}
   * @readonly
   */
  protected readonly spaceDialog: Signal<{ kind: 'space'; space: SpaceDetails | null } | null> =
    computed(() => {
      const dialog: SpacesDialog | null = this.dialog();
      return dialog?.kind === 'space' ? dialog : null;
    });

  /**
   * Property listDialog
   *
   * @description
   * The list dialog's request, or null.
   *
   * @type {Signal<Extract<SpacesDialog, { kind: 'list' }> | null>}
   * @readonly
   */
  protected readonly listDialog: Signal<Extract<SpacesDialog, { kind: 'list' }> | null> = computed(
    () => {
      const dialog: SpacesDialog | null = this.dialog();
      return dialog?.kind === 'list' ? dialog : null;
    },
  );

  /**
   * Property deletedSpace
   *
   * @description
   * The space whose deletion is asked, or null.
   *
   * @type {Signal<SpaceDetails | null>}
   * @readonly
   */
  protected readonly deletedSpace: Signal<SpaceDetails | null> = computed(
    (): SpaceDetails | null => {
      const dialog: SpacesDialog | null = this.dialog();
      return dialog?.kind === 'delete-space' ? dialog.space : null;
    },
  );

  /**
   * Property listDraft
   *
   * @description
   * The values the list dialog opens with: the list edited, or the proposal of a new list or of
   * the next sprint (`Sprint 15`, the day after the end of the last sprint or today, 14 days,
   * the lightning and `Amethyst`).
   *
   * @type {Signal<ListDraft>}
   * @readonly
   */
  protected readonly listDraft: Signal<ListDraft> = computed((): ListDraft => {
    const request: Extract<SpacesDialog, { kind: 'list' }> | null = this.listDialog();
    if (request?.list) return draftOfList(request.list);
    if (!request?.sprint) return { name: '', icon: null, color: 'gris', sprint: null };
    const sprints: readonly TaskList[] = (
      this.spaces().find((view: SidebarSpaceView): boolean => view.space.id === request.spaceId)
        ?.lists ?? []
    )
      .map((summary: ListSummary): TaskList => summary.list)
      .filter((list: TaskList): boolean => list.sprint !== null);
    const lastEnd: string | undefined = sprints
      .map((list: TaskList): string => list.sprint?.endDate ?? '')
      .filter(Boolean)
      .sort()
      .pop();
    const start: string = lastEnd ? addDays(lastEnd, 1) : todayIso();
    const number: RegExpExecArray | null = /(\d+)\s*$/u.exec(sprints.at(-1)?.name ?? '');
    const next: number = number ? Number.parseInt(number[1], 10) + 1 : sprints.length + 1;
    return {
      name: $localize`:@@spaces.list-dialog.sprint-name:Sprint ${next}:number:`,
      icon: 'lightning',
      color: 'violet',
      sprint: { startDate: start, endDate: addDays(start, 13), goal: null },
    };
  });

  /**
   * Property takenPrefixes
   *
   * @description
   * Prefixes of the spaces other than the one edited.
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  protected readonly takenPrefixes: Signal<readonly string[]> = computed((): readonly string[] => {
    const edited: string | undefined = this.spaceDialog()?.space?.id;
    return this.spaces()
      .filter((view: SidebarSpaceView): boolean => view.space.id !== edited)
      .map((view: SidebarSpaceView): string => view.space.prefix);
  });

  /**
   * Property prefixTaken
   *
   * @description
   * The prefix the gateway refused as used for the open space dialog, or null.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  protected readonly prefixTaken: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * Property pending
   *
   * @description
   * Whether a dialog's write is being recorded.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly pending: WritableSignal<boolean> = signal(false);

  /**
   * Property deleteSummary
   *
   * @description
   * Lists and tasks of the space whose deletion is asked.
   *
   * @type {Signal<{ lists: number; tasks: number }>}
   * @readonly
   */
  protected readonly deleteSummary: Signal<{ lists: number; tasks: number }> = computed(() => {
    const space: SpaceDetails | null = this.deletedSpace();
    const overview: SpaceOverview | undefined =
      space && this.navigation.overviews.hasValue()
        ? this.navigation.overviews.value()[space.id]
        : undefined;
    return { lists: overview?.lists.length ?? 0, tasks: overview?.taskCount ?? 0 };
  });

  /**
   * Property deleteTitle
   *
   * @description
   * `Delete the space “Product”?`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly deleteTitle: Signal<string> = computed((): string => {
    const name: string = this.deletedSpace()?.name ?? '';
    return $localize`:@@spaces.space.delete-title:Delete the space “${name}:name:”?`;
  });

  /**
   * Property deleteText
   *
   * @description
   * The consequences of the deletion, with its lists and tasks counted.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly deleteText: Signal<string> = computed((): string => {
    const { lists: listCount, tasks: taskCount }: { lists: number; tasks: number } =
      this.deleteSummary();
    const lists: string =
      listCount === 1
        ? $localize`:@@spaces.space.delete-lists-one:1 list`
        : $localize`:@@spaces.space.delete-lists:${listCount}:count: lists`;
    const tasks: string =
      taskCount === 1
        ? $localize`:@@spaces.space.delete-tasks-one:1 task`
        : $localize`:@@spaces.space.delete-tasks:${taskCount}:count: tasks`;
    return $localize`:@@spaces.space.delete-text:${lists}:lists: and ${tasks}:tasks:: the tasks go to the trash, the lists and the space are deleted. Members lose access immediately.`;
  });
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Starts the spaces, their overviews and the favorites it shows, follows the route's
   * organization and opens the space holding the list shown.
   *
   * @constructor
   */
  public constructor() {
    this.navigation.request(['spaces', 'favorites', 'overviews']);
    const workspace: { organization: Signal<{ name: string }> } = inject(WORKSPACE_CONTEXT);
    this.organizationName = computed((): string => workspace.organization().name);
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
   * Name of a space's overview link (`Overview of Product`).
   *
   * @param {SpaceDetails} space - The space.
   * @returns {string} The label.
   */
  protected overviewLabel(space: SpaceDetails): string {
    return $localize`:@@spaces.sidebar.overview:Overview of ${space.name}:name:`;
  }

  /**
   * Method taskCountLabel
   *
   * @description
   * Spoken form of a list row's count, read once after its name (`Sprint 14, 5 tasks`): the
   * brick hides the visible number from assistive technologies and reads this text instead.
   *
   * @param {number} count - The list's top-level tasks.
   * @returns {string} The label.
   */
  protected taskCountLabel(count: number): string {
    return count === 1
      ? $localize`:@@spaces.sidebar.task-count-one:1 task`
      : $localize`:@@spaces.sidebar.task-count:${count}:count: tasks`;
  }

  /**
   * Method editLabel
   *
   * @description
   * Name of a space's edit button (`Edit the space Product`).
   *
   * @param {SpaceDetails} space - The space.
   * @returns {string} The label.
   */
  protected editLabel(space: SpaceDetails): string {
    return $localize`:@@spaces.sidebar.edit-space:Edit the space ${space.name}:name:`;
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
      'l',
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
   * Method asSpace
   *
   * @description
   * The space a context menu was opened on.
   *
   * @param {unknown} data - The menu's data.
   * @returns {SpaceDetails | null} The space, or null.
   */
  protected asSpace(data: unknown): SpaceDetails | null {
    return typeof data === 'object' && data !== null && 'prefix' in data
      ? (data as SpaceDetails)
      : null;
  }

  /**
   * Method asList
   *
   * @description
   * The list a context menu was opened on.
   *
   * @param {unknown} data - The menu's data.
   * @returns {TaskList | null} The list, or null.
   */
  protected asList(data: unknown): TaskList | null {
    return typeof data === 'object' && data !== null && 'spaceId' in data
      ? (data as TaskList)
      : null;
  }

  /**
   * Method asFavorite
   *
   * @description
   * The saved view favorite a context menu was opened on.
   *
   * @param {unknown} data - The menu's data.
   * @returns {Favorite | null} The favorite, or null.
   */
  protected asFavorite(data: unknown): Favorite | null {
    return typeof data === 'object' && data !== null && 'targetId' in data
      ? (data as Favorite)
      : null;
  }

  /**
   * Method isFavoriteList
   *
   * @description
   * Whether a list is among the favorites.
   *
   * @param {TaskList} list - The list.
   * @returns {boolean} Whether it is.
   */
  protected isFavoriteList(list: TaskList): boolean {
    return this.navigation.favoriteOf('list', list.id) !== undefined;
  }

  /**
   * Method isFavoriteSpace
   *
   * @description
   * Whether a space is among the favorite spaces.
   *
   * @param {SpaceDetails} space - The space.
   * @returns {boolean} Whether it is.
   */
  protected isFavoriteSpace(space: SpaceDetails): boolean {
    return this.navigation.favoriteOf('space', space.id) !== undefined;
  }

  /**
   * Method openList
   *
   * @description
   * `Open`: shows a list.
   *
   * @param {TaskList} list - The list.
   */
  protected openList(list: TaskList): void {
    void this.router.navigate(['/', this.slug(), 'l', list.id]);
  }

  /**
   * Method openFavorite
   *
   * @description
   * `Open` on a favorite saved view: shows its list with the view applied.
   *
   * @param {Favorite} favorite - The favorite.
   */
  protected openFavorite(favorite: Favorite): void {
    void this.router.navigate(this.favoriteLink(favorite), {
      queryParams: this.favoriteQuery(favorite),
    });
  }

  /**
   * Method newTask
   *
   * @description
   * `New task`: opens Task's create dialog in the list.
   *
   * @param {TaskList} list - The list.
   */
  protected newTask(list: TaskList): void {
    this.taskCreate.open({ listId: list.id });
  }

  /**
   * Method editList
   *
   * @description
   * `Edit the list` or `Edit the sprint`.
   *
   * @param {TaskList} list - The list.
   */
  protected editList(list: TaskList): void {
    this.navigation.openDialog({
      kind: 'list',
      spaceId: list.spaceId,
      list,
      sprint: list.sprint !== null,
    });
  }

  /**
   * Method toggleListFavorite
   *
   * @description
   * `Add to favorites` or `Remove from favorites` on a list.
   *
   * @param {TaskList} list - The list.
   */
  protected async toggleListFavorite(list: TaskList): Promise<void> {
    const on: boolean = !this.isFavoriteList(list);
    if (!(await this.navigation.setFavorite('list', list.id, list.name, on))) {
      this.toasts.error($localize`:@@spaces.favorite.failed:The favorites could not be changed`);
      return;
    }
    this.toasts.show(
      on
        ? $localize`:@@spaces.favorite.added:Added to favorites`
        : $localize`:@@spaces.favorite.removed:Removed from favorites`,
      { description: list.name },
    );
  }

  /**
   * Method copyListLink
   *
   * @description
   * `Copy the link` of a list.
   *
   * @param {TaskList} list - The list.
   */
  protected async copyListLink(list: TaskList): Promise<void> {
    const view: Window | null = this.document.defaultView;
    const link: string = this.links.absolute(`/${this.slug()}/l/${list.id}`);
    try {
      await view?.navigator.clipboard.writeText(link);
      this.toasts.show($localize`:@@spaces.list.link-copied:List link copied`, {
        description: link,
      });
    } catch {
      this.toasts.error($localize`:@@spaces.list.link-failed:The link could not be copied`, {
        description: link,
      });
    }
  }

  /**
   * Method archiveList
   *
   * @description
   * `Archive`: takes the list out of the sidebar, opens its space when it was shown, and offers
   * `Undo`, which brings it back and shows it again.
   *
   * @param {TaskList} list - The list.
   */
  protected async archiveList(list: TaskList): Promise<void> {
    const shown: boolean = this.currentListId() === list.id;
    if (!(await this.navigation.archiveList(list))) {
      this.toasts.error($localize`:@@spaces.list.archive-failed:The list could not be archived`);
      return;
    }
    if (shown) void this.router.navigate(['/', this.slug(), 'spaces', list.spaceId]);
    const name: string = list.name;
    this.toasts.show(
      list.sprint
        ? $localize`:@@spaces.list.sprint-archived:Sprint archived`
        : $localize`:@@spaces.list.archived:List archived`,
      {
        description: $localize`:@@spaces.list.archived-text:${name}:name: no longer shows in the sidebar.`,
        undo: (): void => {
          void this.restoreList(list, shown);
        },
      },
    );
  }

  /**
   * Method openOverview
   *
   * @description
   * `Overview`: shows a space's overview with its lists open.
   *
   * @param {SpaceDetails} space - The space.
   */
  protected openOverview(space: SpaceDetails): void {
    this.navigation.setExpanded(space.id, true);
    void this.router.navigate(['/', this.slug(), 'spaces', space.id]);
  }

  /**
   * Method editSpace
   *
   * @description
   * `Edit the space`.
   *
   * @param {SpaceDetails} space - The space.
   */
  protected editSpace(space: SpaceDetails): void {
    this.navigation.openDialog({ kind: 'space', space });
  }

  /**
   * Method createSpace
   *
   * @description
   * `Create a space` and `New space`.
   */
  protected createSpace(): void {
    this.navigation.openDialog({ kind: 'space', space: null });
  }

  /**
   * Method newList
   *
   * @description
   * `New list` or `New sprint` in a space.
   *
   * @param {SpaceDetails} space - The space.
   * @param {boolean} sprint - Whether a sprint is proposed.
   */
  protected newList(space: SpaceDetails, sprint: boolean): void {
    this.navigation.openDialog({ kind: 'list', spaceId: space.id, list: null, sprint });
  }

  /**
   * Method toggleSpaceFavorite
   *
   * @description
   * `Add to favorite spaces` or `Remove from favorite spaces`.
   *
   * @param {SpaceDetails} space - The space.
   */
  protected async toggleSpaceFavorite(space: SpaceDetails): Promise<void> {
    const on: boolean = !this.isFavoriteSpace(space);
    if (!(await this.navigation.setFavorite('space', space.id, space.name, on))) {
      this.toasts.error($localize`:@@spaces.favorite.failed:The favorites could not be changed`);
      return;
    }
    this.toasts.show(
      on
        ? $localize`:@@spaces.favorite.space-added:Added to favorite spaces`
        : $localize`:@@spaces.favorite.space-removed:Removed from favorite spaces`,
      { description: space.name },
    );
  }

  /**
   * Method askDeleteSpace
   *
   * @description
   * `Delete the space`: asks for the typed name first.
   *
   * @param {SpaceDetails} space - The space.
   */
  protected askDeleteSpace(space: SpaceDetails): void {
    this.navigation.openDialog({ kind: 'delete-space', space });
  }

  /**
   * Method dialogOpenChanged
   *
   * @description
   * Closes the navigation's dialog when a dialog closes itself (Cancel, Escape, outside click).
   *
   * @param {boolean} open - Whether the dialog stays open.
   */
  protected dialogOpenChanged(open: boolean): void {
    if (!open) {
      this.prefixTaken.set(null);
      this.navigation.closeDialog();
    }
  }

  /**
   * Method saveSpace
   *
   * @description
   * Records the space dialog: `Space created` opens its first list, `Space updated` offers
   * `Undo`, which puts the previous settings back. A used prefix stays in the dialog with its
   * error.
   *
   * @param {SpaceDraft} draft - The dialog's values.
   */
  protected async saveSpace(draft: SpaceDraft): Promise<void> {
    const edited: SpaceDetails | null = this.spaceDialog()?.space ?? null;
    // The dialog and the organization this save started from: a late answer must not close a newer
    // dialog or navigate in another organization.
    const dialog: SpacesDialog | null = this.navigation.dialog();
    const slug: string = this.slug();
    const sameDialog: () => boolean = (): boolean =>
      this.navigation.dialog() === dialog && this.slug() === slug;
    this.pending.set(true);
    if (edited) {
      const recorded: SpaceDetails | 'prefix-taken' | null = await this.navigation.updateSpace(
        edited,
        draft,
      );
      if (!sameDialog()) {
        if (this.slug() === slug && recorded === null) {
          this.toasts.error($localize`:@@spaces.space.save-failed:The space could not be saved`);
        }
        return;
      }
      this.pending.set(false);
      if (recorded === 'prefix-taken') {
        this.prefixTaken.set(draft.prefix);
        return;
      }
      if (!recorded) {
        this.toasts.error($localize`:@@spaces.space.save-failed:The space could not be saved`);
        return;
      }
      this.dialogOpenChanged(false);
      this.toasts.show($localize`:@@spaces.space.updated:Space updated`, {
        description: recorded.name,
        undo: (): void => {
          void this.undoSpace(recorded, edited);
        },
      });
      return;
    }
    const created: SpaceCreationResult = await this.navigation.createSpace(draft);
    if (!sameDialog()) {
      if (this.slug() === slug && created && created !== 'prefix-taken') {
        const name: string = created.space.name;
        this.toasts.show($localize`:@@spaces.space.created:Space created`, {
          description: $localize`:@@spaces.space.created-text:${name}:name: · a first list is ready.`,
        });
      }
      return;
    }
    this.pending.set(false);
    if (created === 'prefix-taken') {
      this.prefixTaken.set(draft.prefix);
      return;
    }
    if (!created) {
      this.toasts.error($localize`:@@spaces.space.save-failed:The space could not be saved`);
      return;
    }
    this.dialogOpenChanged(false);
    const name: string = created.space.name;
    this.toasts.show($localize`:@@spaces.space.created:Space created`, {
      description: $localize`:@@spaces.space.created-text:${name}:name: · a first list is ready.`,
    });
    void this.router.navigate(['/', slug, 'l', created.firstList.id]);
  }

  /**
   * Method undoSpace
   *
   * @description
   * The `Undo` of `Space updated`: writes the previous settings back from the recorded version;
   * a refusal shows the failure toast.
   *
   * @param {SpaceDetails} recorded - The space as the change recorded it.
   * @param {SpaceDetails} previous - The space before the change.
   * @returns {Promise<void>} Resolves once handled.
   */
  private async undoSpace(recorded: SpaceDetails, previous: SpaceDetails): Promise<void> {
    const restored: SpaceDetails | 'prefix-taken' | null = await this.navigation.updateSpace(
      recorded,
      draftOfSpace(previous),
    );
    if (restored === null || restored === 'prefix-taken') {
      this.toasts.error($localize`:@@spaces.space.save-failed:The space could not be saved`);
    }
  }

  /**
   * Method undoList
   *
   * @description
   * The `Undo` of `List updated` or `Sprint updated`: writes the previous values back from the
   * recorded version; a refusal shows the failure toast.
   *
   * @param {TaskList} recorded - The list as the change recorded it.
   * @param {TaskList} previous - The list before the change.
   * @returns {Promise<void>} Resolves once handled.
   */
  private async undoList(recorded: TaskList, previous: TaskList): Promise<void> {
    if (!(await this.navigation.updateList(recorded, draftOfList(previous)))) {
      this.toasts.error($localize`:@@spaces.list.save-failed:The list could not be saved`);
    }
  }

  /**
   * Method saveList
   *
   * @description
   * Records the list dialog: a created list or sprint opens; a change offers `Undo`, which
   * puts the previous values back.
   *
   * @param {ListDraft} draft - The dialog's values.
   */
  protected async saveList(draft: ListDraft): Promise<void> {
    const request: Extract<SpacesDialog, { kind: 'list' }> | null = this.listDialog();
    if (!request) return;
    this.pending.set(true);
    const edited: TaskList | null = request.list;
    const recorded: TaskList | null = edited
      ? await this.navigation.updateList(edited, draft)
      : await this.navigation.createList(request.spaceId, draft);
    this.pending.set(false);
    if (!recorded) {
      this.toasts.error($localize`:@@spaces.list.save-failed:The list could not be saved`);
      return;
    }
    this.dialogOpenChanged(false);
    if (edited) {
      this.toasts.show(
        recorded.sprint
          ? $localize`:@@spaces.list.sprint-updated:Sprint updated`
          : $localize`:@@spaces.list.updated:List updated`,
        {
          description: recorded.name,
          undo: (): void => {
            void this.undoList(recorded, edited);
          },
        },
      );
      return;
    }
    this.toasts.show(
      recorded.sprint
        ? $localize`:@@spaces.list.sprint-created:Sprint created`
        : $localize`:@@spaces.list.created:List created`,
      { description: recorded.name },
    );
    this.openList(recorded);
  }

  /**
   * Method confirmDeleteSpace
   *
   * @description
   * Deletes the space once its name is typed, and leaves it for the home screen when it was
   * shown.
   *
   * @param {SpaceDetails} space - The space.
   */
  protected async confirmDeleteSpace(space: SpaceDetails): Promise<void> {
    const shownSpace: string | null = SPACE_PATH.exec(this.url())?.[1] ?? null;
    const listId: string | null = this.currentListId();
    const shown: boolean =
      shownSpace === space.id ||
      (listId !== null &&
        (this.spaces()
          .find((view: SidebarSpaceView): boolean => view.space.id === space.id)
          ?.lists.some((summary: ListSummary): boolean => summary.list.id === listId) ??
          false));
    const tasks: number = this.deleteSummary().tasks;
    this.pending.set(true);
    const deleted: boolean = await this.navigation.deleteSpace(space);
    this.pending.set(false);
    this.dialogOpenChanged(false);
    if (!deleted) {
      this.toasts.error($localize`:@@spaces.space.delete-failed:The space could not be deleted`);
      return;
    }
    const name: string = space.name;
    this.toasts.show($localize`:@@spaces.space.deleted:Space “${name}:name:” deleted`, {
      description:
        tasks > 1
          ? $localize`:@@spaces.list.deleted-text:${tasks}:count: tasks in the trash, restorable for 30 days.`
          : tasks === 1
            ? $localize`:@@spaces.list.deleted-text-one:1 task in the trash, restorable for 30 days.`
            : $localize`:@@spaces.list.deleted-empty:No task to move.`,
    });
    if (shown) void this.router.navigate(['/', this.slug()]);
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
    const all: readonly string[] = [
      ...new Set([
        ...this.dismissed(),
        ...this.allTips().map((tip: SidebarTip): string => tip.key),
      ]),
    ];
    this.dismissed.set(all);
    try {
      this.storage?.setItem(TIPS_STORAGE_KEY, JSON.stringify(all));
    } catch {
      return;
    }
  }

  /**
   * Method restoreList
   *
   * @description
   * The `Undo` of an archiving: brings the list back and shows it again when it was shown.
   *
   * @param {TaskList} list - The archived list.
   * @param {boolean} shown - Whether it was shown when archived.
   * @returns {Promise<void>} Resolves once handled.
   */
  private async restoreList(list: TaskList, shown: boolean): Promise<void> {
    if (!(await this.navigation.unarchiveList(list.id))) {
      this.toasts.error(
        $localize`:@@spaces.list.unarchive-failed:The list could not be brought back`,
      );
      return;
    }
    if (shown) this.openList(list);
  }
  // #endregion
}
