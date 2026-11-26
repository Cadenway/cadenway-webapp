import {
  computed,
  DestroyRef,
  inject,
  resource,
  type ResourceRef,
  type Signal,
  type Type,
  untracked,
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
import {
  auditTime,
  catchError,
  EMPTY,
  filter,
  merge,
  type Observable,
  pipe,
  Subject,
  switchMap,
  tap,
} from 'rxjs';

import { type RealtimeChange, RealtimeConnection } from '@core/realtime';
import { type CreatedTask, TaskCreate, TaskDetailOpener } from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { ListActivityApi } from '../../data-access/services/list-activity-api/list-activity-api.service';
import {
  LIST_ACTIVITY_KINDS,
  type ListActivityEntry,
  type ListActivityFilter,
  type ListActivityKind,
  type ListActivityPage,
} from '../../models/list-activity/list-activity.interface';
import { ListPageStore } from '../list-page/list-page.store';

/**
 * Constant ACTIVITY_PAGE_SIZE
 *
 * @description
 * Entries per page read.
 *
 * @type {number}
 */
export const ACTIVITY_PAGE_SIZE: number = 50;

/**
 * Constant ACTIVITY_REFRESH_LIMIT
 *
 * @description
 * Largest page the gateway serves: a refresh reads again as many entries as are shown, up to
 * this many, so a refresh after scrolling keeps the entries read.
 *
 * @type {number}
 */
const ACTIVITY_REFRESH_LIMIT: number = 100;

/**
 * Constant NOTICE_REFRESH_MS
 *
 * @description
 * Time between the first realtime notice or task detail change of a window and the read it
 * gathers, in milliseconds: one read per window, as the `List` view does.
 *
 * @type {number}
 */
const NOTICE_REFRESH_MS: number = 1000;

/**
 * Constant ACTIVITY_NOTICES
 *
 * @description
 * The notices of the list's room that record activity: a task update or status change (which name
 * only their task) and `list.tasks-changed.v1` (a task created in the list or moved out). The
 * gateway pushes no activity notice of its own; comment notices go to task rooms only.
 *
 * @type {ReadonlySet<string>}
 */
const ACTIVITY_NOTICES: ReadonlySet<string> = new Set([
  'task.updated.v1',
  'task.status-changed.v1',
  'list.tasks-changed.v1',
]);

/**
 * Interface ActivityParams
 *
 * @description
 * What a read of the first page depends on, with its identity.
 */
interface ActivityParams {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * The committed organization.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property listId
   *
   * @description
   * The open list.
   *
   * @type {string}
   * @readonly
   */
  readonly listId: string;

  /**
   * Property filter
   *
   * @description
   * The view's kinds and person.
   *
   * @type {ListActivityFilter}
   * @readonly
   */
  readonly filter: ListActivityFilter;

  /**
   * Property listKey
   *
   * @description
   * Identity of the organization and list.
   *
   * @type {string}
   * @readonly
   */
  readonly listKey: string;

  /**
   * Property key
   *
   * @description
   * Identity of the read: the organization, the list and the filters.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;
  // #endregion
}

/**
 * Interface ActivitySnapshot
 *
 * @description
 * The first page of a read, with the read it answers.
 */
export interface ActivitySnapshot {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Identity of the read.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property listKey
   *
   * @description
   * Identity of the organization and list read.
   *
   * @type {string}
   * @readonly
   */
  readonly listKey: string;

  /**
   * Property page
   *
   * @description
   * The page.
   *
   * @type {ListActivityPage}
   * @readonly
   */
  readonly page: ListActivityPage;
  // #endregion
}

/**
 * Interface ActivityViewState
 *
 * @description
 * State of the `Activity` view.
 */
interface ActivityViewState {
  // #region Properties
  /**
   * Property _filter
   *
   * @description
   * The kinds of the chips and the person of the select.
   *
   * @type {ListActivityFilter}
   * @readonly
   */
  readonly _filter: ListActivityFilter;

  /**
   * Property _items
   *
   * @description
   * The entries read for `_key`, the most recent first.
   *
   * @type {readonly ListActivityEntry[]}
   * @readonly
   */
  readonly _items: readonly ListActivityEntry[];

  /**
   * Property _key
   *
   * @description
   * Identity of the read the entries answer, null before the first answer.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _key: string | null;

  /**
   * Property _listKey
   *
   * @description
   * Identity of the organization and list the entries belong to, null before the first answer.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _listKey: string | null;

  /**
   * Property _nextCursor
   *
   * @description
   * Cursor of the next page, null on the last one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _nextCursor: string | null;

  /**
   * Property _total
   *
   * @description
   * Entries that match the filters, on every page.
   *
   * @type {number}
   * @readonly
   */
  readonly _total: number;

  /**
   * Property _generation
   *
   * @description
   * Counts the first pages applied, so that a later page read before one is dropped.
   *
   * @type {number}
   * @readonly
   */
  readonly _generation: number;

  /**
   * Property loadingMore
   *
   * @description
   * Whether a later page is being read.
   *
   * @type {boolean}
   * @readonly
   */
  readonly loadingMore: boolean;

  /**
   * Property moreFailed
   *
   * @description
   * Whether the last read of a later page failed.
   *
   * @type {boolean}
   * @readonly
   */
  readonly moreFailed: boolean;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * Everyone, every kind, nothing read.
 *
 * @type {ActivityViewState}
 */
const initialState: ActivityViewState = {
  _filter: { kinds: [], actorId: null },
  _items: [],
  _key: null,
  _listKey: null,
  _nextCursor: null,
  _total: 0,
  _generation: 0,
  loadingMore: false,
  moreFailed: false,
};

/**
 * Interface ActivityViewStoreInstance
 *
 * @description
 * Public API of `ActivityViewStore`.
 */
export interface ActivityViewStoreInstance {
  // #region Properties
  /**
   * Property primary
   *
   * @description
   * The read of the first page. While nothing was shown for the list (`firstRead`), the page
   * reads its `value()`, so a failure reaches the route's error boundary.
   *
   * @type {ResourceRef<ActivitySnapshot | undefined>}
   * @readonly
   */
  readonly primary: ResourceRef<ActivitySnapshot | undefined>;

  /**
   * Property filter
   *
   * @description
   * The kinds of the chips (every kind when empty) and the person (everyone when null).
   *
   * @type {Signal<ListActivityFilter>}
   * @readonly
   */
  readonly filter: Signal<ListActivityFilter>;

  /**
   * Property filtered
   *
   * @description
   * Whether a kind or a person filters the entries (`Clear filters` of the empty state).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly filtered: Signal<boolean>;

  /**
   * Property firstRead
   *
   * @description
   * Whether nothing was shown yet for the open list in the committed organization.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly firstRead: Signal<boolean>;

  /**
   * Property current
   *
   * @description
   * Whether the entries answer the current filters.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly current: Signal<boolean>;

  /**
   * Property entries
   *
   * @description
   * The entries of the current filters, the most recent first; empty until they are read.
   *
   * @type {Signal<readonly ListActivityEntry[]>}
   * @readonly
   */
  readonly entries: Signal<readonly ListActivityEntry[]>;

  /**
   * Property total
   *
   * @description
   * Entries that match the current filters, null until they are read.
   *
   * @type {Signal<number | null>}
   * @readonly
   */
  readonly total: Signal<number | null>;

  /**
   * Property loading
   *
   * @description
   * Whether the current filters are being read with nothing of theirs to show: the skeleton.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loading: Signal<boolean>;

  /**
   * Property failed
   *
   * @description
   * Whether the last read of the first page failed after the list was shown: an inline error
   * with `Retry` (the entries stay when they answer the current filters).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly failed: Signal<boolean>;

  /**
   * Property empty
   *
   * @description
   * Whether the current filters were read with no entry: the empty state, never a failure.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly empty: Signal<boolean>;

  /**
   * Property hasMore
   *
   * @description
   * Whether older entries remain.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly hasMore: Signal<boolean>;

  /**
   * Property loadingMore
   *
   * @description
   * Whether a later page is being read.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loadingMore: Signal<boolean>;

  /**
   * Property moreFailed
   *
   * @description
   * Whether the last read of a later page failed.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly moreFailed: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method filterPerson
   *
   * @description
   * Keeps one person's entries, or everyone's with null.
   *
   * @param {string | null} actorId - Account of the person, null for everyone.
   */
  filterPerson(actorId: string | null): void;

  /**
   * Method filterKinds
   *
   * @description
   * Keeps the given kinds, in the chips' order; every kind when empty.
   *
   * @param {readonly ListActivityKind[]} kinds - The kinds.
   */
  filterKinds(kinds: readonly ListActivityKind[]): void;

  /**
   * Method clearFilters
   *
   * @description
   * Shows everyone's entries of every kind again (`Clear filters`).
   */
  clearFilters(): void;

  /**
   * Method reload
   *
   * @description
   * Reads the first page again (`Retry`), keeping the entries shown until the answer.
   */
  reload(): void;

  /**
   * Method loadMore
   *
   * @description
   * Reads the next page (scrolling near the end, `Show more` and its `Retry`).
   *
   * @returns {Promise<void>} Resolves once read or failed.
   */
  loadMore(): Promise<void>;
  // #endregion
}

/**
 * Function normalizedKinds
 *
 * @description
 * The given kinds once each, in the chips' order.
 *
 * @param {readonly ListActivityKind[]} kinds - The kinds.
 * @returns {readonly ListActivityKind[]} The ordered kinds.
 */
function normalizedKinds(kinds: readonly ListActivityKind[]): readonly ListActivityKind[] {
  return LIST_ACTIVITY_KINDS.filter((kind: ListActivityKind): boolean => kinds.includes(kind));
}

/**
 * Function createActivityViewStore
 *
 * @description
 * Creates the `Activity` view's store.
 *
 * @returns {Type<ActivityViewStoreInstance>} Injectable store constructor.
 */
function createActivityViewStore(): Type<ActivityViewStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps((store) => {
      const api: ListActivityApi = inject(ListActivityApi);
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      const listPage: InstanceType<typeof ListPageStore> = inject(ListPageStore);
      const params: Signal<ActivityParams | undefined> = computed(
        (): ActivityParams | undefined => {
          const listId: string | null = listPage.listId();
          if (listId === null) return undefined;
          const organizationId: string = workspace.organization().id;
          const filterValue: ListActivityFilter = store._filter();
          const listKey: string = JSON.stringify([organizationId, listId]);
          return {
            organizationId,
            listId,
            filter: filterValue,
            listKey,
            key: JSON.stringify([organizationId, listId, filterValue.kinds, filterValue.actorId]),
          };
        },
        {
          equal: (a: ActivityParams | undefined, b: ActivityParams | undefined): boolean =>
            a?.key === b?.key,
        },
      );
      const primary: ResourceRef<ActivitySnapshot | undefined> = resource({
        params: () => params(),
        loader: async ({
          params: read,
          abortSignal,
        }: {
          params: ActivityParams;
          abortSignal: AbortSignal;
        }): Promise<ActivitySnapshot> => {
          const shown: number = untracked(() =>
            store._key() === read.key ? store._items().length : 0,
          );
          const limit: number = Math.min(
            ACTIVITY_REFRESH_LIMIT,
            Math.max(ACTIVITY_PAGE_SIZE, shown),
          );
          const page: ListActivityPage = await api.page(
            read.listId,
            read.filter,
            null,
            limit,
            abortSignal,
          );
          return { key: read.key, listKey: read.listKey, page };
        },
      });
      return {
        _api: api,
        _params: params,
        _reloadRequests: new Subject<void>(),
        _realtime: inject(RealtimeConnection, { optional: true }),
        _taskCreate: inject(TaskCreate),
        _taskDetail: inject(TaskDetailOpener),
        primary,
      };
    }),
    withComputed((store) => {
      const current: Signal<boolean> = computed(
        (): boolean => store._key() !== null && store._key() === store._params()?.key,
      );
      return {
        filter: store._filter,
        filtered: computed(
          (): boolean => store._filter().kinds.length > 0 || store._filter().actorId !== null,
        ),
        firstRead: computed(
          (): boolean =>
            store._params() !== undefined && store._listKey() !== store._params()?.listKey,
        ),
        current,
        entries: computed((): readonly ListActivityEntry[] => (current() ? store._items() : [])),
        total: computed((): number | null => (current() ? store._total() : null)),
        loading: computed(
          (): boolean => !current() && store._params() !== undefined && store.primary.isLoading(),
        ),
        failed: computed(
          (): boolean =>
            store._params() !== undefined &&
            store._listKey() === store._params()?.listKey &&
            store.primary.status() === 'error',
        ),
        empty: computed((): boolean => current() && store._items().length === 0),
        hasMore: computed((): boolean => current() && store._nextCursor() !== null),
      };
    }),
    withMethods((store) => ({
      filterPerson(actorId: string | null): void {
        patchState(store, { _filter: { ...store._filter(), actorId } });
      },

      filterKinds(kinds: readonly ListActivityKind[]): void {
        patchState(store, { _filter: { ...store._filter(), kinds: normalizedKinds(kinds) } });
      },

      clearFilters(): void {
        patchState(store, { _filter: { kinds: [], actorId: null } });
      },

      reload(): void {
        store.primary.reload();
      },

      async loadMore(): Promise<void> {
        const read: ActivityParams | undefined = store._params();
        const cursor: string | null = store._nextCursor();
        if (!read || !store.current() || cursor === null || store.loadingMore()) return;
        const generation: number = store._generation();
        const stale: () => boolean = (): boolean =>
          store._generation() !== generation || store._params()?.key !== read.key;
        patchState(store, { loadingMore: true, moreFailed: false });
        try {
          const page: ListActivityPage = await store._api.page(
            read.listId,
            read.filter,
            cursor,
            ACTIVITY_PAGE_SIZE,
          );
          if (stale()) {
            patchState(store, { loadingMore: false });
            return;
          }
          const known: ReadonlySet<string> = new Set<string>(
            store._items().map((entry: ListActivityEntry): string => entry.id),
          );
          patchState(store, {
            _items: [
              ...store._items(),
              ...page.items.filter((entry: ListActivityEntry): boolean => !known.has(entry.id)),
            ],
            _nextCursor: page.nextCursor,
            _total: page.total,
            loadingMore: false,
          });
        } catch {
          patchState(store, { loadingMore: false, moreFailed: !stale() });
        }
      },

      _apply: signalMethod<ActivitySnapshot | undefined>(
        (snapshot: ActivitySnapshot | undefined): void => {
          if (!snapshot || snapshot.key !== untracked(store._params)?.key) return;
          patchState(store, {
            _items: snapshot.page.items,
            _key: snapshot.key,
            _listKey: snapshot.listKey,
            _nextCursor: snapshot.page.nextCursor,
            _total: snapshot.page.total,
            _generation: untracked(store._generation) + 1,
            loadingMore: false,
            moreFailed: false,
          });
        },
      ),

      _watch: rxMethod<string | null>(
        pipe(
          switchMap((listId: string | null): Observable<RealtimeChange> =>
            listId === null || !store._realtime
              ? EMPTY
              : store._realtime.watch({ kind: 'list', listId }).pipe(catchError(() => EMPTY)),
          ),
          filter((notice: RealtimeChange): boolean => {
            if (!ACTIVITY_NOTICES.has(notice.type)) return false;
            const data: unknown = notice.data;
            return (
              typeof data === 'object' &&
              data !== null &&
              (!('listId' in data) || data.listId === store._params()?.listId)
            );
          }),
          tap((): void => {
            store._reloadRequests.next();
          }),
        ),
      ),
    })),
    withHooks({
      onInit(store): void {
        const destroyRef: DestroyRef = inject(DestroyRef);
        store._apply(
          computed((): ActivitySnapshot | undefined =>
            store.primary.hasValue() ? store.primary.value() : undefined,
          ),
        );
        store._watch(computed((): string | null => store._params()?.listId ?? null));
        const reloads: { unsubscribe: () => void } = store._reloadRequests
          .pipe(auditTime(NOTICE_REFRESH_MS))
          .subscribe((): void => {
            if (store._params()) store.primary.reload();
          });
        const created: { unsubscribe: () => void } = store._taskCreate.created.subscribe(
          (task: CreatedTask): void => {
            if (task.listId === store._params()?.listId) store._reloadRequests.next();
          },
        );
        const detailChanges: { unsubscribe: () => void } = merge(
          store._taskDetail.closed,
          store._taskDetail.changed,
        ).subscribe((): void => {
          store._reloadRequests.next();
        });
        destroyRef.onDestroy((): void => {
          reloads.unsubscribe();
          created.unsubscribe();
          detailChanges.unsubscribe();
          store._reloadRequests.complete();
        });
      },
    }),
  );
}

/**
 * Constant ActivityViewStore
 *
 * @description
 * The state of the `Activity` view (`l/:listId/activity`, `App.dc.html` lines 1299-1361,
 * 7676-7720), route-scoped through `ACTIVITY_VIEW_PROVIDERS`: the activity log of the open list
 * (`listListActivity`), the most recent entries first, filtered by kind (the type chips) and by
 * person (the select), on the server. The first page is the view's primary read; a failure before
 * anything was shown for the list reaches the route's error boundary, a later one (another filter,
 * a refresh) offers `Retry` in place. Older pages are read by cursor and appended once each. A
 * notice of the list's room that records activity (a task update or status change,
 * `list.tasks-changed.v1`), a task created in the list from this tab and a task detail that closes
 * or whose `Undo` restored a task read the first page again, 1 s after the first of a window, as
 * many entries as are shown (100 at most). The entries follow the committed organization and the
 * list: another one hides them at once and late answers are dropped.
 *
 * @type {Type<ActivityViewStoreInstance>}
 */
export const ActivityViewStore: Type<ActivityViewStoreInstance> = createActivityViewStore();
