import {
  computed,
  inject,
  resource,
  type ResourceRef,
  type Signal,
  type Type,
} from '@angular/core';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { concatMap, EMPTY, from, type Observable, pipe, Subject } from 'rxjs';

import { hasProblemCode } from '@core/api';
import { type CreatedTask, TaskCreate } from '@features/task';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { ListsApi } from '../../data-access/services/lists-api/lists-api.service';
import { SidebarApi } from '../../data-access/services/sidebar-api/sidebar-api.service';
import { SpacesApi } from '../../data-access/services/spaces-api/spaces-api.service';
import type { Favorite, FavoriteKind } from '../../models/favorite/favorite.interface';
import type { SpaceDetails, SpaceDraft } from '../../models/space/space.interface';
import type {
  ListDraft,
  ListSummary,
  SpaceOverview,
  TaskList,
} from '../../models/task-list/task-list.interface';
import { isWithin, todayIso } from '../../utils/calendar-date/calendar-date.util';

/**
 * Constant OVERVIEW_PAGE_TIMEOUT_MS
 *
 * @description
 * Longest wait for each page of a space overview, in milliseconds: a stalled page must neither hold
 * back the batch of four spaces it is read with, nor the creations read one after the other, while
 * a large space read page after page keeps all the time it needs. A space whose page times out is
 * left out of the overviews, which offers its Retry.
 *
 * @type {number}
 */
const OVERVIEW_PAGE_TIMEOUT_MS: number = 10_000;

/**
 * Type Reloadable
 *
 * @description
 * What the store needs of a resource to read it again, or once more after the read in flight.
 *
 * @type {Pick<ResourceRef<unknown>, 'reload' | 'isLoading' | 'status'>}
 */
type Reloadable = Pick<ResourceRef<unknown>, 'reload' | 'isLoading' | 'status'>;

/**
 * Interface OverviewReadOrder
 *
 * @description
 * The order in which space overview reads begin, so a reader of a space overview can tell whether
 * a value the sidebar holds comes from a read begun before or after its own.
 */
export interface OverviewReadOrder {
  // #region Methods
  /**
   * Method next
   *
   * @description
   * Takes the place of a read that begins now; every later read gets a higher number.
   *
   * @returns {number} The read's place in the order.
   */
  next(): number;

  /**
   * Method of
   *
   * @description
   * The place of the read that returned an overview the sidebar holds.
   *
   * @param {SpaceOverview} overview - The overview, as the sidebar holds it.
   * @returns {number | undefined} Its place, or undefined when no recorded read returned it.
   */
  of(overview: SpaceOverview): number | undefined;

  /**
   * Method record
   *
   * @description
   * Records the place of the read that returned an overview.
   *
   * @param {SpaceOverview} overview - The overview the read returned.
   * @param {number} order - The read's place from `next`.
   */
  record(overview: SpaceOverview, order: number): void;
  // #endregion
}

/**
 * Type SpacesDialog
 *
 * @description
 * The dialog of the spaces navigation open in the workspace: the space dialog (create when
 * `space` is null), the list dialog (create in `spaceId` when `list` is null, as a sprint when
 * `sprint`) or the confirmation of a space deletion. The sidebar hosts them, so the rail, the
 * space overview and the list page open them through the store.
 *
 * @type {{ kind: 'space'; space: SpaceDetails | null } | { kind: 'list'; spaceId: string; list: TaskList | null; sprint: boolean } | { kind: 'delete-space'; space: SpaceDetails }}
 */
export type SpacesDialog =
  | { readonly kind: 'space'; readonly space: SpaceDetails | null }
  | {
      readonly kind: 'list';
      readonly spaceId: string;
      readonly list: TaskList | null;
      readonly sprint: boolean;
    }
  | { readonly kind: 'delete-space'; readonly space: SpaceDetails };

/**
 * Type SpaceCreationResult
 *
 * @description
 * A created space with its first list, `'prefix-taken'` when another space uses or used the
 * prefix (`409 space.prefix-taken`), or null for any other failure.
 *
 * @type {{ space: SpaceDetails; firstList: TaskList } | 'prefix-taken' | null}
 */
export type SpaceCreationResult =
  { readonly space: SpaceDetails; readonly firstList: TaskList } | 'prefix-taken' | null;

/**
 * Interface SpacesNavigationState
 *
 * @description
 * The organization the navigation belongs to, the open spaces, the open dialog and the read
 * revisions.
 */
interface SpacesNavigationState {
  // #region Properties
  /**
   * Property dialog
   *
   * @description
   * The dialog open, or null.
   *
   * @type {SpacesDialog | null}
   * @readonly
   */
  readonly dialog: SpacesDialog | null;

  /**
   * Property lastSpacesUrl
   *
   * @description
   * The last space overview or list shown in this tab, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly lastSpacesUrl: string | null;

  /**
   * Property expanded
   *
   * @description
   * Spaces whose lists show, by id.
   *
   * @type {Readonly<Record<string, boolean>>}
   * @readonly
   */
  readonly expanded: Readonly<Record<string, boolean>>;

  /**
   * Property _organizationId
   *
   * @description
   * Organization id the reads belong to, or null before the first one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _organizationId: string | null;
  // #endregion
}

/**
 * Interface SpacesNavigationStoreInstance
 *
 * @description
 * The spaces of the sidebar, their lists and counts, the current sprint and the favorites.
 */
interface SpacesNavigationStoreInstance {
  // #region Properties
  /**
   * Property expanded
   *
   * @description
   * Spaces whose lists show, by id.
   *
   * @type {Signal<Readonly<Record<string, boolean>>>}
   * @readonly
   */
  readonly expanded: Signal<Readonly<Record<string, boolean>>>;

  /**
   * Property spaces
   *
   * @description
   * The spaces the caller sees; idle until an organization is followed.
   *
   * @type {ResourceRef<readonly SpaceDetails[] | undefined>}
   * @readonly
   */
  readonly spaces: ResourceRef<readonly SpaceDetails[] | undefined>;

  /**
   * Property overviews
   *
   * @description
   * The lists and counts of each space by id; a space whose read failed is absent.
   *
   * @type {ResourceRef<Readonly<Record<string, SpaceOverview>> | undefined>}
   * @readonly
   */
  readonly overviews: ResourceRef<Readonly<Record<string, SpaceOverview>> | undefined>;

  /**
   * Property overviewOrder
   *
   * @description
   * The order of the space overview reads, which the space overview page compares with its own.
   *
   * @type {OverviewReadOrder}
   * @readonly
   */
  readonly overviewOrder: OverviewReadOrder;

  /**
   * Property favorites
   *
   * @description
   * The caller's favorites, in insertion order.
   *
   * @type {ResourceRef<readonly Favorite[] | undefined>}
   * @readonly
   */
  readonly favorites: ResourceRef<readonly Favorite[] | undefined>;

  /**
   * Property currentSprint
   *
   * @description
   * The first sprint, in sidebar order, whose dates hold the caller's today, or null.
   *
   * @type {Signal<ListSummary | null>}
   * @readonly
   */
  readonly currentSprint: Signal<ListSummary | null>;

  /**
   * Property dialog
   *
   * @description
   * The dialog open, which the sidebar renders, or null.
   *
   * @type {Signal<SpacesDialog | null>}
   * @readonly
   */
  readonly dialog: Signal<SpacesDialog | null>;

  /**
   * Property lastSpacesUrl
   *
   * @description
   * The last space overview or list shown in this tab for the organization followed, or null;
   * `Spaces` of the rail opens it again.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly lastSpacesUrl: Signal<string | null>;

  /**
   * Property trashCount
   *
   * @description
   * Entries of the trash the caller may restore (`Trash`).
   *
   * @type {ResourceRef<number | undefined>}
   * @readonly
   */
  readonly trashCount: ResourceRef<number | undefined>;

  /**
   * Property archiveCount
   *
   * @description
   * Archived lists and task roots the caller sees (`Archives`).
   *
   * @type {ResourceRef<number | undefined>}
   * @readonly
   */
  readonly archiveCount: ResourceRef<number | undefined>;

  /**
   * Property listEdited
   *
   * @description
   * Emits each list as recorded after a change through the list dialog or the undo of its
   * archiving, so the list page shows it without reading it again.
   *
   * @type {Observable<TaskList>}
   * @readonly
   */
  readonly listEdited: Observable<TaskList>;

  /**
   * Property spaceEdited
   *
   * @description
   * Emits each space as recorded after a change through the space dialog.
   *
   * @type {Observable<SpaceDetails>}
   * @readonly
   */
  readonly spaceEdited: Observable<SpaceDetails>;
  // #endregion

  // #region Methods
  /**
   * Method follow
   *
   * @description
   * Follows the committed organization; a switch clears the open spaces, forgets the creations
   * being tried and reads again.
   *
   * @param {Signal<string> | string} organizationId - Organization id.
   */
  follow(organizationId: Signal<string> | string): void;

  /**
   * Method offerOverview
   *
   * @description
   * Gives the sidebar a space overview read elsewhere, at its place in the read order. It
   * replaces the sidebar's value of the space only when that value comes from an older read, at
   * once or when the sidebar read in flight ends; a space of another organization is ignored.
   *
   * @param {SpaceOverview} overview - The overview read.
   * @param {number} order - The read's place, from `overviewOrder.next()` when it began.
   */
  offerOverview(overview: SpaceOverview, order: number): void;

  /**
   * Method setExpanded
   *
   * @description
   * Opens or closes a space's lists.
   *
   * @param {string} spaceId - The space.
   * @param {boolean} open - Whether its lists show.
   */
  setExpanded(spaceId: string, open: boolean): void;

  /**
   * Method setAllExpanded
   *
   * @description
   * Opens every space (`Expand all spaces`) or closes them all.
   *
   * @param {boolean} open - Whether their lists show.
   */
  setAllExpanded(open: boolean): void;

  /**
   * Method spaceById
   *
   * @description
   * The space of the sidebar with this id, once the spaces are read.
   *
   * @param {string} spaceId - The space.
   * @returns {SpaceDetails | undefined} The space.
   */
  spaceById(spaceId: string): SpaceDetails | undefined;

  /**
   * Method openDialog
   *
   * @description
   * Opens a dialog of the navigation; it replaces the one open.
   *
   * @param {SpacesDialog} dialog - The dialog.
   */
  openDialog(dialog: SpacesDialog): void;

  /**
   * Method closeDialog
   *
   * @description
   * Closes the dialog open; the next creation is a new one (a new idempotency key).
   */
  closeDialog(): void;

  /**
   * Method rememberSpacesUrl
   *
   * @description
   * Remembers the space overview or list shown, for `Spaces` of the rail.
   *
   * @param {string} url - Its address.
   */
  rememberSpacesUrl(url: string): void;

  /**
   * Method createSpace
   *
   * @description
   * Creates a space with its first list, then reads the spaces again with the new space open.
   * A retry of the same draft in the same organization reuses its idempotency key, until the
   * dialog closes.
   *
   * @param {SpaceDraft} draft - The dialog's values.
   * @returns {Promise<SpaceCreationResult>} The space and its list, or why it failed.
   */
  createSpace(draft: SpaceDraft): Promise<SpaceCreationResult>;

  /**
   * Method updateSpace
   *
   * @description
   * Shows the new settings of a space at once, then records them; a refusal restores the space
   * as it was. The recorded space is emitted by `spaceEdited`.
   *
   * @param {SpaceDetails} space - The space as shown.
   * @param {SpaceDraft} draft - The new settings.
   * @returns {Promise<SpaceDetails | 'prefix-taken' | null>} The space as recorded,
   * `'prefix-taken'` when the prefix is used, or null for another failure.
   */
  updateSpace(
    space: SpaceDetails,
    draft: SpaceDraft,
  ): Promise<SpaceDetails | 'prefix-taken' | null>;

  /**
   * Method deleteSpace
   *
   * @description
   * Removes a space from the sidebar at once, then deletes it; a refusal puts it back in place.
   *
   * @param {SpaceDetails} space - The space.
   * @returns {Promise<boolean>} Whether the gateway deleted it.
   */
  deleteSpace(space: SpaceDetails): Promise<boolean>;

  /**
   * Method createList
   *
   * @description
   * Creates a list or a sprint in a space, then reads the overviews again. A retry of the same
   * draft in the same space and organization reuses its idempotency key, until the dialog closes.
   *
   * @param {string} spaceId - The space.
   * @param {ListDraft} draft - The dialog's values.
   * @returns {Promise<TaskList | null>} The list as recorded, or null when refused.
   */
  createList(spaceId: string, draft: ListDraft): Promise<TaskList | null>;

  /**
   * Method updateList
   *
   * @description
   * Shows the new name and look of a list in the sidebar at once, then records them; a refusal
   * restores it. The recorded list is emitted by `listEdited`.
   *
   * @param {TaskList} list - The list as shown, whose version is sent.
   * @param {ListDraft} draft - The new values.
   * @returns {Promise<TaskList | null>} The list as recorded, or null when refused.
   */
  updateList(list: TaskList, draft: ListDraft): Promise<TaskList | null>;

  /**
   * Method archiveList
   *
   * @description
   * Removes a list from the sidebar at once, then archives it; a refusal puts it back.
   *
   * @param {TaskList} list - The list.
   * @returns {Promise<boolean>} Whether the gateway archived it.
   */
  archiveList(list: TaskList): Promise<boolean>;

  /**
   * Method unarchiveList
   *
   * @description
   * Brings an archived list back (the undo of `List archived`), then reads the sidebar again.
   *
   * @param {string} listId - The list.
   * @returns {Promise<TaskList | null>} The list as recorded, or null when refused.
   */
  unarchiveList(listId: string): Promise<TaskList | null>;

  /**
   * Method removeList
   *
   * @description
   * Deletes a list from the version shown (the undo of `List duplicated`), then reads the
   * sidebar again.
   *
   * @param {TaskList} list - The list.
   * @returns {Promise<boolean>} Whether the gateway deleted it.
   */
  removeList(list: TaskList): Promise<boolean>;

  /**
   * Method refresh
   *
   * @description
   * Reads the spaces and their counts again, after a write that changed them: the overviews
   * follow the new spaces, so they are read again directly only when the spaces could not be.
   */
  refresh(): void;

  /**
   * Method refreshFavorites
   *
   * @description
   * Reads the favorites again, or once more after the read in flight, after another feature's
   * write that may bring a favorite target back (a restored or unarchived list).
   */
  refreshFavorites(): void;

  /**
   * Method refreshCounts
   *
   * @description
   * Reads the trash and archive counts again, each once more after its read in flight, so a
   * write during their first read is never missed.
   */
  refreshCounts(): void;

  /**
   * Method favoriteOf
   *
   * @description
   * The favorite pointing to a target, if any.
   *
   * @param {FavoriteKind} kind - Target kind.
   * @param {string} targetId - Target identifier.
   * @returns {Favorite | undefined} The favorite.
   */
  favoriteOf(kind: FavoriteKind, targetId: string): Favorite | undefined;

  /**
   * Method setFavorite
   *
   * @description
   * Adds or removes a favorite at once, then records it; a refusal restores the previous list.
   *
   * @param {FavoriteKind} kind - Target kind.
   * @param {string} targetId - Target identifier.
   * @param {string} name - Target name, shown until the gateway answers.
   * @param {boolean} on - Whether the target becomes a favorite.
   * @returns {Promise<boolean>} Whether the gateway recorded it.
   */
  setFavorite(kind: FavoriteKind, targetId: string, name: string, on: boolean): Promise<boolean>;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * No organization followed, every space closed.
 *
 * @type {SpacesNavigationState}
 */
const initialState: SpacesNavigationState = {
  dialog: null,
  lastSpacesUrl: null,
  expanded: {},
  _organizationId: null,
};

/**
 * Function createSpacesNavigationStore
 *
 * @description
 * Creates the navigation store.
 *
 * @returns {Type<SpacesNavigationStoreInstance>} Injectable store constructor.
 */
function createSpacesNavigationStore(): Type<SpacesNavigationStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps((store) => {
      const api: SpacesApi = inject(SpacesApi);
      const spaces: ResourceRef<readonly SpaceDetails[] | undefined> = resource({
        params: () => {
          const organizationId: string | null = store._organizationId();
          return organizationId === null ? undefined : { organizationId };
        },
        loader: ({ abortSignal }: { abortSignal: AbortSignal }): Promise<readonly SpaceDetails[]> =>
          api.spaces(abortSignal),
      });
      const readOrders: WeakMap<SpaceOverview, number> = new WeakMap<SpaceOverview, number>();
      // The place of the newest read of each space that landed, whoever read it.
      const landed: Map<string, number> = new Map<string, number>();
      // A read of a space offered by a reader of a space overview, kept while no newer read of
      // that space has landed, which a sidebar read begun before it never replaces.
      const offered: Map<string, { overview: SpaceOverview; order: number }> = new Map<
        string,
        { overview: SpaceOverview; order: number }
      >();
      let lastOrder: number = 0;
      const overviewOrder: OverviewReadOrder = {
        next: (): number => ++lastOrder,
        of: (overview: SpaceOverview): number | undefined => readOrders.get(overview),
        record: (overview: SpaceOverview, order: number): void => {
          readOrders.set(overview, order);
          if (order > (landed.get(overview.spaceId) ?? 0)) landed.set(overview.spaceId, order);
          const kept: { overview: SpaceOverview; order: number } | undefined = offered.get(
            overview.spaceId,
          );
          if (kept !== undefined && kept.order < order) offered.delete(overview.spaceId);
        },
      };
      const counts: SidebarApi = inject(SidebarApi);
      const byOrganization: () => { organizationId: string } | undefined = () => {
        const organizationId: string | null = store._organizationId();
        return organizationId === null ? undefined : { organizationId };
      };
      const listEdits: Subject<TaskList> = new Subject<TaskList>();
      const spaceEdits: Subject<SpaceDetails> = new Subject<SpaceDetails>();
      return {
        _api: api,
        _lists: inject(ListsApi),
        _listEdits: listEdits,
        _spaceEdits: spaceEdits,
        listEdited: listEdits.asObservable(),
        spaceEdited: spaceEdits.asObservable(),
        trashCount: resource({
          params: byOrganization,
          loader: ({ abortSignal }: { abortSignal: AbortSignal }): Promise<number> =>
            counts.trashCount(abortSignal),
        }),
        archiveCount: resource({
          params: byOrganization,
          loader: ({ abortSignal }: { abortSignal: AbortSignal }): Promise<number> =>
            counts.archiveCount(abortSignal),
        }),
        _workspace: inject(WORKSPACE_CONTEXT),
        _taskCreate: inject(TaskCreate),
        _landed: landed,
        _offered: offered,
        overviewOrder,
        spaces,
        overviews: resource({
          params: () =>
            spaces.hasValue()
              ? { ids: spaces.value().map((space: SpaceDetails): string => space.id) }
              : undefined,
          loader: async ({
            params,
            abortSignal,
          }: {
            params: { ids: readonly string[] };
            abortSignal: AbortSignal;
          }): Promise<Readonly<Record<string, SpaceOverview>>> => {
            const today: string = todayIso();
            const byId: Record<string, SpaceOverview> = {};
            for (let offset: number = 0; offset < params.ids.length; offset += 4) {
              abortSignal.throwIfAborted();
              const batch: readonly string[] = params.ids.slice(offset, offset + 4);
              const batchOrders: readonly number[] = batch.map((): number => overviewOrder.next());
              const settled: PromiseSettledResult<SpaceOverview>[] = await Promise.allSettled(
                batch.map((id: string): Promise<SpaceOverview> =>
                  api.overview(id, today, abortSignal, OVERVIEW_PAGE_TIMEOUT_MS),
                ),
              );
              settled.forEach(
                (result: PromiseSettledResult<SpaceOverview>, index: number): void => {
                  if (result.status !== 'fulfilled') return;
                  byId[result.value.spaceId] = result.value;
                  overviewOrder.record(result.value, batchOrders[index]);
                },
              );
            }
            for (const id of params.ids) {
              const newer: { overview: SpaceOverview; order: number } | undefined = offered.get(id);
              const read: number = id in byId ? (readOrders.get(byId[id]) ?? 0) : 0;
              if (newer !== undefined && newer.order > read) byId[id] = newer.overview;
            }
            return byId;
          },
        }),
        favorites: resource({
          params: () => {
            const organizationId: string | null = store._organizationId();
            return organizationId === null ? undefined : { organizationId };
          },
          loader: ({ abortSignal }: { abortSignal: AbortSignal }): Promise<readonly Favorite[]> =>
            api.favorites(abortSignal),
        }),
      };
    }),
    withComputed((store) => ({
      currentSprint: (): ListSummary | null => {
        if (!store.spaces.hasValue() || !store.overviews.hasValue()) return null;
        const today: string = todayIso();
        const overviews: Readonly<Record<string, SpaceOverview>> = store.overviews.value();
        for (const space of store.spaces.value()) {
          const overview: SpaceOverview | undefined =
            space.id in overviews ? overviews[space.id] : undefined;
          const found: ListSummary | undefined = overview?.lists.find(
            (summary: ListSummary): boolean =>
              summary.list.sprint !== null &&
              isWithin(today, summary.list.sprint.startDate, summary.list.sprint.endDate),
          );
          if (found) return found;
        }
        return null;
      },
    })),
    withMethods((store) => {
      const currentFavorites: () => readonly Favorite[] = () =>
        store.favorites.hasValue() ? store.favorites.value() : [];
      let refreshQueued: boolean = false;
      let overviewRefreshQueued: boolean = false;
      const pending: Map<
        string,
        { desired: boolean; confirmed: Favorite | undefined; promise: Promise<boolean> }
      > = new Map<
        string,
        { desired: boolean; confirmed: Favorite | undefined; promise: Promise<boolean> }
      >();
      // Reads every overview again, or once more after the read in flight.
      const reloadOverviews: () => void = (): void => {
        if (!store.overviews.reload() && store.overviews.isLoading()) overviewRefreshQueued = true;
      };
      // Reads the spaces again, or once more after the read in flight; the overviews follow the
      // new spaces (their params change), so they are read directly only when the spaces are not.
      const refresh: () => void = (): void => {
        if (store.spaces.reload()) return;
        if (store.spaces.isLoading()) {
          refreshQueued = true;
          return;
        }
        reloadOverviews();
      };
      // Resources to read once more when their read in flight ends.
      const queuedReloads: Set<Reloadable> = new Set<Reloadable>();
      // Reads a resource again, or once more after the read in flight.
      const reloadOrQueue: (target: Reloadable) => void = (target: Reloadable): void => {
        if (!target.reload() && target.isLoading()) queuedReloads.add(target);
      };
      const currentSpaces: () => readonly SpaceDetails[] = () =>
        store.spaces.hasValue() ? store.spaces.value() : [];
      // The idempotency keys of the space and list creations being tried, each reused while its
      // organization and draft (and space, for a list) stay the same.
      let creationKey: { fingerprint: string; key: string } | null = null;
      let listCreationKey: { fingerprint: string; key: string } | null = null;
      // Puts a space in place of the one with this id, unless the shown one was replaced since.
      const replaceSpace: (
        spaceId: string,
        space: SpaceDetails,
        expected?: SpaceDetails,
      ) => void = (spaceId: string, space: SpaceDetails, expected?: SpaceDetails): void => {
        if (!store.spaces.hasValue()) return;
        const current: readonly SpaceDetails[] = store.spaces.value();
        const held: SpaceDetails | undefined = current.find(
          (item: SpaceDetails): boolean => item.id === spaceId,
        );
        if (!held || (expected !== undefined && held !== expected)) return;
        store.spaces.set(
          current.map((item: SpaceDetails): SpaceDetails => (item.id === spaceId ? space : item)),
        );
      };
      // Sets the overviews, keeping the read order of each space whose value is carried over.
      const setOverviews: (
        next: Readonly<Record<string, SpaceOverview>>,
        from: Readonly<Record<string, SpaceOverview>>,
      ) => void = (
        next: Readonly<Record<string, SpaceOverview>>,
        from: Readonly<Record<string, SpaceOverview>>,
      ): void => {
        for (const [spaceId, overview] of Object.entries(next)) {
          const order: number | undefined =
            spaceId in from ? store.overviewOrder.of(from[spaceId]) : undefined;
          if (overview !== from[spaceId] && order !== undefined) {
            store.overviewOrder.record(overview, order);
          }
        }
        store.overviews.set(next);
      };
      // Puts a list in place of the one with its id, unless the shown one was replaced since.
      const replaceList: (list: TaskList, expected?: TaskList) => void = (
        list: TaskList,
        expected?: TaskList,
      ): void => {
        if (store.overviews.isLoading() || !store.overviews.hasValue()) return;
        const current: Readonly<Record<string, SpaceOverview>> = store.overviews.value();
        const overview: SpaceOverview | undefined =
          list.spaceId in current ? current[list.spaceId] : undefined;
        const held: ListSummary | undefined = overview?.lists.find(
          (summary: ListSummary): boolean => summary.list.id === list.id,
        );
        if (!overview || !held || (expected !== undefined && held.list !== expected)) return;
        setOverviews(
          {
            ...current,
            [list.spaceId]: {
              ...overview,
              lists: overview.lists.map((summary: ListSummary): ListSummary =>
                summary === held ? { ...summary, list } : summary,
              ),
            },
          },
          current,
        );
      };
      // Takes a list out of the sidebar; the returned function puts it back where it was.
      const withoutList: (listId: string) => (() => void) | null = (
        listId: string,
      ): (() => void) | null => {
        if (store.overviews.isLoading() || !store.overviews.hasValue()) return null;
        const current: Readonly<Record<string, SpaceOverview>> = store.overviews.value();
        const overview: SpaceOverview | undefined = Object.values(current).find(
          (item: SpaceOverview): boolean =>
            item.lists.some((summary: ListSummary): boolean => summary.list.id === listId),
        );
        if (!overview) return null;
        const index: number = overview.lists.findIndex(
          (summary: ListSummary): boolean => summary.list.id === listId,
        );
        const removed: ListSummary = overview.lists[index];
        const lighter: SpaceOverview = {
          ...overview,
          taskCount: Math.max(0, overview.taskCount - removed.counts.total),
          lists: overview.lists.filter((summary: ListSummary): boolean => summary !== removed),
        };
        setOverviews({ ...current, [overview.spaceId]: lighter }, current);
        return (): void => {
          if (store.overviews.isLoading() || !store.overviews.hasValue()) return;
          const now: Readonly<Record<string, SpaceOverview>> = store.overviews.value();
          if (now[overview.spaceId] !== lighter) return;
          setOverviews(
            {
              ...now,
              [overview.spaceId]: {
                ...lighter,
                taskCount: overview.taskCount,
                lists: [...lighter.lists.slice(0, index), removed, ...lighter.lists.slice(index)],
              },
            },
            now,
          );
        };
      };
      return {
        _flushRefresh: signalMethod<string>((status: string): void => {
          if (status !== 'loading' && status !== 'reloading' && refreshQueued) {
            refreshQueued = false;
            store.spaces.reload();
          }
        }),
        _flushQueued: signalMethod<{ readonly target: Reloadable; readonly status: string }>(
          ({ target, status }: { readonly target: Reloadable; readonly status: string }): void => {
            if (status !== 'loading' && status !== 'reloading' && queuedReloads.delete(target)) {
              target.reload();
            }
          },
        ),
        refreshFavorites(): void {
          reloadOrQueue(store.favorites);
        },
        refreshCounts(): void {
          reloadOrQueue(store.trashCount);
          reloadOrQueue(store.archiveCount);
        },
        _countCreations: rxMethod<CreatedTask>(
          pipe(
            concatMap((task: CreatedTask): Observable<SpaceOverview> => {
              const organizationId: string | null = store._organizationId();
              const before: Readonly<Record<string, SpaceOverview>> | undefined =
                !store.overviews.isLoading() && store.overviews.hasValue()
                  ? store.overviews.value()
                  : undefined;
              const spaceId: string | undefined =
                before === undefined
                  ? undefined
                  : Object.values(before).find((overview: SpaceOverview): boolean =>
                      overview.lists.some(
                        (summary: ListSummary): boolean => summary.list.id === task.listId,
                      ),
                    )?.spaceId;
              if (before === undefined || spaceId === undefined) {
                reloadOverviews();
                return EMPTY;
              }
              const order: number = store.overviewOrder.next();
              return from(
                store._api.overview(spaceId, todayIso(), undefined, OVERVIEW_PAGE_TIMEOUT_MS),
              ).pipe(
                tapResponse({
                  next: (overview: SpaceOverview): void => {
                    if (store._organizationId() !== organizationId) return;
                    store.overviewOrder.record(overview, order);
                    if (
                      store.overviews.isLoading() ||
                      !store.overviews.hasValue() ||
                      store.overviews.value() !== before
                    ) {
                      reloadOverviews();
                    } else {
                      store.overviews.set({ ...before, [spaceId]: overview });
                    }
                  },
                  error: (): void => {
                    if (store._organizationId() === organizationId) reloadOverviews();
                  },
                }),
              );
            }),
          ),
        ),
        _flushOverviews: signalMethod<string>((status: string): void => {
          if (status !== 'loading' && status !== 'reloading' && overviewRefreshQueued) {
            overviewRefreshQueued = false;
            store.overviews.reload();
          }
        }),
        follow: signalMethod<string>((organizationId: string): void => {
          if (organizationId === store._organizationId()) return;
          creationKey = null;
          listCreationKey = null;
          store._offered.clear();
          store._landed.clear();
          patchState(store, {
            _organizationId: organizationId,
            dialog: null,
            lastSpacesUrl: null,
            expanded: {},
          });
        }),
        offerOverview(overview: SpaceOverview, order: number): void {
          // A newer read of the space already landed, offered or not.
          if ((store._landed.get(overview.spaceId) ?? 0) > order) return;
          store.overviewOrder.record(overview, order);
          store._offered.set(overview.spaceId, { overview, order });
          // A read in flight takes the offered value when it ends.
          if (store.overviews.isLoading() || !store.overviews.hasValue()) return;
          if (
            !store.spaces.hasValue() ||
            !store.spaces
              .value()
              .some((space: SpaceDetails): boolean => space.id === overview.spaceId)
          ) {
            return;
          }
          const current: Readonly<Record<string, SpaceOverview>> = store.overviews.value();
          const held: SpaceOverview | undefined =
            overview.spaceId in current ? current[overview.spaceId] : undefined;
          if (held !== undefined && (store.overviewOrder.of(held) ?? 0) >= order) return;
          store.overviews.set({ ...current, [overview.spaceId]: overview });
        },
        setExpanded(spaceId: string, open: boolean): void {
          patchState(store, { expanded: { ...store.expanded(), [spaceId]: open } });
        },
        setAllExpanded(open: boolean): void {
          patchState(store, {
            expanded: open
              ? Object.fromEntries(currentSpaces().map((space: SpaceDetails) => [space.id, true]))
              : {},
          });
        },
        spaceById(spaceId: string): SpaceDetails | undefined {
          return currentSpaces().find((space: SpaceDetails): boolean => space.id === spaceId);
        },
        openDialog(dialog: SpacesDialog): void {
          patchState(store, { dialog });
        },
        closeDialog(): void {
          creationKey = null;
          listCreationKey = null;
          patchState(store, { dialog: null });
        },
        rememberSpacesUrl(url: string): void {
          if (url !== store.lastSpacesUrl()) patchState(store, { lastSpacesUrl: url });
        },
        async createSpace(draft: SpaceDraft): Promise<SpaceCreationResult> {
          const organizationId: string | null = store._organizationId();
          const fingerprint: string = JSON.stringify([organizationId, draft]);
          if (creationKey?.fingerprint !== fingerprint) {
            creationKey = { fingerprint, key: crypto.randomUUID() };
          }
          try {
            const created: { space: SpaceDetails; firstList: TaskList } =
              await store._api.createSpace(draft, creationKey.key);
            creationKey = null;
            if (store._organizationId() === organizationId) {
              patchState(store, { expanded: { ...store.expanded(), [created.space.id]: true } });
              refresh();
            }
            return created;
          } catch (error: unknown) {
            if (hasProblemCode(error, 'space.prefix-taken')) {
              creationKey = null;
              return 'prefix-taken';
            }
            return null;
          }
        },
        async updateSpace(
          space: SpaceDetails,
          draft: SpaceDraft,
        ): Promise<SpaceDetails | 'prefix-taken' | null> {
          const shown: SpaceDetails = { ...space, ...draft };
          replaceSpace(space.id, shown);
          try {
            const recorded: SpaceDetails = await store._api.updateSpace(space, draft);
            replaceSpace(space.id, recorded, shown);
            store._spaceEdits.next(recorded);
            return recorded;
          } catch (error: unknown) {
            replaceSpace(space.id, space, shown);
            return hasProblemCode(error, 'space.prefix-taken') ? 'prefix-taken' : null;
          }
        },
        async deleteSpace(space: SpaceDetails): Promise<boolean> {
          const organizationId: string | null = store._organizationId();
          const before: readonly SpaceDetails[] = currentSpaces();
          const index: number = before.findIndex((item: SpaceDetails) => item.id === space.id);
          if (index >= 0 && store.spaces.hasValue()) {
            store.spaces.set(before.filter((item: SpaceDetails): boolean => item.id !== space.id));
          }
          try {
            await store._api.deleteSpace(space.id);
            if (store._organizationId() === organizationId) {
              store.favorites.reload();
              store.trashCount.reload();
            }
            return true;
          } catch {
            const current: readonly SpaceDetails[] = currentSpaces();
            if (
              index >= 0 &&
              store._organizationId() === organizationId &&
              store.spaces.hasValue() &&
              !current.some((item: SpaceDetails): boolean => item.id === space.id)
            ) {
              store.spaces.set([...current.slice(0, index), space, ...current.slice(index)]);
            }
            return false;
          }
        },
        async createList(spaceId: string, draft: ListDraft): Promise<TaskList | null> {
          const fingerprint: string = JSON.stringify([store._organizationId(), spaceId, draft]);
          if (listCreationKey?.fingerprint !== fingerprint) {
            listCreationKey = { fingerprint, key: crypto.randomUUID() };
          }
          const attempt: { fingerprint: string; key: string } = listCreationKey;
          try {
            const created: TaskList = await store._lists.create(spaceId, draft, attempt.key);
            if (listCreationKey === attempt) listCreationKey = null;
            patchState(store, { expanded: { ...store.expanded(), [spaceId]: true } });
            reloadOverviews();
            return created;
          } catch {
            return null;
          }
        },
        async updateList(list: TaskList, draft: ListDraft): Promise<TaskList | null> {
          const shown: TaskList = { ...list, ...draft };
          replaceList(shown);
          try {
            const recorded: TaskList = await store._lists.update(list, draft);
            replaceList(recorded, shown);
            store._listEdits.next(recorded);
            return recorded;
          } catch {
            replaceList(list, shown);
            return null;
          }
        },
        async archiveList(list: TaskList): Promise<boolean> {
          const restore: (() => void) | null = withoutList(list.id);
          try {
            await store._lists.archive(list.id);
            store.archiveCount.reload();
            store.favorites.reload();
            return true;
          } catch {
            restore?.();
            return false;
          }
        },
        async unarchiveList(listId: string): Promise<TaskList | null> {
          try {
            const list: TaskList = await store._lists.unarchive(listId);
            store._listEdits.next(list);
            store.archiveCount.reload();
            reloadOverviews();
            return list;
          } catch {
            return null;
          }
        },
        async removeList(list: TaskList): Promise<boolean> {
          const restore: (() => void) | null = withoutList(list.id);
          try {
            await store._lists.remove(list);
            store.trashCount.reload();
            store.favorites.reload();
            return true;
          } catch {
            restore?.();
            return false;
          }
        },
        refresh,
        favoriteOf(kind: FavoriteKind, targetId: string): Favorite | undefined {
          return currentFavorites().find(
            (favorite: Favorite): boolean =>
              favorite.kind === kind && favorite.targetId === targetId,
          );
        },
        async setFavorite(
          kind: FavoriteKind,
          targetId: string,
          name: string,
          on: boolean,
        ): Promise<boolean> {
          const organizationId: string | null = store._organizationId();
          const key: string = `${organizationId ?? ''}:${kind}:${targetId}`;
          const existing: Favorite | undefined = currentFavorites().find(
            (favorite: Favorite): boolean =>
              favorite.kind === kind && favorite.targetId === targetId,
          );
          const active:
            | { desired: boolean; confirmed: Favorite | undefined; promise: Promise<boolean> }
            | undefined = pending.get(key);
          if (!active && on === (existing !== undefined)) return true;
          const pendingId: string = `pending:${kind}:${targetId}`;
          const show: (favorite: Favorite | undefined) => void = (
            favorite: Favorite | undefined,
          ): void => {
            if (organizationId !== store._organizationId()) return;
            const rest: readonly Favorite[] = currentFavorites().filter(
              (item: Favorite): boolean => item.kind !== kind || item.targetId !== targetId,
            );
            store.favorites.set(favorite ? [...rest, favorite] : rest);
          };
          if (active) {
            active.desired = on;
            show(
              on
                ? (active.confirmed ?? { id: pendingId, kind, targetId, name, listId: null })
                : undefined,
            );
            return active.promise;
          }
          const operation: {
            desired: boolean;
            confirmed: Favorite | undefined;
            promise: Promise<boolean>;
          } = { desired: on, confirmed: existing, promise: Promise.resolve(true) };
          pending.set(key, operation);
          show(on ? { id: pendingId, kind, targetId, name, listId: null } : undefined);
          operation.promise = (async (): Promise<boolean> => {
            try {
              while (operation.desired !== (operation.confirmed !== undefined)) {
                if (operation.desired) {
                  operation.confirmed = (await store._api.addFavorite(kind, targetId)) ?? undefined;
                  if (!operation.confirmed) throw new Error('Favorite was not created');
                } else if (operation.confirmed) {
                  await store._api.removeFavorite(operation.confirmed.id);
                  operation.confirmed = undefined;
                }
                show(operation.desired ? operation.confirmed : undefined);
              }
              return true;
            } catch {
              show(operation.confirmed);
              return false;
            } finally {
              pending.delete(key);
            }
          })();
          return operation.promise;
        },
      };
    }),
    withHooks({
      onInit(store): void {
        const organizationId: Signal<string> = computed(
          (): string => store._workspace.organization().id,
        );
        store.follow(organizationId);
        store._flushRefresh(store.spaces.status);
        for (const target of [store.favorites, store.trashCount, store.archiveCount]) {
          store._flushQueued(
            computed((): { readonly target: Reloadable; readonly status: string } => ({
              target,
              status: target.status(),
            })),
          );
        }
        store._flushOverviews(store.overviews.status);
        store._countCreations(store._taskCreate.created);
      },
    }),
  );
}

/**
 * Constant SpacesNavigationStore
 *
 * @description
 * The spaces navigation of a workspace, provided on `/:org` by `provideSpacesNavigation()` so the
 * sidebar, the sprint progress and the list screens share one read. Keyed on the organization
 * id committed by the workspace. A switch closes every space and reads again. At most four
 * overviews run at once; a failed read offers an inline retry. A task created from this tab reads
 * the overview of its list's space again, and only that one, one creation after the other, each
 * page given 10 s. When that space is unknown, the overviews are loading, they changed while the
 * space was read, or the read failed, every overview is read again instead (after the read in
 * flight): an answer never overwrites a newer one, no creation is missed, and a space that still
 * fails shows its Retry.
 * Favorites change optimistically; a refusal restores the previous list.
 *
 * @type {ReturnType<typeof createSpacesNavigationStore>}
 */
export const SpacesNavigationStore: ReturnType<typeof createSpacesNavigationStore> =
  createSpacesNavigationStore();
