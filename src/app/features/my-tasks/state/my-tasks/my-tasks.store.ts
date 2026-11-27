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
import { EMPTY, fromEvent, merge, type Observable } from 'rxjs';

import {
  type ApiProblem,
  OrganizationPin,
  OrganizationSwitchPendingError,
  readProblem,
} from '@core/api';
import { RealtimeConnection } from '@core/realtime';
import {
  type Person,
  type TaskMoveTarget,
  TaskCreate,
  TaskDetailOpener,
  type TaskSummary,
} from '@features/task';
import {
  LIST_DIRECTORY,
  type ListDirectoryEntry,
  type ListDirectoryPort,
} from '@features/spaces/ports/list-directory';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { MyTasksApi } from '../../data-access/services/my-tasks-api/my-tasks-api.service';
import type {
  MyTasksCounts,
  MyTasksPage,
  MyTasksRead,
  MyTasksTab,
} from '../../models/my-tasks-read/my-tasks-read.interface';
import { localDay } from '../../utils/due-bucket/due-bucket.util';

/**
 * Interface MyTasksState
 *
 * @description
 * Which organization and which tab the page reads.
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
   * Whether the last passive refresh was refused while the organization context was changing or
   * stale; it is sent again once the context is verified.
   *
   * @type {boolean}
   */
  refused: boolean;

  /**
   * Property last
   *
   * @description
   * The last successful read, with the organization and tab it was for: a refresh of the same
   * organization and tab that fails shows it again instead of failing the page.
   *
   * @type {{ key: string; read: MyTasksRead } | null}
   */
  last: { key: string; read: MyTasksRead } | null;
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
   * it throws once that first read failed, so the page's template hands the failure to the route's
   * error boundary.
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
   * Property people
   *
   * @description
   * The members the task menu assigns; empty while they load or after their read failed.
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
   * Property listsKnown
   *
   * @description
   * Whether the sidebar's lists are known: a list missing from them is then archived (gap G-T1).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly listsKnown: Signal<boolean>;

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
   * with the skeleton, keeping the tab counts.
   *
   * @param {MyTasksTab | Signal<MyTasksTab>} tab - The tab.
   */
  show(tab: MyTasksTab | Signal<MyTasksTab>): void;

  /**
   * Method refresh
   *
   * @description
   * Reads the tab again in the background, keeping the rows; sent once the running read settles
   * when one runs.
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
   * Method loadPeople
   *
   * @description
   * Reads the members again when their read failed (the task menu opens).
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
const initialState: MyTasksState = { _organizationId: null, _tab: 'open', _counts: null };

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
      const loads: ReadLoads = { passive: false, queued: null, refused: false, last: null };
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
          const key: string = `${params.organizationId}|${params.tab}`;
          const previous: MyTasksRead | null = loads.last?.key === key ? loads.last.read : null;
          const passive: boolean = loads.passive && previous !== null;
          loads.passive = false;
          try {
            const page: MyTasksPage = await api.read(params.tab, { passive, signal: abortSignal });
            const read: MyTasksRead = {
              ...page,
              tab: params.tab,
              today: localDay(new Date()),
              refreshFailed: false,
            };
            loads.last = { key, read };
            loads.refused = false;
            if (!abortSignal.aborted) patchState(store, { _counts: page.counts });
            return read;
          } catch (error: unknown) {
            if (previous === null || abortSignal.aborted) throw error;
            if (passive && contextRefused(error)) {
              loads.refused = true;
              return previous;
            }
            return { ...previous, refreshFailed: true };
          }
        },
      });
      const people: ResourceRef<readonly Person[] | undefined> = resource({
        params: (): { organizationId: string } | undefined => {
          const organizationId: string | null = store._organizationId();
          return organizationId === null ? undefined : { organizationId };
        },
        loader: ({ abortSignal }: { abortSignal: AbortSignal }): Promise<readonly Person[]> =>
          api.people(abortSignal),
      });
      return {
        _loads: loads,
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
        people: computed((): readonly Person[] =>
          store._people.hasValue() ? store._people.value() : [],
        ),
        listNames: computed(
          (): ReadonlyMap<string, string> =>
            new Map(
              lists().map((list: ListDirectoryEntry): [string, string] => [list.id, list.name]),
            ),
        ),
        listsKnown: computed((): boolean => lists().length > 0),
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
      const reload: (passive: boolean) => void = (passive: boolean): void => {
        if (store._tasks.isLoading()) {
          store._loads.queued = (store._loads.queued ?? true) && passive;
          return;
        }
        if (!store._tasks.hasValue()) return;
        store._loads.passive = passive;
        store._tasks.reload();
      };
      return {
        _settled: signalMethod<boolean>((loading: boolean): void => {
          if (loading || store._loads.queued === null) return;
          const passive: boolean = store._loads.queued;
          store._loads.queued = null;
          reload(passive);
        }),
        _verified(): void {
          if (!store._loads.refused) return;
          store._loads.refused = false;
          reload(true);
        },
        _followOrganization: signalMethod<string>((organizationId: string): void => {
          if (organizationId === store._organizationId()) return;
          store._loads.queued = null;
          store._loads.refused = false;
          store._loads.last = null;
          patchState(store, { _organizationId: organizationId, _counts: null });
        }),
        show: signalMethod<MyTasksTab>((tab: MyTasksTab): void => {
          if (tab === store._tab()) return;
          store._loads.queued = null;
          patchState(store, { _tab: tab });
        }),
        refresh(): void {
          reload(true);
        },
        retry(): void {
          reload(false);
        },
        loadPeople(): void {
          if (store._people.status() === 'error') store._people.reload();
        },
      };
    }),
    withHooks({
      onInit(store): void {
        store._followOrganization(computed((): string => store._workspace.organization().id));
        store._settled(computed((): boolean => store._tasks.isLoading()));
        const window: Window | null = store._window;
        merge(
          store._realtime?.reconnected ?? EMPTY,
          window ? fromEvent(window, 'focus') : EMPTY,
          store._taskDetail.closed,
          store._taskDetail.changed,
          store._taskCreate.created,
        )
          .pipe(takeUntilDestroyed())
          .subscribe((): void => {
            store.refresh();
          });
        const verified: Observable<void> = store._pin.organizationVerified;
        verified.pipe(takeUntilDestroyed()).subscribe((): void => {
          store._verified();
        });
      },
    }),
  );
}

/**
 * Constant MyTasksStore
 *
 * @description
 * Provided by `MyTasksPage`, so the error boundary's `Retry`, which re-creates the page, starts
 * over. It reads the caller's assigned tasks of the address's tab in the workspace's organization
 * (`MyTasksApi.read`, every page to the last cursor), the first time as an active read whose
 * failure fails the page. There is no realtime event for these tasks (gap G-R1), so the tab is
 * read again, in the background and keeping its rows, on window focus, after a realtime
 * reconnection, when a task detail closes or reports a change, after a creation, and on
 * `refresh()` (the page's own writes); a read asked for while another runs is sent once it settles.
 * A refresh that fails keeps the previous rows with `refreshFailed`; one refused while the
 * organization context is stale keeps them silently and is sent again once the context is
 * verified. An organization switch or a tab change drops the rows at once and reads anew: a read
 * of another organization is aborted and never shown. The tab counts stay while another tab of
 * the same organization is read. The members (`people`) are a secondary read: a failure leaves the
 * menu's `Assign` empty until `loadPeople()` reads them again. The list names come from Spaces'
 * `LIST_DIRECTORY`, which holds no archived list.
 *
 * @type {Type<MyTasksStoreInstance>}
 */
export const MyTasksStore: Type<MyTasksStoreInstance> = createMyTasksStore();
