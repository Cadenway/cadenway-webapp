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

import { HomeApi } from '../../data-access/services/home-api/home-api.service';
import type { HomeRead, HomeSnapshot } from '../../models/home-read/home-read.interface';
import { localDay } from '../../utils/home-dates/home-dates.util';

/**
 * Constant FOCUS_REFRESH_MS
 *
 * @description
 * How long after a read settled the window's focus does not read the home screen again, in
 * milliseconds.
 *
 * @type {number}
 */
export const FOCUS_REFRESH_MS: number = 30_000;

/**
 * Interface HomeState
 *
 * @description
 * Which organization the page reads and whether the members are wanted.
 */
interface HomeState {
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
   * The read shown, with the organization it was for: a refresh of the same organization that
   * fails shows it again instead of failing the page.
   *
   * @type {{ organizationId: string; read: HomeRead } | null}
   */
  last: { organizationId: string; read: HomeRead } | null;

  /**
   * Property settledAt
   *
   * @description
   * When the last read settled (`Date.now()`), or null before any.
   *
   * @type {number | null}
   */
  settledAt: number | null;
  // #endregion
}

/**
 * Interface HomeStoreInstance
 *
 * @description
 * The home screen of the caller in the current organization.
 */
export interface HomeStoreInstance {
  // #region Properties
  /**
   * Property read
   *
   * @description
   * The current read, undefined while the first read of this organization runs. Reading it throws
   * once that first read failed, so the page's template hands the failure to the route's error
   * boundary.
   *
   * @type {Signal<HomeRead | undefined>}
   * @readonly
   */
  readonly read: Signal<HomeRead | undefined>;

  /**
   * Property tasks
   *
   * @description
   * The priorities read, empty until a read succeeded or after its failure; the page binds
   * `TaskRowActionsStore.sync` to it.
   *
   * @type {Signal<readonly TaskSummary[]>}
   * @readonly
   */
  readonly tasks: Signal<readonly TaskSummary[]>;

  /**
   * Property reloading
   *
   * @description
   * Whether a read runs while values are shown (a refresh or `Retry`).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly reloading: Signal<boolean>;

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
   * Property spaceNames
   *
   * @description
   * The name of every space the sidebar holds at least one list of, by id: a list missing from
   * one of those spaces is archived (gap G-T1); a space without any (its overview failed or is
   * still read) says nothing.
   *
   * @type {Signal<ReadonlyMap<string, string>>}
   * @readonly
   */
  readonly spaceNames: Signal<ReadonlyMap<string, string>>;

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
   * Method refresh
   *
   * @description
   * Reads the home screen again in the background, keeping the values shown; sent once the
   * running read settles when one runs.
   */
  refresh(): void;

  /**
   * Method retry
   *
   * @description
   * `Retry` of the inline error: reads the home screen again as an active request.
   */
  retry(): void;

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
 * No organization yet.
 *
 * @type {HomeState}
 */
const initialState: HomeState = { _organizationId: null, _peopleWanted: false };

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
 * Function createHomeStore
 *
 * @description
 * Creates the store of the home screen.
 *
 * @returns {Type<HomeStoreInstance>} Injectable store constructor.
 */
function createHomeStore(): Type<HomeStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps((store) => {
      const api: HomeApi = inject(HomeApi);
      const loads: ReadLoads = {
        passive: false,
        queued: null,
        refused: false,
        last: null,
        settledAt: null,
      };
      const home: ResourceRef<HomeRead | undefined> = resource({
        params: (): { organizationId: string } | undefined => {
          const organizationId: string | null = store._organizationId();
          return organizationId === null ? undefined : { organizationId };
        },
        loader: async ({
          params,
          abortSignal,
        }: {
          params: { organizationId: string };
          abortSignal: AbortSignal;
        }): Promise<HomeRead> => {
          const previous: HomeRead | null =
            loads.last?.organizationId === params.organizationId ? loads.last.read : null;
          const passive: boolean = loads.passive && previous !== null;
          loads.passive = false;
          const today: string = localDay(new Date());
          try {
            const snapshot: HomeSnapshot = await api.read(today, {
              passive,
              signal: abortSignal,
            });
            loads.refused = false;
            const read: HomeRead = { ...snapshot, today, refreshFailed: false };
            loads.last = { organizationId: params.organizationId, read };
            return read;
          } catch (error: unknown) {
            if (abortSignal.aborted || previous === null) throw error;
            if (passive && contextRefused(error)) {
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
      return {
        _loads: loads,
        _home: home,
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
        read: computed((): HomeRead | undefined => store._home.value()),
        tasks: computed((): readonly TaskSummary[] =>
          store._home.hasValue() ? store._home.value().priorities : [],
        ),
        reloading: computed((): boolean => store._home.status() === 'reloading'),
        people: computed((): readonly Person[] =>
          store._people.hasValue() ? store._people.value() : [],
        ),
        listNames: computed(
          (): ReadonlyMap<string, string> =>
            new Map(
              lists().map((list: ListDirectoryEntry): [string, string] => [list.id, list.name]),
            ),
        ),
        spaceNames: computed(
          (): ReadonlyMap<string, string> =>
            new Map(
              lists().map((list: ListDirectoryEntry): [string, string] => [
                list.spaceId,
                list.spaceName,
              ]),
            ),
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
      const reload: (passive: boolean) => void = (passive: boolean): void => {
        if (store._home.isLoading()) {
          store._loads.queued = (store._loads.queued ?? true) && passive;
          return;
        }
        if (!store._home.hasValue()) return;
        store._loads.passive = passive;
        store._home.reload();
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
          store._loads.queued = null;
          store._loads.refused = false;
          store._loads.last = null;
          store._loads.settledAt = null;
          patchState(store, { _organizationId: organizationId, _peopleWanted: false });
        }),
        refresh(): void {
          reload(true);
        },
        retry(): void {
          reload(false);
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
        store._settled(computed((): boolean => store._home.isLoading()));
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
    }),
  );
}

/**
 * Constant HomeStore
 *
 * @description
 * Provided by `HomePage`, so the error boundary's `Retry`, which re-creates the page, starts over.
 * It reads the caller's home screen (`getHome`, against the local day of each read) in the
 * workspace's organization. The first read of an organization is active; its failure fails the
 * page. There is no realtime event for the caller's tasks across lists (gap G-R1), so the home
 * screen is read again, in the background and keeping its values, after a realtime reconnection,
 * when a task detail closes or reports a change, after a creation, on `refresh()` (the page's own
 * writes) and on window focus unless a read settled less than 30 s before (`FOCUS_REFRESH_MS`); a
 * read asked for while another runs is sent once it settles. A refresh that fails keeps the
 * previous values with `refreshFailed`; one refused while the organization context is stale keeps
 * them silently and is sent again once the context is verified. An organization switch drops the
 * values at once and reads anew: a read of the previous organization is aborted and never shown.
 * The members (`people`) are a secondary read made when the task menu first opens: a failure
 * leaves the menu's `Assign` empty until the next opening reads them again. The list and space
 * names come from Spaces' `LIST_DIRECTORY`, which holds no archived list.
 *
 * @type {Type<HomeStoreInstance>}
 */
export const HomeStore: Type<HomeStoreInstance> = createHomeStore();
