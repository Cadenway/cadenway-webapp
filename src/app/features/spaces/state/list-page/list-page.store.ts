import {
  DestroyRef,
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
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { auditTime, catchError, EMPTY, filter, type Observable, pipe, switchMap, tap } from 'rxjs';

import { type RealtimeChange, RealtimeConnection } from '@core/realtime';
import { type CreatedTask, TaskCreate } from '@features/task';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import {
  isUncertainBulkFailure,
  type ListExport,
  ListsApi,
} from '../../data-access/services/lists-api/lists-api.service';
import { SpacesApi } from '../../data-access/services/spaces-api/spaces-api.service';
import {
  BULK_CHUNK_SIZE,
  type BulkAction,
  type BulkOutcome,
  type BulkSelection,
} from '../../models/bulk-action/bulk-action.interface';
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
   * Applies an action of the selection bar in chunks of 50 tasks, one `executeBulkTaskAction`
   * call after the other. An uncertain response is retried with the same key. Stops before a
   * send or retry if the organization changed or the store was destroyed, reporting tasks not
   * sent separately from refused and uncertain chunks.
   *
   * @param {readonly BulkSelection[]} selection - Selected tasks.
   * @param {BulkAction} action - Action.
   * @returns {Promise<BulkOutcome>} What changed and what was refused.
   */
  bulk(selection: readonly BulkSelection[], action: BulkAction): Promise<BulkOutcome>;
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
        _workspace: inject(WORKSPACE_CONTEXT),
        _destroyRef: inject(DestroyRef),
        _realtime: inject(RealtimeConnection, { optional: true }),
        _taskCreate: inject(TaskCreate),
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
              if (typeof data !== 'object' || data === null) return false;
              if ('listId' in data) return data.listId === store.listId();
              if ('spaceId' in data) {
                return store.list.hasValue() && data.spaceId === store.list.value().spaceId;
              }
              return COUNTED_TASK_NOTICES.has(notice.type);
            }),
            auditTime(300),
            tap((): void => {
              reloadCounts();
            }),
          ),
        ),
        _countCreations: rxMethod<CreatedTask>(
          pipe(
            filter((task: CreatedTask): boolean => task.listId === store.listId()),
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
        async bulk(selection: readonly BulkSelection[], action: BulkAction): Promise<BulkOutcome> {
          const organizationId: string = store._workspace.organization().id;
          const current: () => boolean = (): boolean =>
            !store._destroyRef.destroyed && store._workspace.organization().id === organizationId;
          let affected: number = 0;
          const done: BulkSelection[] = [];
          const failed: BulkSelection[] = [];
          const unknown: BulkSelection[] = [];
          const notSent: BulkSelection[] = [];
          for (let start: number = 0; start < selection.length; start += BULK_CHUNK_SIZE) {
            if (!current()) {
              notSent.push(...selection.slice(start));
              break;
            }
            const chunk: readonly BulkSelection[] = selection.slice(start, start + BULK_CHUNK_SIZE);
            const key: string = crypto.randomUUID();
            let uncertain: boolean = false;
            try {
              let changed: number;
              try {
                changed = await store._api.bulk(chunk, action, key);
              } catch (error: unknown) {
                if (!isUncertainBulkFailure(error)) throw error;
                uncertain = true;
                if (!current()) {
                  unknown.push(...chunk);
                  notSent.push(...selection.slice(start + BULK_CHUNK_SIZE));
                  break;
                }
                changed = await store._api.bulk(chunk, action, key);
              }
              affected += changed;
              done.push(...chunk);
            } catch (error: unknown) {
              if (!uncertain && !isUncertainBulkFailure(error)) {
                failed.push(...chunk);
              } else {
                unknown.push(...chunk);
                notSent.push(...selection.slice(start + BULK_CHUNK_SIZE));
                break;
              }
            }
          }
          if (current() && (done.length > 0 || unknown.length > 0)) reloadCounts();
          return { affected, done, failed, unknown, notSent };
        },
      };
    }),
    withHooks({
      onInit(store): void {
        store._watch(store.listId);
        store._countCreations(store._taskCreate.created);
        store._flushCounts(store.counts.status);
        store._flushMilestones(store.milestoneCount.status);
      },
    }),
  );
}

/**
 * Constant COUNTED_TASK_NOTICES
 *
 * @description
 * The task notices that can change the counts or the milestone count: an update, a status change,
 * and a task joining or leaving the list (created, archived, unarchived, trashed, restored). A
 * comment or Git link notice cannot, and the socket hands notices of every watched room to every
 * watch.
 *
 * @type {ReadonlySet<string>}
 */
const COUNTED_TASK_NOTICES: ReadonlySet<string> = new Set([
  'task.updated.v1',
  'task.status-changed.v1',
  'task.created.v1',
  'task.archived.v1',
  'task.unarchived.v1',
  'task.trashed.v1',
  'task.restored.v1',
]);

/**
 * Constant ListPageStore
 *
 * @description
 * The open list, provided by the `l/:listId` route. `list` is the page's primary read: its loader
 * rejects with the typed route error (« Accès refusé » for a list the gateway does not show, not
 * found for a malformed id, unavailable otherwise), which the page lets reach the boundary. The
 * space, counts, milestones, members, labels and saved views are secondary reads with their own
 * state. While the page lives it watches the list's realtime room and refreshes the counts 300 ms
 * after a notice, once for every notice of that window, so a steady flow of changes cannot hold the
 * refresh back. The socket hands every notice to every watch: a notice naming another list or space
 * is ignored, and so is a comment or Git link notice; a task update or status change, which names
 * only its task (`{ taskId, changed }`), counts. A task created in the list from this tab refreshes
 * them at once.
 * Writes report whether the gateway recorded them; renaming and deleting a saved view are
 * optimistic and restore on a refusal.
 *
 * @type {ReturnType<typeof createListPageStore>}
 */
export const ListPageStore: ReturnType<typeof createListPageStore> = createListPageStore();
