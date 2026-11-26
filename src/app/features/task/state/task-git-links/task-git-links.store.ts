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
import { pipe, tap } from 'rxjs';

import { TaskGitLinksApi } from '../../data-access/services/task-git-links-api/task-git-links-api.service';
import type {
  TaskGitLink,
  TaskGitLinkPage,
} from '../../models/task-git-link/task-git-link.interface';
import { TaskDetailStore } from '../task-detail/task-detail.store';

/**
 * Interface TaskGitLinksState
 *
 * @description
 * State of the Development panel.
 */
interface TaskGitLinksState {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The links read, newest first.
   *
   * @type {readonly TaskGitLink[]}
   * @readonly
   */
  readonly items: readonly TaskGitLink[];

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
   * Property loading
   *
   * @description
   * Whether the panel reads its pages itself (`Retry` or a pushed change).
   *
   * @type {boolean}
   * @readonly
   */
  readonly loading: boolean;

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
   * Property _key
   *
   * @description
   * Key of the task the links belong to.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _key: string | null;

  /**
   * Property _pages
   *
   * @description
   * Pages shown, so a pushed change reads the list again to the same depth.
   *
   * @type {number}
   * @readonly
   */
  readonly _pages: number;

  /**
   * Property _loaded
   *
   * @description
   * Whether a first page of this task's links was read (from the detail or by the panel).
   *
   * @type {boolean}
   * @readonly
   */
  readonly _loaded: boolean;

  /**
   * Property _readFailed
   *
   * @description
   * Whether the panel's own last read failed.
   *
   * @type {boolean}
   * @readonly
   */
  readonly _readFailed: boolean;

  /**
   * Property _revision
   *
   * @description
   * The `TaskDetailStore.gitRevision` the links shown reflect: the one at which the detail read
   * that carried them began, or at which the panel's own read began. A higher revision reads them
   * again.
   *
   * @type {number}
   * @readonly
   */
  readonly _revision: number;
  // #endregion
}

/**
 * Interface TaskGitLinksSource
 *
 * @description
 * What the panel follows of the detail: the open task and the Git part its last read carried.
 */
interface TaskGitLinksSource {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Key of the open task.
   *
   * @type {string | null}
   * @readonly
   */
  readonly key: string | null;

  /**
   * Property ready
   *
   * @description
   * Whether the detail was read.
   *
   * @type {boolean}
   * @readonly
   */
  readonly ready: boolean;

  /**
   * Property development
   *
   * @description
   * The first page of links the detail carries, or null.
   *
   * @type {TaskGitLinkPage | null}
   * @readonly
   */
  readonly development: TaskGitLinkPage | null;

  /**
   * Property missing
   *
   * @description
   * Whether the detail names `development` in `partial`.
   *
   * @type {boolean}
   * @readonly
   */
  readonly missing: boolean;

  /**
   * Property developmentRevision
   *
   * @description
   * The Git revision at which the detail read that carried (or missed) the links began.
   *
   * @type {number}
   * @readonly
   */
  readonly developmentRevision: number;

  /**
   * Property revision
   *
   * @description
   * The Git revision now: pushed Git changes counted so far.
   *
   * @type {number}
   * @readonly
   */
  readonly revision: number;
  // #endregion
}

/**
 * Interface TaskGitLinksStoreInstance
 *
 * @description
 * Public API of `TaskGitLinksStore`.
 */
export interface TaskGitLinksStoreInstance {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The links read, newest first.
   *
   * @type {Signal<readonly TaskGitLink[]>}
   * @readonly
   */
  readonly items: Signal<readonly TaskGitLink[]>;

  /**
   * Property ready
   *
   * @description
   * Whether a first page was read, so an empty list is the empty state.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly ready: Signal<boolean>;

  /**
   * Property loading
   *
   * @description
   * Whether the panel reads its pages itself.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loading: Signal<boolean>;

  /**
   * Property failed
   *
   * @description
   * Whether the links could not be read: the detail named `development` in `partial` and the
   * panel has read none since, or the panel's own last read failed. An inline error with `Retry`
   * (`load`), which stays while a read runs and clears once one succeeds.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly failed: Signal<boolean>;

  /**
   * Property hasMore
   *
   * @description
   * Whether older links remain.
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
   * Method load
   *
   * @description
   * Reads the links again to the depth shown, one page at least (`Retry`).
   *
   * @returns {Promise<void>} Resolves once read or failed.
   */
  load(): Promise<void>;

  /**
   * Method loadMore
   *
   * @description
   * Reads the next page (`Show more`); refused while the list is read again, since that read
   * replaces the cursor.
   *
   * @returns {Promise<void>} Resolves once read or failed.
   */
  loadMore(): Promise<void>;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * A panel with nothing read.
 *
 * @type {TaskGitLinksState}
 */
const initialState: TaskGitLinksState = {
  items: [],
  nextCursor: null,
  loading: false,
  loadingMore: false,
  moreFailed: false,
  _key: null,
  _pages: 0,
  _loaded: false,
  _readFailed: false,
  _revision: 0,
};

/**
 * Function withoutKnown
 *
 * @description
 * The links of a page not listed yet: a link created between two page reads shifts the cursor
 * order, so a later page can repeat one.
 *
 * @param {readonly TaskGitLink[]} known - The links listed.
 * @param {readonly TaskGitLink[]} page - The links of the page.
 * @returns {readonly TaskGitLink[]} The new links, in order.
 */
function withoutKnown(
  known: readonly TaskGitLink[],
  page: readonly TaskGitLink[],
): readonly TaskGitLink[] {
  const ids: ReadonlySet<string> = new Set<string>(known.map((link: TaskGitLink) => link.id));
  return page.filter((link: TaskGitLink): boolean => !ids.has(link.id));
}

/**
 * Function createTaskGitLinksStore
 *
 * @description
 * Builds the Development panel store.
 *
 * @returns {Type<TaskGitLinksStoreInstance>} Injectable store constructor.
 */
function createTaskGitLinksStore(): Type<TaskGitLinksStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps(() => ({
      _api: inject(TaskGitLinksApi),
      _detail: inject(TaskDetailStore),
    })),
    withComputed((store) => ({
      ready: computed((): boolean => store._loaded()),
      hasMore: computed((): boolean => store.nextCursor() !== null),
      failed: computed(
        (): boolean =>
          store._readFailed() ||
          (!store._loaded() &&
            store._detail.ready() &&
            store._detail.partial().includes('development')),
      ),
      _source: computed((): TaskGitLinksSource => ({
        key: store._detail.taskKey(),
        ready: store._detail.ready(),
        development: store._detail.development(),
        missing: store._detail.partial().includes('development'),
        developmentRevision: store._detail.developmentRevision(),
        revision: store._detail.gitRevision(),
      })),
    })),
    withMethods((store) => {
      let readToken: number = 0;
      let inflight: { readonly token: number; readonly revision: number } | null = null;

      const release: (token: number) => void = (token: number): void => {
        if (inflight?.token === token) inflight = null;
      };

      const load: () => Promise<void> = async (): Promise<void> => {
        const key: string | null = store._detail.taskKey();
        if (key === null) return;
        const token: number = ++readToken;
        const revision: number = store._detail.gitRevision();
        const depth: number = Math.max(1, store._pages());
        const current: () => boolean = (): boolean => token === readToken && store._key() === key;
        inflight = { token, revision };
        patchState(store, { loading: true, loadingMore: false });
        try {
          let items: readonly TaskGitLink[] = [];
          let cursor: string | null = null;
          let pages: number = 0;
          do {
            const page: TaskGitLinkPage = await store._api.page(key, cursor);
            if (!current()) return;
            items = [...items, ...withoutKnown(items, page.items)];
            cursor = page.nextCursor;
            pages++;
          } while (cursor !== null && pages < depth);
          patchState(store, {
            items,
            nextCursor: cursor,
            loading: false,
            loadingMore: false,
            moreFailed: false,
            _pages: pages,
            _loaded: true,
            _readFailed: false,
            _revision: Math.max(store._revision(), revision),
          });
        } catch {
          if (current()) {
            patchState(store, { loading: false, loadingMore: false, _readFailed: true });
          }
        } finally {
          release(token);
        }
      };

      return {
        load,

        async loadMore(): Promise<void> {
          const key: string | null = store._key();
          const cursor: string | null = store.nextCursor();
          if (key === null || cursor === null || store.loadingMore() || store.loading()) return;
          const token: number = readToken;
          patchState(store, { loadingMore: true, moreFailed: false });
          try {
            const page: TaskGitLinkPage = await store._api.page(key, cursor);
            if (token !== readToken || store._key() !== key) return;
            patchState(store, {
              items: [...store.items(), ...withoutKnown(store.items(), page.items)],
              nextCursor: page.nextCursor,
              loadingMore: false,
              _pages: store._pages() + 1,
            });
          } catch {
            if (token === readToken && store._key() === key) {
              patchState(store, { loadingMore: false, moreFailed: true });
            }
          }
        },

        _sync: rxMethod<TaskGitLinksSource>(
          pipe(
            tap((source: TaskGitLinksSource): void => {
              if (source.key !== store._key()) {
                readToken++;
                inflight = null;
                patchState(store, { ...initialState, _key: source.key });
              }
              if (source.key === null || !source.ready) return;
              if (!store._loaded()) {
                if (source.development) {
                  patchState(store, {
                    items: source.development.items,
                    nextCursor: source.development.nextCursor,
                    _pages: 1,
                    _loaded: true,
                    _readFailed: false,
                    _revision: source.developmentRevision,
                  });
                } else if (!source.missing) {
                  if (inflight === null) void load();
                  return;
                } else if (store._revision() < source.developmentRevision) {
                  patchState(store, { _revision: source.developmentRevision });
                }
              }
              if (source.revision > Math.max(store._revision(), inflight?.revision ?? -1)) {
                void load();
              }
            }),
          ),
        ),
      };
    }),
    withHooks({
      onInit(store): void {
        store._sync(store._source);
      },
    }),
  );
}

/**
 * Constant TaskGitLinksStore
 *
 * @description
 * The Git links of the open task for the Development panel (`App.dc.html` lines 2192-2268),
 * provided by `cw-task-detail-tabs` so it dies with the open task. It shows the first page the
 * detail carries (`TaskDetail.development`) without reading it again; when the detail names
 * `development` in `partial`, `failed` holds until `Retry` (`load`) reads it, and a detail that
 * neither carries nor misses the part makes the panel read it itself. Older links are read with
 * `Show more` (`loadMore`), refused while the list is read again. Each pushed
 * `git.links-changed.v1` counted by `TaskDetailStore.gitRevision` (already throttled per
 * `NOTICE_WINDOW_MS`, and counted for a reconnection too) past the revision the links reflect
 * reads the list again to the depth shown, also when the notice came while the detail was read;
 * a reread that fails keeps the links shown with the inline error. A read, or one of its pages,
 * answered after a newer one or for another task is dropped, and a reread ends any `Show more`
 * in flight.
 *
 * @type {Type<TaskGitLinksStoreInstance>}
 */
export const TaskGitLinksStore: Type<TaskGitLinksStoreInstance> = createTaskGitLinksStore();
