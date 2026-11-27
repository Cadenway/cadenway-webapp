import { DOCUMENT } from '@angular/common';
import {
  computed,
  inject,
  resource,
  type ResourceRef,
  type Signal,
  type Type,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { EMPTY, fromEvent, merge } from 'rxjs';

import {
  type ApiProblem,
  OrganizationPin,
  OrganizationSwitchPendingError,
  readProblem,
} from '@core/api';
import { RealtimeConnection } from '@core/realtime';
import {
  LIST_DIRECTORY,
  type ListDirectoryEntry,
  type ListDirectoryPort,
} from '@features/spaces/ports/list-directory';
import {
  type Person,
  TaskCreate,
  TaskDetailOpener,
  type TaskMoveTarget,
  type TaskSummary,
} from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import {
  MyTasksApi,
  MyTasksPartialReadError,
} from '../../data-access/services/my-tasks-api/my-tasks-api.service';
import type {
  MyTasksCounts,
  MyTasksPage,
  MyTasksRead,
  MyTasksTab,
} from '../../models/my-tasks-read/my-tasks-read.interface';
import { localDay } from '../../utils/due-bucket/due-bucket.util';

/**
 * Constant FOCUS_REFRESH_MS
 *
 * @description
 * How long after a read settled the window's focus does not read the tab again, in milliseconds.
 *
 * @type {number}
 */
export const FOCUS_REFRESH_MS: number = 30_000;

/**
 * Interface MyTasksState
 *
 * @description
 * Which organization and which tab the page reads, the counts it shows, `Show more` and whether
 * the members are wanted.
 */
interface MyTasksState {
  // #region Properties
  /**
   * Property _organizationId
   *
   * @description
   * The organization read, or null before the workspace gives one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _organizationId: string | null;

  /**
   * Property _tab
   *
   * @description
   * The tab read.
   *
   * @type {MyTasksTab}
   * @readonly
   */
  readonly _tab: MyTasksTab;

  /**
   * Property _counts
   *
   * @description
   * The counts of both tabs from the latest successful read in the organization, kept while
   * another tab is read; null before any.
   *
   * @type {MyTasksCounts | null}
   * @readonly
   */
  readonly _counts: MyTasksCounts | null;

  /**
   * Property _loadingMore
   *
   * @description
   * Whether `Show more` reads the next page of the `Done` tab.
   *
   * @type {boolean}
   * @readonly
   */
  readonly _loadingMore: boolean;

  /**
   * Property _moreFailed
   *
   * @description
   * Whether the last `Show more` failed.
   *
   * @type {boolean}
   * @readonly
   */
  readonly _moreFailed: boolean;

  /**
   * Property _peopleWanted
   *
   * @description
   * Whether the members are read: from the first opening of the task menu in the organization.
   *
   * @type {boolean}
   * @readonly
   */
  readonly _peopleWanted: boolean;
  // #endregion
}

/**
 * Interface ReadParams
 *
 * @description
 * What one read of the tasks is for.
 */
interface ReadParams {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * The organization.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property tab
   *
   * @description
   * The tab.
   *
   * @type {MyTasksTab}
   * @readonly
   */
  readonly tab: MyTasksTab;
  // #endregion
}

/**
 * Interface ReadLoads
 *
 * @description
 * Bookkeeping of the reads, outside the state because the resource loader updates it.
 */
interface ReadLoads {
  // #region Properties
  /**
   * Property passive
   *
   * @description
   * Whether the next reload was asked for in the background.
   *
   * @type {boolean}
   */
  passive: boolean;

  /**
   * Property queued
   *
   * @description
   * A read asked for while another ran, sent once it settles: whether it is passive, or null when
   * none waits. A queued active read stays active.
   *
   * @type {boolean | null}
   */
  queued: boolean | null;

  /**
   * Property refused
   *
   * @description
   * Whether the last passive refresh was refused, on any of its pages, while the organization
   * context was changing or stale; it is sent again once the context is verified.
   *
   * @type {boolean}
   */
  refused: boolean;

  /**
   * Property last
   *
   * @description
   * The read shown, with the organization and tab it was for: a refresh of the same organization
   * and tab that fails, on any page, shows it again instead of failing the page or dropping rows.
   *
   * @type {{ key: string; read: MyTasksRead } | null}
   */
  last: { key: string; read: MyTasksRead } | null;

  /**
   * Property settledAt
   *
   * @description
   * When the last read of the tab settled (`Date.now()`), or null before any.
   *
   * @type {number | null}
   */
  settledAt: number | null;
  // #endregion
}

/**
 * Interface MoreRequest
 *
 * @description
 * The running `Show more`, the only one whose answer and settlement change the state.
 */
interface MoreRequest {
  // #region Properties
  /**
   * Property controller
   *
   * @description
   * Aborts the running `Show more`; null when none runs. A tab change, an organization change and
   * the store's destruction abort it and release `Show more` at once, so a request of a previous
   * context never holds the reads of the new one.
   *
   * @type {AbortController | null}
   */
  controller: AbortController | null;
  // #endregion
}

/**
 * Interface MyTasksStoreInstance
 *
 * @description
 * The caller's assigned tasks of one tab in the current organization.
 */
export interface MyTasksStoreInstance {
  // #region Properties
  /**
   * Property read
   *
   * @description
   * The current read, undefined while the first read of this organization and tab runs. Reading
   * it throws once that first read failed on its first page, so the page's template hands the
   * failure to the route's error boundary.
   *
   * @type {Signal<MyTasksRead | undefined>}
   * @readonly
   */
  readonly read: Signal<MyTasksRead | undefined>;

  /**
   * Property tasks
   *
   * @description
   * The tasks read, empty until a read succeeded or after its failure; the page binds
   * `TaskRowActionsStore.sync` to it.
   *
   * @type {Signal<readonly TaskSummary[]>}
   * @readonly
   */
  readonly tasks: Signal<readonly TaskSummary[]>;

  /**
   * Property counts
   *
   * @description
   * The counts of both tabs from the latest read of this organization, kept while another tab is
   * read; null before any.
   *
   * @type {Signal<MyTasksCounts | null>}
   * @readonly
   */
  readonly counts: Signal<MyTasksCounts | null>;

  /**
   * Property reloading
   *
   * @description
   * Whether a read runs while rows are shown (a refresh or `Retry`).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly reloading: Signal<boolean>;

  /**
   * Property canShowMore
   *
   * @description
   * Whether the `Done` tab has pages after the ones shown.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly canShowMore: Signal<boolean>;

  /**
   * Property loadingMore
   *
   * @description
   * Whether `Show more` runs.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loadingMore: Signal<boolean>;

  /**
   * Property moreFailed
   *
   * @description
   * Whether the last `Show more` failed; the next one tries again.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly moreFailed: Signal<boolean>;

  /**
   * Property people
   *
   * @description
   * The members the task menu assigns; empty until the menu first opened, while they load and
   * after their read failed.
   *
   * @type {Signal<readonly Person[]>}
   * @readonly
   */
  readonly people: Signal<readonly Person[]>;

  /**
   * Property listNames
   *
   * @description
   * The name of every list of the sidebar by id (Spaces' `LIST_DIRECTORY`).
   *
   * @type {Signal<ReadonlyMap<string, string>>}
   * @readonly
   */
  readonly listNames: Signal<ReadonlyMap<string, string>>;

  /**
   * Property listedSpaces
   *
   * @description
   * The spaces the sidebar holds at least one list of: a list missing from those spaces is
   * archived (gap G-T1); a space without any (its overview failed or is still read) says nothing.
   *
   * @type {Signal<ReadonlySet<string>>}
   * @readonly
   */
  readonly listedSpaces: Signal<ReadonlySet<string>>;

  /**
   * Property moveTargets
   *
   * @description
   * The lists of the task menu's `Move to`.
   *
   * @type {Signal<readonly TaskMoveTarget[]>}
   * @readonly
   */
  readonly moveTargets: Signal<readonly TaskMoveTarget[]>;
  // #endregion

  // #region Methods
  /**
   * Method show
   *
   * @description
   * Follows the tab of the address (a signal, or each value): a new tab is read as a first read,
   * with the skeleton, keeping the tab counts; the `Done` tab starts again at its first page.
   *
   * @param {MyTasksTab | Signal<MyTasksTab>} tab - The tab.
   */
  show(tab: MyTasksTab | Signal<MyTasksTab>): void;

  /**
   * Method refresh
   *
   * @description
   * Reads the tab again in the background, keeping the rows, to the depth shown; sent once the
   * running read or `Show more` settles when one runs.
   */
  refresh(): void;

  /**
   * Method retry
   *
   * @description
   * `Retry` of the inline error: reads the tab again as an active request.
   */
  retry(): void;

  /**
   * Method showMore
   *
   * @description
   * `Show more` of the `Done` tab: reads its next page and adds it under the rows; nothing while a
   * read runs or once the last page is shown. The request has its own abort signal: a tab change,
   * an organization change or the store's destruction aborts it and releases `loadingMore` at
   * once, and only the request that owns `loadingMore` settles it.
   *
   * @returns {Promise<void>} Resolves once the page is shown or its failure is.
   */
  showMore(): Promise<void>;

  /**
   * Method loadPeople
   *
   * @description
   * The task menu opens: reads the members the first time, and again when their read failed.
   */
  loadPeople(): void;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * No organization yet, the `To do` tab.
 *
 * @type {MyTasksState}
 */
const initialState: MyTasksState = {
  _organizationId: null,
  _tab: 'open',
  _counts: null,
  _loadingMore: false,
  _moreFailed: false,
  _peopleWanted: false,
};

/**
 * Function contextRefused
 *
 * @description
 * Whether a read was refused because the workspace organization was changing or being verified.
 *
 * @param {unknown} error - The failure of the read.
 * @returns {boolean} Whether verification may let it through.
 */
function contextRefused(error: unknown): boolean {
  if (error instanceof OrganizationSwitchPendingError) return true;
  const problem: ApiProblem | null = readProblem(error);
  return problem?.status === 412 && problem.code === 'organization.context-changed';
}

/**
 * Function keyOf
 *
 * @description
 * The key of the reads of one organization and tab.
 *
 * @param {string} organizationId - The organization.
 * @param {MyTasksTab} tab - The tab.
 * @returns {string} The key.
 */
function keyOf(organizationId: string, tab: MyTasksTab): string {
  return `${organizationId}|${tab}`;
}

/**
 * Function createMyTasksStore
 *
 * @description
 * Creates the store of `My tasks`.
 *
 * @returns {Type<MyTasksStoreInstance>} Injectable store constructor.
 */
function createMyTasksStore(): Type<MyTasksStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps((store) => {
      const api: MyTasksApi = inject(MyTasksApi);
      const loads: ReadLoads = {
        passive: false,
        queued: null,
        refused: false,
        last: null,
        settledAt: null,
      };
      const shown: (key: string, page: MyTasksPage, tab: MyTasksTab) => MyTasksRead = (
        key: string,
        page: MyTasksPage,
        tab: MyTasksTab,
      ): MyTasksRead => {
        const read: MyTasksRead = {
          ...page,
          tab,
          today: localDay(new Date()),
          refreshFailed: false,
        };
        loads.last = { key, read };
        patchState(store, { _counts: page.counts });
        return read;
      };
      const tasks: ResourceRef<MyTasksRead | undefined> = resource({
        params: (): ReadParams | undefined => {
          const organizationId: string | null = store._organizationId();
          return organizationId === null ? undefined : { organizationId, tab: store._tab() };
        },
        loader: async ({
          params,
          abortSignal,
        }: {
          params: ReadParams;
          abortSignal: AbortSignal;
        }): Promise<MyTasksRead> => {
          const key: string = keyOf(params.organizationId, params.tab);
          const previous: MyTasksRead | null = loads.last?.key === key ? loads.last.read : null;
          const passive: boolean = loads.passive && previous !== null;
          loads.passive = false;
          try {
            const page: MyTasksPage = await api.read(params.tab, {
              passive,
              signal: abortSignal,
              ...(params.tab === 'closed' ? { pages: previous?.pages ?? 1 } : {}),
            });
            loads.refused = false;
            return shown(key, page, params.tab);
          } catch (error: unknown) {
            if (abortSignal.aborted) throw error;
            if (previous === null) {
              if (error instanceof MyTasksPartialReadError)
                return shown(key, error.page, params.tab);
              throw error;
            }
            const failure: unknown = error instanceof MyTasksPartialReadError ? error.cause : error;
            if (passive && contextRefused(failure)) {
              loads.refused = true;
              return previous;
            }
            return { ...previous, refreshFailed: true };
          } finally {
            if (!abortSignal.aborted) loads.settledAt = Date.now();
          }
        },
      });
      const people: ResourceRef<readonly Person[] | undefined> = resource({
        params: (): { organizationId: string } | undefined => {
          const organizationId: string | null = store._organizationId();
          return organizationId === null || !store._peopleWanted() ? undefined : { organizationId };
        },
        loader: ({ abortSignal }: { abortSignal: AbortSignal }): Promise<readonly Person[]> =>
          api.people(abortSignal),
      });
      const more: MoreRequest = { controller: null };
      return {
        _api: api,
        _loads: loads,
        _more: more,
        _tasks: tasks,
        _people: people,
        _directory: inject<ListDirectoryPort | null>(LIST_DIRECTORY, { optional: true }),
        _workspace: inject<WorkspaceContextPort>(WORKSPACE_CONTEXT),
        _pin: inject(OrganizationPin),
        _realtime: inject(RealtimeConnection, { optional: true }),
        _taskDetail: inject(TaskDetailOpener),
        _taskCreate: inject(TaskCreate),
        _window: inject(DOCUMENT).defaultView,
      };
    }),
    withComputed((store) => {
      const lists: Signal<readonly ListDirectoryEntry[]> = computed(
        (): readonly ListDirectoryEntry[] => store._directory?.lists() ?? [],
      );
      return {
        read: computed((): MyTasksRead | undefined => store._tasks.value()),
        tasks: computed((): readonly TaskSummary[] =>
          store._tasks.hasValue() ? store._tasks.value().tasks : [],
        ),
        counts: computed((): MyTasksCounts | null => store._counts()),
        reloading: computed((): boolean => store._tasks.status() === 'reloading'),
        canShowMore: computed((): boolean => {
          if (!store._tasks.hasValue()) return false;
          const read: MyTasksRead = store._tasks.value();
          return read.tab === 'closed' && read.complete && read.nextCursor !== null;
        }),
        loadingMore: computed((): boolean => store._loadingMore()),
        moreFailed: computed((): boolean => store._moreFailed()),
        people: computed((): readonly Person[] =>
          store._people.hasValue() ? store._people.value() : [],
        ),
        listNames: computed(
          (): ReadonlyMap<string, string> =>
            new Map(
              lists().map((list: ListDirectoryEntry): [string, string] => [list.id, list.name]),
            ),
        ),
        listedSpaces: computed(
          (): ReadonlySet<string> =>
            new Set(lists().map((list: ListDirectoryEntry): string => list.spaceId)),
        ),
        moveTargets: computed((): readonly TaskMoveTarget[] =>
          lists().map((list: ListDirectoryEntry): TaskMoveTarget => ({
            listId: list.id,
            name: list.name,
            spaceName: list.spaceName,
            icon: list.icon,
            tone: list.tone,
          })),
        ),
      };
    }),
    withMethods((store) => {
      const busy: () => boolean = (): boolean => store._tasks.isLoading() || store._loadingMore();
      const reload: (passive: boolean) => void = (passive: boolean): void => {
        if (busy()) {
          store._loads.queued = (store._loads.queued ?? true) && passive;
          return;
        }
        if (!store._tasks.hasValue()) return;
        store._loads.passive = passive;
        store._tasks.reload();
      };
      const cancelMore: () => void = (): void => {
        const controller: AbortController | null = store._more.controller;
        if (controller === null) return;
        store._more.controller = null;
        controller.abort();
        patchState(store, { _loadingMore: false });
      };
      return {
        _settled: signalMethod<boolean>((running: boolean): void => {
          if (running || store._loads.queued === null) return;
          const passive: boolean = store._loads.queued;
          store._loads.queued = null;
          reload(passive);
        }),
        _verified(): void {
          if (!store._loads.refused) return;
          store._loads.refused = false;
          reload(true);
        },
        _focused(): void {
          const settledAt: number | null = store._loads.settledAt;
          if (settledAt !== null && Date.now() - settledAt < FOCUS_REFRESH_MS) return;
          reload(true);
        },
        _followOrganization: signalMethod<string>((organizationId: string): void => {
          if (organizationId === store._organizationId()) return;
          cancelMore();
          store._loads.queued = null;
          store._loads.refused = false;
          store._loads.last = null;
          store._loads.settledAt = null;
          patchState(store, {
            _organizationId: organizationId,
            _counts: null,
            _moreFailed: false,
            _peopleWanted: false,
          });
        }),
        show: signalMethod<MyTasksTab>((tab: MyTasksTab): void => {
          if (tab === store._tab()) return;
          cancelMore();
          store._loads.queued = null;
          store._loads.settledAt = null;
          patchState(store, { _tab: tab, _moreFailed: false });
        }),
        refresh(): void {
          reload(true);
        },
        retry(): void {
          reload(false);
        },
        async showMore(): Promise<void> {
          if (busy() || !store._tasks.hasValue()) return;
          const current: MyTasksRead = store._tasks.value();
          const organizationId: string | null = store._organizationId();
          if (current.tab !== 'closed' || current.nextCursor === null || organizationId === null)
            return;
          const controller: AbortController = new AbortController();
          const owns: () => boolean = (): boolean =>
            store._more.controller === controller &&
            store._organizationId() === organizationId &&
            store._tasks.hasValue() &&
            store._tasks.value() === current;
          store._more.controller = controller;
          patchState(store, { _loadingMore: true, _moreFailed: false });
          try {
            const page: MyTasksPage = await store._api.read('closed', {
              passive: false,
              cursor: current.nextCursor,
              pages: 1,
              signal: controller.signal,
            });
            if (!owns()) return;
            const seen: ReadonlySet<string> = new Set(
              current.tasks.map((task: TaskSummary): string => task.key),
            );
            const read: MyTasksRead = {
              ...current,
              tasks: [
                ...current.tasks,
                ...page.tasks.filter((task: TaskSummary): boolean => !seen.has(task.key)),
              ],
              counts: page.counts,
              nextCursor: page.nextCursor,
              pages: current.pages + 1,
            };
            store._loads.last = { key: keyOf(organizationId, 'closed'), read };
            store._tasks.set(read);
            patchState(store, { _counts: page.counts });
          } catch {
            if (owns()) patchState(store, { _moreFailed: true });
          } finally {
            if (store._more.controller === controller) {
              store._more.controller = null;
              patchState(store, { _loadingMore: false });
            }
          }
        },
        loadPeople(): void {
          if (!store._peopleWanted()) patchState(store, { _peopleWanted: true });
          else if (store._people.status() === 'error') store._people.reload();
        },
      };
    }),
    withHooks({
      onInit(store): void {
        store._followOrganization(computed((): string => store._workspace.organization().id));
        store._settled(computed((): boolean => store._tasks.isLoading() || store._loadingMore()));
        merge(
          store._realtime?.reconnected ?? EMPTY,
          store._taskDetail.closed,
          store._taskDetail.changed,
          store._taskCreate.created,
        )
          .pipe(takeUntilDestroyed())
          .subscribe((): void => {
            store.refresh();
          });
        const window: Window | null = store._window;
        (window ? fromEvent(window, 'focus') : EMPTY)
          .pipe(takeUntilDestroyed())
          .subscribe((): void => {
            store._focused();
          });
        store._pin.organizationVerified.pipe(takeUntilDestroyed()).subscribe((): void => {
          store._verified();
        });
      },
      onDestroy(store): void {
        store._more.controller?.abort();
        store._more.controller = null;
      },
    }),
  );
}

/**
 * Constant MyTasksStore
 *
 * @description
 * Provided by `MyTasksPage`, so the error boundary's `Retry`, which re-creates the page, starts
 * over. It reads the caller's assigned tasks of the address's tab in the workspace's organization:
 * `To do` to its last cursor, `Done` one page at a time (`showMore()` adds the next page, a
 * refresh reads again only the pages shown). The first read of an organization and tab is active;
 * a failure of its first page fails the page, a failure of a later page shows the pages read with
 * `complete` false. There is no realtime event for these tasks (gap G-R1), so the tab is read
 * again, in the background and keeping its rows, after a realtime reconnection, when a task detail
 * closes or reports a change, after a creation, on `refresh()` (the page's own writes) and on
 * window focus unless a read settled less than 30 s before (`FOCUS_REFRESH_MS`); a read asked for
 * while another read or `Show more` runs is sent once it settles. A refresh that fails, on its
 * first page or a later one, keeps the previous rows with `refreshFailed`; one refused, on any
 * page, while the organization context is stale keeps them silently and is sent again once the
 * context is verified. An organization switch or a tab change drops the rows at once and reads
 * anew: a read of another organization is aborted and never shown, and a `Show more` answered
 * after it is dropped: such a change aborts a running `Show more` and frees the reads it held, so a
 * request of the previous context, even one that never answers, never queues the new context's
 * refreshes. The tab counts stay while another tab of the same organization is read.
 * The members (`people`) are a secondary read made when the task menu first opens: a failure
 * leaves the menu's `Assign` empty until the next opening reads them again. The list names come
 * from Spaces' `LIST_DIRECTORY`, which holds no archived list.
 *
 * @type {Type<MyTasksStoreInstance>}
 */
export const MyTasksStore: Type<MyTasksStoreInstance> = createMyTasksStore();
