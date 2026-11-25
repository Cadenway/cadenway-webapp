import { inject, resource, type ResourceRef, type Signal, type Type } from '@angular/core';
import {
  patchState,
  signalMethod,
  signalStore,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  catchError,
  debounceTime,
  EMPTY,
  filter,
  type Observable,
  pipe,
  switchMap,
  tap,
} from 'rxjs';

import { type RealtimeChange, RealtimeConnection } from '@core/realtime';

import { type ListExport, ListsApi } from '../../data-access/services/lists-api/lists-api.service';
import { SpacesApi } from '../../data-access/services/spaces-api/spaces-api.service';
import type { BulkAction, BulkSelection } from '../../models/bulk-action/bulk-action.interface';
import type { ListMember, ListMembers } from '../../models/list-member/list-member.interface';
import type {
  ListTaskQuery,
  ListViewConfig,
} from '../../models/list-view-config/list-view-config.interface';
import type {
  SavedView,
  SavedViewDraft,
  ViewLayout,
} from '../../models/saved-view/saved-view.interface';
import type { Space } from '../../models/space/space.interface';
import type { ListSummary, TaskList } from '../../models/task-list/task-list.interface';
import { todayIso } from '../../utils/calendar-date/calendar-date.util';

/**
 * Interface ListPageState
 *
 * @description
 * The list the page shows and the revision of its counts.
 */
interface ListPageState {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * The list of the route, or null before the page binds it.
   *
   * @type {string | null}
   * @readonly
   */
  readonly listId: string | null;
  // #endregion
}

/**
 * Interface ListPageStoreInstance
 *
 * @description
 * The open list, its space, counts, members, labels and saved views, and the writes of its header
 * and selection bar.
 */
export interface ListPageStoreInstance {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * The list of the route.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly listId: Signal<string | null>;

  /**
   * Property list
   *
   * @description
   * The primary read: a failure rejects with the typed route error.
   *
   * @type {ResourceRef<TaskList | undefined>}
   * @readonly
   */
  readonly list: ResourceRef<TaskList | undefined>;

  /**
   * Property space
   *
   * @description
   * The list's space, for the breadcrumb and its statuses.
   *
   * @type {ResourceRef<Space | undefined>}
   * @readonly
   */
  readonly space: ResourceRef<Space | undefined>;

  /**
   * Property counts
   *
   * @description
   * The counts of the description line, read again on a pushed change.
   *
   * @type {ResourceRef<ListSummary | undefined>}
   * @readonly
   */
  readonly counts: ResourceRef<ListSummary | undefined>;

  /**
   * Property milestoneCount
   *
   * @description
   * The milestones of the list, for « Jalons n ».
   *
   * @type {ResourceRef<number | undefined>}
   * @readonly
   */
  readonly milestoneCount: ResourceRef<number | undefined>;

  /**
   * Property members
   *
   * @description
   * The first people the list is shared with.
   *
   * @type {ResourceRef<ListMembers | undefined>}
   * @readonly
   */
  readonly members: ResourceRef<ListMembers | undefined>;

  /**
   * Property organizationMembers
   *
   * @description
   * The member directory for assignee filters and actions.
   *
   * @type {ResourceRef<readonly ListMember[] | undefined>}
   * @readonly
   */
  readonly organizationMembers: ResourceRef<readonly ListMember[] | undefined>;

  /**
   * Property labels
   *
   * @description
   * The labels the « Étiquette » filter offers.
   *
   * @type {ResourceRef<readonly string[] | undefined>}
   * @readonly
   */
  readonly labels: ResourceRef<readonly string[] | undefined>;

  /**
   * Property savedViews
   *
   * @description
   * The saved views of the list, in creation order.
   *
   * @type {ResourceRef<readonly SavedView[] | undefined>}
   * @readonly
   */
  readonly savedViews: ResourceRef<readonly SavedView[] | undefined>;
  // #endregion

  // #region Methods
  /**
   * Method load
   *
   * @description
   * Follows the list of the route.
   *
   * @param {Signal<string> | string} listId - The list.
   */
  load(listId: Signal<string> | string): void;

  /**
   * Method refreshCounts
   *
   * @description
   * Reads the counts and the milestone count again.
   */
  refreshCounts(): void;

  /**
   * Method rename
   *
   * @description
   * Shows the new name at once and records it; a refusal restores the previous name.
   *
   * @param {string} name - New name, trimmed and non-empty.
   * @returns {Promise<boolean>} Whether the gateway recorded it.
   */
  rename(name: string): Promise<boolean>;

  /**
   * Method duplicate
   *
   * @description
   * Copies the list with its tasks.
   *
   * @returns {Promise<{ list: TaskList; taskCount: number } | null>} The copy, or null when refused.
   */
  duplicate(): Promise<{ list: TaskList; taskCount: number } | null>;

  /**
   * Method exportCsv
   *
   * @description
   * Exports the tasks the view shows.
   *
   * @param {ListTaskQuery} query - The view's task query.
   * @returns {Promise<ListExport | null>} The file, or null when refused.
   */
  exportCsv(query: ListTaskQuery): Promise<ListExport | null>;

  /**
   * Method archive
   *
   * @description
   * Archives the list.
   *
   * @returns {Promise<boolean>} Whether the gateway recorded it.
   */
  archive(): Promise<boolean>;

  /**
   * Method remove
   *
   * @description
   * Deletes the list.
   *
   * @returns {Promise<boolean>} Whether the gateway recorded it.
   */
  remove(): Promise<boolean>;

  /**
   * Method createView
   *
   * @description
   * Saves the current view and appends it to the tabs.
   *
   * @param {SavedViewDraft} draft - Name and icon.
   * @param {ViewLayout} layout - Layout shown.
   * @param {ListViewConfig} config - Current configuration.
   * @returns {Promise<SavedView | null>} The saved view, or null when refused.
   */
  createView(
    draft: SavedViewDraft,
    layout: ViewLayout,
    config: ListViewConfig,
  ): Promise<SavedView | null>;

  /**
   * Method renameView
   *
   * @description
   * Renames a saved view and changes its icon.
   *
   * @param {SavedView} view - The view.
   * @param {SavedViewDraft} draft - New name and icon.
   * @returns {Promise<SavedView | null>} The renamed view, or null when refused.
   */
  renameView(view: SavedView, draft: SavedViewDraft): Promise<SavedView | null>;

  /**
   * Method saveViewSettings
   *
   * @description
   * Replaces a saved view's settings with the current configuration (« Enregistrer »).
   *
   * @param {SavedView} view - The view.
   * @param {ListViewConfig} config - Current configuration.
   * @returns {Promise<SavedView | null>} The updated view, or null when refused.
   */
  saveViewSettings(view: SavedView, config: ListViewConfig): Promise<SavedView | null>;

  /**
   * Method duplicateView
   *
   * @description
   * Copies a saved view after its source.
   *
   * @param {SavedView} view - The view.
   * @returns {Promise<SavedView | null>} The copy, or null when refused.
   */
  duplicateView(view: SavedView): Promise<SavedView | null>;

  /**
   * Method deleteView
   *
   * @description
   * Removes a saved view from the tabs at once and deletes it; a refusal puts it back.
   *
   * @param {SavedView} view - The view.
   * @returns {Promise<boolean>} Whether the gateway recorded it.
   */
  deleteView(view: SavedView): Promise<boolean>;

  /**
   * Method bulk
   *
   * @description
   * Applies an action of the selection bar, then reads the counts again.
   *
   * @param {readonly BulkSelection[]} selection - Selected tasks.
   * @param {BulkAction} action - Action.
   * @returns {Promise<number | null>} Rows affected, or null when refused (nothing changed).
   */
  bulk(selection: readonly BulkSelection[], action: BulkAction): Promise<number | null>;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * No list bound yet.
 *
 * @type {ListPageState}
 */
const initialState: ListPageState = { listId: null };

/**
 * Function createListPageStore
 *
 * @description
 * Creates the list page store.
 *
 * @returns {Type<ListPageStoreInstance>} Injectable store constructor.
 */
function createListPageStore(): Type<ListPageStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps((store) => {
      const api: ListsApi = inject(ListsApi);
      const spaces: SpacesApi = inject(SpacesApi);
      const byList: () => { listId: string } | undefined = () => {
        const listId: string | null = store.listId();
        return listId === null ? undefined : { listId };
      };
      const list: ResourceRef<TaskList | undefined> = resource({
        params: byList,
        loader: ({
          params,
          abortSignal,
        }: {
          params: { listId: string };
          abortSignal: AbortSignal;
        }): Promise<TaskList> => api.list(params.listId, abortSignal),
      });
      return {
        _api: api,
        _realtime: inject(RealtimeConnection, { optional: true }),
        list,
        space: resource({
          params: () => (list.hasValue() ? { spaceId: list.value().spaceId } : undefined),
          loader: ({
            params,
            abortSignal,
          }: {
            params: { spaceId: string };
            abortSignal: AbortSignal;
          }): Promise<Space> => spaces.space(params.spaceId, abortSignal),
        }),
        counts: resource({
          params: byList,
          loader: ({
            params,
            abortSignal,
          }: {
            params: { listId: string };
            abortSignal: AbortSignal;
          }): Promise<ListSummary> => api.counts(params.listId, todayIso(), abortSignal),
        }),
        milestoneCount: resource({
          params: byList,
          loader: ({
            params,
            abortSignal,
          }: {
            params: { listId: string };
            abortSignal: AbortSignal;
          }): Promise<number> => api.milestoneCount(params.listId, abortSignal),
        }),
        members: resource({
          params: byList,
          loader: ({
            params,
            abortSignal,
          }: {
            params: { listId: string };
            abortSignal: AbortSignal;
          }): Promise<ListMembers> => api.listMembers(params.listId, abortSignal),
        }),
        organizationMembers: resource({
          params: byList,
          loader: ({ abortSignal }: { abortSignal: AbortSignal }): Promise<readonly ListMember[]> =>
            api.organizationMembers(abortSignal),
        }),
        labels: resource({
          params: byList,
          loader: ({ abortSignal }: { abortSignal: AbortSignal }): Promise<readonly string[]> =>
            api.labels(abortSignal),
        }),
        savedViews: resource({
          params: byList,
          loader: ({
            params,
            abortSignal,
          }: {
            params: { listId: string };
            abortSignal: AbortSignal;
          }): Promise<readonly SavedView[]> => api.savedViews(params.listId, abortSignal),
        }),
      };
    }),
    withMethods((store) => {
      let countsQueued: boolean = false;
      let milestonesQueued: boolean = false;
      const reloadCounts: () => void = (): void => {
        if (!store.counts.reload() && store.counts.isLoading()) countsQueued = true;
        if (!store.milestoneCount.reload() && store.milestoneCount.isLoading())
          milestonesQueued = true;
      };
      const currentList: () => TaskList | undefined = () =>
        store.list.hasValue() ? store.list.value() : undefined;
      const views: () => readonly SavedView[] = () =>
        store.savedViews.hasValue() ? store.savedViews.value() : [];
      const replaceView: (view: SavedView) => void = (view: SavedView): void => {
        if (store.listId() !== view.listId || !store.savedViews.hasValue()) return;
        store.savedViews.set(
          views().map((item: SavedView): SavedView => (item.id === view.id ? view : item)),
        );
      };
      const attempt: <T>(write: () => Promise<T>) => Promise<T | null> = async <T>(
        write: () => Promise<T>,
      ): Promise<T | null> => {
        try {
          return await write();
        } catch {
          return null;
        }
      };
      return {
        _watch: rxMethod<string | null>(
          pipe(
            switchMap((listId: string | null): Observable<RealtimeChange> =>
              listId === null || !store._realtime
                ? EMPTY
                : store._realtime.watch({ kind: 'list', listId }).pipe(catchError(() => EMPTY)),
            ),
            filter((notice: RealtimeChange): boolean => {
              const data: unknown = notice.data;
              return (
                typeof data === 'object' &&
                data !== null &&
                (('listId' in data && data.listId === store.listId()) ||
                  ('spaceId' in data &&
                    store.list.hasValue() &&
                    data.spaceId === store.list.value().spaceId))
              );
            }),
            debounceTime(300),
            tap((): void => {
              reloadCounts();
            }),
          ),
        ),
        _flushCounts: signalMethod<string>((status: string): void => {
          if (status !== 'loading' && status !== 'reloading' && countsQueued) {
            countsQueued = false;
            store.counts.reload();
          }
        }),
        _flushMilestones: signalMethod<string>((status: string): void => {
          if (status !== 'loading' && status !== 'reloading' && milestonesQueued) {
            milestonesQueued = false;
            store.milestoneCount.reload();
          }
        }),
        load: signalMethod<string>((listId: string): void => {
          if (listId !== store.listId()) patchState(store, { listId });
        }),
        refreshCounts(): void {
          reloadCounts();
        },
        async rename(name: string): Promise<boolean> {
          const before: TaskList | undefined = currentList();
          if (!before || name === before.name) return true;
          store.list.set({ ...before, name });
          try {
            const renamed: TaskList = await store._api.rename(before, name);
            if (currentList()?.id === renamed.id) store.list.set(renamed);
            return true;
          } catch {
            if (currentList()?.id === before.id) store.list.set(before);
            return false;
          }
        },
        duplicate(): Promise<{ list: TaskList; taskCount: number } | null> {
          const list: TaskList | undefined = currentList();
          return list ? attempt(() => store._api.duplicate(list)) : Promise.resolve(null);
        },
        exportCsv(query: ListTaskQuery): Promise<ListExport | null> {
          const list: TaskList | undefined = currentList();
          return list ? attempt(() => store._api.exportCsv(list, query)) : Promise.resolve(null);
        },
        async archive(): Promise<boolean> {
          const list: TaskList | undefined = currentList();
          if (!list) return false;
          return (await attempt(async () => store._api.archive(list.id).then(() => true))) ?? false;
        },
        async remove(): Promise<boolean> {
          const list: TaskList | undefined = currentList();
          if (!list) return false;
          return (await attempt(async () => store._api.remove(list).then(() => true))) ?? false;
        },
        async createView(
          draft: SavedViewDraft,
          layout: ViewLayout,
          config: ListViewConfig,
        ): Promise<SavedView | null> {
          const listId: string | null = store.listId();
          if (listId === null) return null;
          const created: SavedView | null = await attempt(() =>
            store._api.createSavedView(listId, { ...draft, layout, config }),
          );
          if (created && store.listId() === listId && store.savedViews.hasValue()) {
            store.savedViews.set([...store.savedViews.value(), created]);
          }
          return created;
        },
        async renameView(view: SavedView, draft: SavedViewDraft): Promise<SavedView | null> {
          const renamed: SavedView | null = await attempt(() =>
            store._api.updateSavedView(view, { name: draft.name, icon: draft.icon }),
          );
          if (renamed) replaceView(renamed);
          return renamed;
        },
        async saveViewSettings(view: SavedView, config: ListViewConfig): Promise<SavedView | null> {
          const saved: SavedView | null = await attempt(() =>
            store._api.updateSavedView(view, { config }),
          );
          if (saved) replaceView(saved);
          return saved;
        },
        async duplicateView(view: SavedView): Promise<SavedView | null> {
          const copy: SavedView | null = await attempt(() => store._api.duplicateSavedView(view));
          if (copy && store.listId() === view.listId && store.savedViews.hasValue()) {
            const list: readonly SavedView[] = views();
            const index: number = list.findIndex((item: SavedView): boolean => item.id === view.id);
            if (index >= 0) {
              store.savedViews.set([...list.slice(0, index + 1), copy, ...list.slice(index + 1)]);
            }
          }
          return copy;
        },
        async deleteView(view: SavedView): Promise<boolean> {
          const before: readonly SavedView[] = views();
          const index: number = before.findIndex((item: SavedView): boolean => item.id === view.id);
          if (index >= 0) {
            store.savedViews.set(before.filter((item: SavedView): boolean => item.id !== view.id));
          }
          try {
            await store._api.deleteSavedView(view);
            return true;
          } catch {
            if (index >= 0 && store.listId() === view.listId && store.savedViews.hasValue()) {
              const current: readonly SavedView[] = store.savedViews.value();
              if (!current.some((item: SavedView): boolean => item.id === view.id)) {
                store.savedViews.set([...current.slice(0, index), view, ...current.slice(index)]);
              }
            }
            return false;
          }
        },
        async bulk(
          selection: readonly BulkSelection[],
          action: BulkAction,
        ): Promise<number | null> {
          if (selection.length === 0) return 0;
          const affected: number | null = await attempt(() => store._api.bulk(selection, action));
          if (affected !== null) reloadCounts();
          return affected;
        },
      };
    }),
    withHooks({
      onInit(store): void {
        store._watch(store.listId);
        store._flushCounts(store.counts.status);
        store._flushMilestones(store.milestoneCount.status);
      },
    }),
  );
}

/**
 * Constant ListPageStore
 *
 * @description
 * The open list, provided by the `l/:listId` route. `list` is the page's primary read: its loader
 * rejects with the typed route error (« Accès refusé » for a list the gateway does not show, not
 * found for a malformed id, unavailable otherwise), which the page lets reach the boundary. The
 * space, counts, milestones, members, labels and saved views are secondary reads with their own
 * state. While the page lives it watches the list's realtime room; the gateway broadcasts every
 * change to every watch, so matching list or space notices are debounced before refreshing counts. Writes report whether the gateway
 * recorded them; renaming and deleting a saved view are optimistic and restore on a refusal.
 *
 * @type {ReturnType<typeof createListPageStore>}
 */
export const ListPageStore: ReturnType<typeof createListPageStore> = createListPageStore();
