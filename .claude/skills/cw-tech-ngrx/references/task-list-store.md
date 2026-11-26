# Task list example

## Canonical store

Reference implementation in the repository: `src/app/core/config/environment/state/runtime-config/runtime-config.store.ts` (root
store, private slice, a computed that guards a missing value, an async method over its
`data-access/` source) and its spec, which fakes that source.

Use this example as a starting point for the matching feature pattern: entities, a debounced search whose failure
is a state flag with a retry, and the mockup's status rules (status shown at once, one pending
change per task settling 460 ms after the last click, a return to the saved status cancelling it,
sends of one task never overlapping, rollback on failure, Undo with its own rollback). `TaskApi`,
`Task` and `StatusKey` are example names; the toast is a comment until `core/` provides it. The
example and its spec were compiled, linted and tested against the installed versions.

```ts
import { inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { setAllEntities, updateEntity, withEntities } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  concatMap,
  debounce,
  debounceTime,
  EMPTY,
  from,
  groupBy,
  mergeMap,
  pipe,
  switchMap,
  tap,
  timer,
} from 'rxjs';

import { TaskApi } from '../data-access/services/task-api';
import type { StatusKey, Task } from '../models/task';

/** From the mockup (`App.dc.html`, `animateStatus`): a status change settles 460 ms after the last click. */
const STATUS_SETTLE_MS = 460;

interface StatusRequest {
  readonly id: string;
  readonly status: StatusKey;
  /** An undo is sent at once and leaves no new snapshot. */
  readonly undo: boolean;
}

interface TaskListState {
  readonly query: string;
  readonly isLoading: boolean;
  readonly searchFailed: boolean;
  readonly selectedIds: readonly string[];
  /** Status shown at once for a click that has not settled: one pending change per task. */
  readonly _pending: Readonly<Record<string, StatusKey>>;
  /** Status before the last sent change, kept while the toast offers Undo. */
  readonly _undo: Readonly<Record<string, StatusKey>>;
}

const initialState: TaskListState = {
  query: '',
  isLoading: false,
  searchFailed: false,
  selectedIds: [],
  _pending: {},
  _undo: {},
};

/** Pure helper shared by several updaters: the record without one task. */
function omitTask<T>(record: Readonly<Record<string, T>>, id: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== id));
}

export const TaskListStore = signalStore(
  withEntities<Task>(),
  withState(initialState),
  withComputed(({ entities, _pending, selectedIds }) => {
    // Shared by the computed signals below: tasks as shown, pending clicks applied.
    const tasks = (): Task[] => {
      const pending = _pending();
      return entities().map((task) =>
        Object.hasOwn(pending, task.id) ? { ...task, status: pending[task.id] } : task,
      );
    };
    return {
      tasks,
      selectedCount: () => selectedIds().length,
      doneCount: () => tasks().filter((task) => task.status === 'done').length,
    };
  }),
  // The dependency goes in the `withMethods` factory because only methods use it; use `withProps`
  // when computed signals or hooks share it.
  withMethods((store, api = inject(TaskApi)) => {
    const search = rxMethod<string>(
      pipe(
        debounceTime(300),
        tap((query) => {
          patchState(store, { query, isLoading: true, searchFailed: false });
        }),
        switchMap((query) =>
          api.search(query).pipe(
            tapResponse({
              next: (tasks) => {
                patchState(store, setAllEntities(tasks), { isLoading: false });
              },
              // Keep the last tasks: the page shows the error panel with Retry.
              error: () => {
                patchState(store, { isLoading: false, searchFailed: true });
              },
            }),
          ),
        ),
      ),
    );

    const commit = ({ id, status, undo }: StatusRequest) => {
      const pending = store._pending();
      // A later click replaced this one, or a return to the saved status cancelled it.
      if (!Object.hasOwn(pending, id) || pending[id] !== status) return EMPTY;
      if (!Object.hasOwn(store.entityMap(), id)) return EMPTY;
      const saved = store.entityMap()[id].status;
      const undoBefore = store._undo();
      patchState(store, updateEntity({ id, changes: { status } }), ({ _pending, _undo }) => ({
        _pending: omitTask(_pending, id),
        _undo: undo ? omitTask(_undo, id) : { ..._undo, [id]: saved },
      }));
      return from(api.changeStatus(id, status)).pipe(
        tapResponse({
          next: () => {
            // The server confirmed the status already shown.
          },
          error: () => {
            patchState(store, updateEntity({ id, changes: { status: saved } }), ({ _undo }) => ({
              _undo: Object.hasOwn(undoBefore, id)
                ? { ..._undo, [id]: undoBefore[id] }
                : omitTask(_undo, id),
            }));
            // Raise the error toast here once core/ provides the toast service.
          },
        }),
      );
    };

    // Per task: only the last click of a burst is sent, and sends never overlap.
    const send = rxMethod<StatusRequest>(
      pipe(
        groupBy((request) => request.id),
        mergeMap((requests) =>
          requests.pipe(
            debounce((request) => timer(request.undo ? 0 : STATUS_SETTLE_MS)),
            concatMap(commit),
          ),
        ),
      ),
    );

    return {
      select(ids: readonly string[]): void {
        patchState(store, { selectedIds: ids });
      },
      search,
      /** Retry on the error panel. */
      retrySearch(): void {
        search(store.query());
      },
      changeStatus(id: string, status: StatusKey): void {
        if (!Object.hasOwn(store.entityMap(), id)) return;
        if (store.entityMap()[id].status === status) {
          // Back to the saved status: the pending change is cancelled.
          patchState(store, ({ _pending }) => ({ _pending: omitTask(_pending, id) }));
          return;
        }
        patchState(store, ({ _pending }) => ({ _pending: { ..._pending, [id]: status } }));
        send({ id, status, undo: false });
      },
      /** The toast's Undo: restores the status the last change replaced. */
      undo(id: string): void {
        const snapshots = store._undo();
        if (!Object.hasOwn(snapshots, id)) return;
        const status = snapshots[id];
        patchState(store, ({ _pending }) => ({ _pending: { ..._pending, [id]: status } }));
        send({ id, status, undo: true });
      },
      /** Called when the toast closes: Undo is no longer offered. */
      forgetUndo(id: string): void {
        patchState(store, ({ _undo }) => ({ _undo: omitTask(_undo, id) }));
      },
    };
  }),
);
```

See its [canonical spec](task-list-store-spec.md).
