import {
  computed,
  DOCUMENT,
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
import { auditTime, EMPTY, filter, fromEvent, merge, type Observable } from 'rxjs';

import { OrganizationPin, OrganizationSwitchPendingError } from '@core/api';
import { RealtimeConnection } from '@core/realtime';

import { NAVIGATION_REFRESH } from '@features/spaces/ports/navigation-refresh';
import { TaskDetailOpener } from '@features/task';

import {
  ArchivesApi,
  isForbiddenRestore,
  isUncertainRestore,
} from '../../data-access/services/archives-api/archives-api.service';
import type { ArchiveCheck } from '../../models/archive-check/archive-check.type';
import { ARCHIVES_CONFIRM_DELAYS_MS } from './archives-confirm-delays.token';
import type { ArchivedListItem } from '../../models/archived-list/archived-list.interface';
import type { ArchivedTaskItem } from '../../models/archived-task/archived-task.interface';
import type { ArchivesRead } from '../../models/archives-read/archives-read.interface';
import type { RestoreOutcome } from '../../models/restore-outcome/restore-outcome.type';

/**
 * Constant REFRESH_AUDIT_MS
 *
 * @description
 * Window, in milliseconds, opened by the first background trigger of a burst (focus, visibility,
 * reconnection, a closed task detail); the archives are read once at its end.
 *
 * @type {number}
 */
export const REFRESH_AUDIT_MS: number = 300;

/**
 * Function wait
 *
 * @description
 * Resolves after a delay.
 *
 * @param {number} ms - Delay in milliseconds.
 * @returns {Promise<void>} Resolves once it elapsed.
 */
function wait(ms: number): Promise<void> {
  return new Promise<void>((resolve: () => void) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Interface ArchivesSnapshot
 *
 * @description
 * A read of the archives, with the organization it belongs to and its sequence.
 */
export interface ArchivesSnapshot {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * Organization the read was made for.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property sequence
   *
   * @description
   * Sequence of the read, counted from 1 since the store was created; a restore confirmed when
   * this many reads had started hides its item from this read and every earlier one.
   *
   * @type {number}
   * @readonly
   */
  readonly sequence: number;

  /**
   * Property read
   *
   * @description
   * Both tabs as the gateway answered them.
   *
   * @type {ArchivesRead}
   * @readonly
   */
  readonly read: ArchivesRead;
  // #endregion
}

/**
 * Interface ArchivesState
 *
 * @description
 * The organization read, the restores in flight and the restores the gateway confirmed.
 */
interface ArchivesState {
  // #region Properties
  /**
   * Property _organizationId
   *
   * @description
   * Organization whose archives are read, or null outside a workspace.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _organizationId: string | null;

  /**
   * Property _pending
   *
   * @description
   * Items (`list:<id>`, `task:<key>`) whose restore runs; their `Restore` is busy.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly _pending: readonly string[];

  /**
   * Property _restored
   *
   * @description
   * Items whose restore the gateway confirmed, each with the number of reads started at that
   * moment: a read up to that sequence may predate the restore and never shows the item again; a
   * later read is the gateway's word.
   *
   * @type {Readonly<Partial<Record<string, number>>>}
   * @readonly
   */
  readonly _restored: Readonly<Partial<Record<string, number>>>;
  // #endregion
}

/**
 * Interface ArchivesLoads
 *
 * @description
 * How the next read is sent, which reads and organization generation are current, and the last
 * successful read, kept while a background read fails.
 */
interface ArchivesLoads {
  // #region Properties
  /**
   * Property passive
   *
   * @description
   * Whether the next read was triggered in the background; the first read of an organization is
   * active.
   *
   * @type {boolean}
   */
  passive: boolean;

  /**
   * Property queued
   *
   * @description
   * Whether a background read was asked for while one ran; it is sent once that one settles.
   *
   * @type {boolean}
   */
  queued: boolean;

  /**
   * Property sequence
   *
   * @description
   * Reads started so far.
   *
   * @type {number}
   */
  sequence: number;

  /**
   * Property generation
   *
   * @description
   * Organization switches so far; a write of an older generation changes nothing.
   *
   * @type {number}
   */
  generation: number;

  /**
   * Property last
   *
   * @description
   * The last successful read, or null before the first one of the organization.
   *
   * @type {ArchivesSnapshot | null}
   */
  last: ArchivesSnapshot | null;

  /**
   * Property destroyed
   *
   * @description
   * Whether the store (and so its page) is gone; a restore that ends afterwards reports `stale`.
   *
   * @type {boolean}
   */
  destroyed: boolean;
  // #endregion
}

/**
 * Interface ArchivesStoreInstance
 *
 * @description
 * The archived lists and tasks of the current organization and their restores.
 */
export interface ArchivesStoreInstance {
  // #region Properties
  /**
   * Property archives
   *
   * @description
   * The primary read of the page: both tabs, read when the organization is known. Reading its
   * value in the error state throws the loader's failure, which the route's error boundary shows.
   * A background read that fails keeps the last read instead.
   *
   * @type {ResourceRef<ArchivesSnapshot | undefined>}
   * @readonly
   */
  readonly archives: ResourceRef<ArchivesSnapshot | undefined>;

  /**
   * Property loading
   *
   * @description
   * Whether the archives are read with nothing to show yet.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loading: Signal<boolean>;

  /**
   * Property lists
   *
   * @description
   * The archived lists, without those whose restore was confirmed after the read began; empty
   * while loading and after a failure.
   *
   * @type {Signal<readonly ArchivedListItem[]>}
   * @readonly
   */
  readonly lists: Signal<readonly ArchivedListItem[]>;

  /**
   * Property tasks
   *
   * @description
   * The archived roots, without those whose restore was confirmed after the read began; empty
   * while loading and after a failure.
   *
   * @type {Signal<readonly ArchivedTaskItem[]>}
   * @readonly
   */
  readonly tasks: Signal<readonly ArchivedTaskItem[]>;

  /**
   * Property listCount
   *
   * @description
   * The gateway's total of archived lists, less the restored lists the read still held.
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly listCount: Signal<number>;

  /**
   * Property taskCount
   *
   * @description
   * The gateway's total of archived roots, less the restored roots the read still held.
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly taskCount: Signal<number>;

  /**
   * Property memberNames
   *
   * @description
   * Member names by account id; empty while they are read and when their read failed, which
   * leaves the rows without their `by`.
   *
   * @type {Signal<ReadonlyMap<string, string>>}
   * @readonly
   */
  readonly memberNames: Signal<ReadonlyMap<string, string>>;
  // #endregion

  // #region Methods
  /**
   * Method listPending
   *
   * @description
   * Whether the restore of a list runs, confirmation reads included.
   *
   * @param {string} listId - The list.
   * @returns {boolean} Whether its `Restore` is busy.
   */
  listPending(listId: string): boolean;

  /**
   * Method taskPending
   *
   * @description
   * Whether the restore of a task runs, confirmation reads included.
   *
   * @param {string} taskKey - The task.
   * @returns {boolean} Whether its `Restore` is busy.
   */
  taskPending(taskKey: string): boolean;

  /**
   * Method restoreList
   *
   * @description
   * Unarchives a list. Once confirmed in the organization where it started, `beforeLeave` runs
   * (the page moves focus off the row), the list leaves the tab, the sidebar is read again and so
   * are the archives (a task of that list now names it).
   *
   * @param {ArchivedListItem} list - The archived list.
   * @param {() => void} [beforeLeave] - Runs just before the row leaves the tab.
   * @returns {Promise<RestoreOutcome>} How it ended.
   */
  restoreList(list: ArchivedListItem, beforeLeave?: () => void): Promise<RestoreOutcome>;

  /**
   * Method restoreTask
   *
   * @description
   * Unarchives a task with its subtree (and its list when archived too). Once confirmed in the
   * organization where it started, `beforeLeave` runs, the task leaves the tab, the sidebar is
   * read again and so are the archives (its list may have left the `Lists` tab).
   *
   * @param {ArchivedTaskItem} task - The archived root.
   * @param {() => void} [beforeLeave] - Runs just before the row leaves the tab.
   * @returns {Promise<RestoreOutcome>} How it ended.
   */
  restoreTask(task: ArchivedTaskItem, beforeLeave?: () => void): Promise<RestoreOutcome>;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * No organization, no restore yet.
 *
 * @type {ArchivesState}
 */
const initialState: ArchivesState = { _organizationId: null, _pending: [], _restored: {} };

/**
 * Function listKey
 *
 * @description
 * The state key of a list.
 *
 * @param {string} listId - The list.
 * @returns {string} Its key.
 */
function listKey(listId: string): string {
  return `list:${listId}`;
}

/**
 * Function taskKey
 *
 * @description
 * The state key of a task.
 *
 * @param {string} key - The task key.
 * @returns {string} Its key.
 */
function taskKey(key: string): string {
  return `task:${key}`;
}

/**
 * Function createArchivesStore
 *
 * @description
 * Creates the archives store.
 *
 * @returns {Type<ArchivesStoreInstance>} Injectable store constructor.
 */
function createArchivesStore(): Type<ArchivesStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps((store) => {
      const api: ArchivesApi = inject(ArchivesApi);
      const loads: ArchivesLoads = {
        passive: false,
        queued: false,
        sequence: 0,
        generation: 0,
        last: null,
        destroyed: false,
      };
      const byOrganization: () => { organizationId: string } | undefined = () => {
        const organizationId: string | null = store._organizationId();
        return organizationId === null ? undefined : { organizationId };
      };
      return {
        _api: api,
        _loads: loads,
        _delays: inject(ARCHIVES_CONFIRM_DELAYS_MS),
        _pin: inject(OrganizationPin),
        _navigation: inject(NAVIGATION_REFRESH, { optional: true }),
        _opener: inject(TaskDetailOpener),
        _realtime: inject(RealtimeConnection, { optional: true }),
        _window: inject(DOCUMENT).defaultView,
        archives: resource({
          params: byOrganization,
          loader: async ({
            params,
            abortSignal,
          }: {
            params: { organizationId: string };
            abortSignal: AbortSignal;
          }): Promise<ArchivesSnapshot> => {
            const passive: boolean = loads.passive;
            loads.passive = false;
            const sequence: number = (loads.sequence += 1);
            try {
              const read: ArchivesRead = await api.read(passive, abortSignal);
              const snapshot: ArchivesSnapshot = {
                organizationId: params.organizationId,
                sequence,
                read,
              };
              if (params.organizationId === store._organizationId()) loads.last = snapshot;
              return snapshot;
            } catch (error: unknown) {
              // A background read never replaces the rows with the error state: the last read of
              // the same organization stays, and the next trigger reads again.
              const last: ArchivesSnapshot | null = loads.last;
              if (passive && last !== null && last.organizationId === params.organizationId) {
                return last;
              }
              throw error;
            }
          },
        }),
        _people: resource({
          params: byOrganization,
          loader: ({ abortSignal }: { abortSignal: AbortSignal }) => api.memberNames(abortSignal),
        }),
      };
    }),
    withComputed((store) => {
      const snapshot: Signal<ArchivesSnapshot | undefined> = computed(() =>
        store.archives.hasValue() ? store.archives.value() : undefined,
      );
      const shown: (key: string, sequence: number) => boolean = (
        key: string,
        sequence: number,
      ): boolean => {
        const restored: number | undefined = store._restored()[key];
        return restored === undefined || sequence > restored;
      };
      const lists: Signal<readonly ArchivedListItem[]> = computed(() => {
        const current: ArchivesSnapshot | undefined = snapshot();
        if (current === undefined) return [];
        return current.read.lists.filter((list: ArchivedListItem) =>
          shown(listKey(list.id), current.sequence),
        );
      });
      const tasks: Signal<readonly ArchivedTaskItem[]> = computed(() => {
        const current: ArchivesSnapshot | undefined = snapshot();
        if (current === undefined) return [];
        return current.read.tasks.filter((task: ArchivedTaskItem) =>
          shown(taskKey(task.key), current.sequence),
        );
      });
      return {
        lists,
        tasks,
        loading: computed(() => store.archives.isLoading() && !store.archives.hasValue()),
        listCount: computed(() => {
          const current: ArchivesSnapshot | undefined = snapshot();
          if (current === undefined) return 0;
          const hidden: number = current.read.lists.length - lists().length;
          return Math.max(0, current.read.listTotal - hidden);
        }),
        taskCount: computed(() => {
          const current: ArchivesSnapshot | undefined = snapshot();
          if (current === undefined) return 0;
          const hidden: number = current.read.tasks.length - tasks().length;
          return Math.max(0, current.read.taskTotal - hidden);
        }),
        memberNames: computed((): ReadonlyMap<string, string> =>
          store._people.hasValue() ? store._people.value() : new Map<string, string>(),
        ),
      };
    }),
    withMethods((store) => {
      const read: () => void = (): void => {
        if (store._organizationId() === null) return;
        if (store._people.status() === 'error') store._people.reload();
        if (store.archives.isLoading()) {
          store._loads.queued = true;
          return;
        }
        store._loads.passive = true;
        store.archives.reload();
      };
      const settle: (key: string) => void = (key: string): void => {
        patchState(store, {
          _pending: store._pending().filter((pending: string) => pending !== key),
        });
      };
      const confirmed: (key: string, beforeLeave: (() => void) | undefined) => RestoreOutcome = (
        key: string,
        beforeLeave: (() => void) | undefined,
      ): RestoreOutcome => {
        beforeLeave?.();
        patchState(store, {
          _pending: store._pending().filter((pending: string) => pending !== key),
          _restored: { ...store._restored(), [key]: store._loads.sequence },
        });
        store._navigation?.refresh();
        read();
        return 'restored';
      };
      const restore: (
        key: string,
        write: () => Promise<void>,
        check: () => Promise<ArchiveCheck>,
        beforeLeave: (() => void) | undefined,
      ) => Promise<RestoreOutcome> = async (
        key: string,
        write: () => Promise<void>,
        check: () => Promise<ArchiveCheck>,
        beforeLeave: (() => void) | undefined,
      ): Promise<RestoreOutcome> => {
        const organizationId: string | null = store._organizationId();
        if (organizationId === null || store._pending().includes(key)) return 'stale';
        const generation: number = store._loads.generation;
        const current: () => boolean = (): boolean =>
          !store._loads.destroyed &&
          generation === store._loads.generation &&
          store._pin.current() === organizationId;
        patchState(store, { _pending: [...store._pending(), key] });
        try {
          await write();
        } catch (error: unknown) {
          if (!current()) return 'stale';
          if (error instanceof OrganizationSwitchPendingError) {
            // Refused before it left: nothing changed, and the organization switch reads again.
            settle(key);
            return 'stale';
          }
          if (!isUncertainRestore(error)) {
            settle(key);
            read();
            return isForbiddenRestore(error) ? 'forbidden' : 'refused';
          }
          // The write may have been applied: the row stays pending while the item itself is read
          // again after each delay, until it reads live again.
          for (const delay of store._delays) {
            await wait(delay);
            if (!current()) return 'stale';
            let state: ArchiveCheck | null;
            try {
              state = await check();
            } catch {
              state = null;
            }
            if (!current()) return 'stale';
            if (state === 'restored') return confirmed(key, beforeLeave);
            if (state === 'gone') break;
          }
          settle(key);
          store._navigation?.refresh();
          read();
          return 'unconfirmed';
        }
        if (!current()) return 'stale';
        return confirmed(key, beforeLeave);
      };
      return {
        _refresh: read,
        _settled: signalMethod<boolean>((loading: boolean): void => {
          if (loading || !store._loads.queued) return;
          store._loads.queued = false;
          read();
        }),
        _followOrganization: signalMethod<string | null>((organizationId: string | null): void => {
          if (organizationId === store._organizationId()) return;
          store._loads.generation += 1;
          store._loads.passive = false;
          store._loads.queued = false;
          store._loads.last = null;
          patchState(store, { _organizationId: organizationId, _pending: [], _restored: {} });
        }),
        listPending(listId: string): boolean {
          return store._pending().includes(listKey(listId));
        },
        taskPending(key: string): boolean {
          return store._pending().includes(taskKey(key));
        },
        restoreList(list: ArchivedListItem, beforeLeave?: () => void): Promise<RestoreOutcome> {
          return restore(
            listKey(list.id),
            () => store._api.unarchiveList(list.id),
            () => store._api.checkList(list.id),
            beforeLeave,
          );
        },
        restoreTask(task: ArchivedTaskItem, beforeLeave?: () => void): Promise<RestoreOutcome> {
          return restore(
            taskKey(task.key),
            () => store._api.unarchiveTask(task.key),
            () => store._api.checkTask(task.key),
            beforeLeave,
          );
        },
      };
    }),
    withHooks({
      onInit(store): void {
        store._followOrganization(store._pin.current);
        store._settled(computed((): boolean => store.archives.isLoading()));
        const view: Window | null = store._window;
        const triggers: Observable<unknown>[] = [
          store._realtime?.reconnected ?? EMPTY,
          store._opener.closed,
        ];
        if (view) {
          triggers.push(
            fromEvent(view, 'focus'),
            fromEvent(view.document, 'visibilitychange').pipe(
              filter((): boolean => view.document.visibilityState === 'visible'),
            ),
          );
        }
        merge(...triggers)
          .pipe(auditTime(REFRESH_AUDIT_MS), takeUntilDestroyed())
          .subscribe((): void => {
            store._refresh();
          });
      },
      onDestroy(store): void {
        store._loads.destroyed = true;
      },
    }),
  );
}

/**
 * Constant ArchivesStore
 *
 * @description
 * Page-scoped on `ArchivesPage`. It reads both tabs of the archives of the organization the
 * organization pin holds, side by side, each up to `MAX_PAGES` pages, with the members' names:
 * actively
 * when the page opens (a failure reaches the route's error boundary), passively (in the background)
 * on focus, on a visible tab, after a realtime reconnection, after a task detail closes and after
 * each restore; no organization-wide notice exists (gap G-R2). A read asked for while another
 * runs is sent once it settles. A background read that fails keeps the last read. An organization
 * switch drops its rows, its pending and confirmed restores, and reads again; a restore that
 * started in an earlier organization changes nothing and reports `stale`. A confirmed restore
 * hides its item from every read that began before the confirmation, so an older read still in
 * flight cannot bring it back; a later read is the gateway's word. An unknown outcome (no answer,
 * a timeout, `408`, `5xx`) is never reported as a failure: the row stays pending while the item
 * itself is read again after each of `ARCHIVES_CONFIRM_DELAYS_MS`; it reports `restored` once the
 * item reads live, else `unconfirmed` (and reads the sidebar and the archives again). A write
 * refused because the organization was switching reports `stale` and reads nothing. A restore
 * that ends after the store is destroyed reports `stale`. A confirmed restore reads the sidebar
 * again through Spaces' `NAVIGATION_REFRESH`.
 *
 * @type {ReturnType<typeof createArchivesStore>}
 */
export const ArchivesStore: ReturnType<typeof createArchivesStore> = createArchivesStore();
