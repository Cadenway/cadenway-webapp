import { computed, inject, type Signal, type Type } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { distinctUntilChanged, filter, pipe, tap } from 'rxjs';

import { TaskSectionsApi } from '../../data-access/services/task-sections-api/task-sections-api.service';
import type {
  TaskActivityEntry,
  TaskActivityPage,
} from '../../models/task-detail-sections/task-detail-sections.interface';
import { TaskDetailStore } from '../task-detail/task-detail.store';

/**
 * Interface TaskActivityState
 *
 * @description
 * State of the activity tab.
 */
interface TaskActivityState {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The entries read, the most recent first.
   *
   * @type {readonly TaskActivityEntry[]}
   * @readonly
   */
  readonly items: readonly TaskActivityEntry[];

  /**
   * Property nextCursor
   *
   * @description
   * Cursor of the next page, or null on the last one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly nextCursor: string | null;

  /**
   * Property loaded
   *
   * @description
   * Whether a first page was read.
   *
   * @type {boolean}
   * @readonly
   */
  readonly loaded: boolean;

  /**
   * Property loading
   *
   * @description
   * Whether the first page is being read.
   *
   * @type {boolean}
   * @readonly
   */
  readonly loading: boolean;

  /**
   * Property failed
   *
   * @description
   * Whether the first page read failed.
   *
   * @type {boolean}
   * @readonly
   */
  readonly failed: boolean;

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
   * Whether the last later page read failed.
   *
   * @type {boolean}
   * @readonly
   */
  readonly moreFailed: boolean;

  /**
   * Property active
   *
   * @description
   * Whether the tab is shown (pushed changes read it again only then).
   *
   * @type {boolean}
   * @readonly
   */
  readonly active: boolean;
  // #endregion
}

/**
 * Interface TaskActivityStoreInstance
 *
 * @description
 * Public API of `TaskActivityStore`.
 */
export interface TaskActivityStoreInstance {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The entries read, the most recent first.
   *
   * @type {Signal<readonly TaskActivityEntry[]>}
   * @readonly
   */
  readonly items: Signal<readonly TaskActivityEntry[]>;

  /**
   * Property loading
   *
   * @description
   * Whether the first page is being read.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loading: Signal<boolean>;

  /**
   * Property failed
   *
   * @description
   * Whether the first page read failed (inline error with `Retry`).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly failed: Signal<boolean>;

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
   * Whether the last later page read failed.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly moreFailed: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method show
   *
   * @description
   * Marks the tab shown or hidden; showing it reads the first page again.
   *
   * @param {boolean} active - Whether the tab is shown.
   */
  show(active: boolean): void;

  /**
   * Method load
   *
   * @description
   * Reads the first page (`Retry`).
   *
   * @returns {Promise<void>} Resolves once read.
   */
  load(): Promise<void>;

  /**
   * Method loadMore
   *
   * @description
   * Reads the next page.
   *
   * @returns {Promise<void>} Resolves once read.
   */
  loadMore(): Promise<void>;
  // #endregion
}

/**
 * Function createTaskActivityStore
 *
 * @description
 * Builds the activity store.
 *
 * @returns {Type<TaskActivityStoreInstance>} Injectable store constructor.
 */
function createTaskActivityStore(): Type<TaskActivityStoreInstance> {
  const initialState: TaskActivityState = {
    items: [],
    nextCursor: null,
    loaded: false,
    loading: false,
    failed: false,
    loadingMore: false,
    moreFailed: false,
    active: false,
  };
  return signalStore(
    withState(initialState),
    withProps(() => ({
      _api: inject(TaskSectionsApi),
      _detail: inject(TaskDetailStore),
    })),
    withComputed((store) => ({
      hasMore: computed((): boolean => store.nextCursor() !== null),
      _version: computed((): number | null => store._detail.confirmedTask()?.version ?? null),
    })),
    withMethods((store) => {
      const load: () => Promise<void> = async (): Promise<void> => {
        const key: string | null = store._detail.taskKey();
        if (key === null) return;
        patchState(store, { loading: true, failed: false });
        try {
          const page: TaskActivityPage = await store._api.activityPage(key, null);
          if (store._detail.taskKey() !== key) return;
          patchState(store, {
            items: page.items,
            nextCursor: page.nextCursor,
            loaded: true,
            loading: false,
            moreFailed: false,
          });
        } catch {
          if (store._detail.taskKey() === key) patchState(store, { loading: false, failed: true });
        }
      };
      return {
        show(active: boolean): void {
          patchState(store, { active });
          if (active) void load();
        },

        load,

        async loadMore(): Promise<void> {
          const key: string | null = store._detail.taskKey();
          const cursor: string | null = store.nextCursor();
          if (key === null || cursor === null || store.loadingMore()) return;
          patchState(store, { loadingMore: true, moreFailed: false });
          try {
            const page: TaskActivityPage = await store._api.activityPage(key, cursor);
            const known: ReadonlySet<string> = new Set<string>(
              store.items().map((entry: TaskActivityEntry): string => entry.id),
            );
            patchState(store, {
              items: [
                ...store.items(),
                ...page.items.filter((entry: TaskActivityEntry): boolean => !known.has(entry.id)),
              ],
              nextCursor: page.nextCursor,
              loadingMore: false,
            });
          } catch {
            patchState(store, { loadingMore: false, moreFailed: true });
          }
        },

        _follow: rxMethod<number | null>(
          pipe(
            distinctUntilChanged(),
            filter((): boolean => store.active() && store.loaded()),
            tap((): void => {
              void load();
            }),
          ),
        ),
      };
    }),
    withHooks({
      onInit(store): void {
        store._follow(store._version);
      },
    }),
  );
}

/**
 * Constant TaskActivityStore
 *
 * @description
 * The activity log of the open task (`App.dc.html` lines 2326-2335), provided by
 * `cw-task-detail-tabs`. It reads the first page each time the tab is shown, and again while it
 * is shown when the confirmed task version moves (a change made here or pushed); older pages are
 * read with `Show more`. The loading state shows only while nothing is listed: a reread keeps the
 * entries shown.
 *
 * @type {Type<TaskActivityStoreInstance>}
 */
export const TaskActivityStore: Type<TaskActivityStoreInstance> = createTaskActivityStore();
