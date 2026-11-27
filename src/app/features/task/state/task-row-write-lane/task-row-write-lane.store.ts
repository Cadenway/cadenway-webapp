import { DestroyRef, inject, type Type } from '@angular/core';
import { signalStore, withMethods, withProps } from '@ngrx/signals';
import { firstValueFrom, type Observable, Subject } from 'rxjs';

import { readProblem } from '@core/api';

import { TaskApi } from '../../data-access/services/task-api/task-api.service';
import type { TaskSummary } from '../../models/task-summary/task-summary.interface';
import { TaskVersionConflict } from '../../models/task-write-error/task-write-error.model';
import type { TaskWriteLane } from '../../ports/task-write-lane';

/**
 * Type TaskLaneRead
 *
 * @description
 * What a read of a task by the lane found: the task as the gateway has it now, its absence (a
 * `404`: deleted or no longer visible), or no answer to rely on.
 *
 * @type {{ kind: 'read'; task: TaskSummary } | { kind: 'gone' } | { kind: 'failed' }}
 */
export type TaskLaneRead =
  | { readonly kind: 'read'; readonly task: TaskSummary }
  | { readonly kind: 'gone' }
  | { readonly kind: 'failed' };

/**
 * Interface TaskRowWriteLaneInstance
 *
 * @description
 * The one write path of the tasks of a page whose rows belong to no list, shared by its
 * `TaskStatusChangesStore` (through `TASK_WRITE_LANE`) and its `TaskRowActionsStore`.
 */
export interface TaskRowWriteLaneInstance extends TaskWriteLane {
  // #region Properties
  /**
   * Property reads
   *
   * @description
   * Emits each task the lane read again (after a conflict, a version that did not follow the
   * confirmed one, or on request), so the row writes show its values.
   *
   * @type {Observable<TaskSummary>}
   * @readonly
   */
  readonly reads: Observable<TaskSummary>;
  // #endregion

  // #region Methods
  /**
   * Method knownVersion
   *
   * @description
   * The newest version of a task the lane knows: the one its last write was sent at or returned,
   * or the one its last read found; undefined before any.
   *
   * @param {string} key - Key of the task.
   * @returns {number | undefined} The version.
   */
  knownVersion(key: string): number | undefined;

  /**
   * Method reconcile
   *
   * @description
   * Reads the task again (one read at a time per task), records its version and emits it on
   * `reads`; the next write of the task waits for that read.
   *
   * @param {string} key - Key of the task.
   * @returns {Promise<TaskLaneRead>} What the read found; it never rejects.
   */
  reconcile(key: string): Promise<TaskLaneRead>;
  // #endregion
}

/**
 * Function createTaskRowWriteLane
 *
 * @description
 * Creates the write lane store.
 *
 * @returns {Type<TaskRowWriteLaneInstance>} Injectable store constructor.
 */
function createTaskRowWriteLane(): Type<TaskRowWriteLaneInstance> {
  return signalStore(
    withProps(() => {
      const reads: Subject<TaskSummary> = new Subject<TaskSummary>();
      inject(DestroyRef).onDestroy((): void => {
        reads.complete();
      });
      return {
        _api: inject(TaskApi),
        _reads: reads,
        reads: reads.asObservable(),
        _lanes: new Map<string, Promise<void>>(),
        _known: new Map<string, number>(),
        _reconciling: new Map<string, Promise<TaskLaneRead>>(),
      };
    }),
    withMethods((store) => {
      const record: (key: string, version: number) => void = (
        key: string,
        version: number,
      ): void => {
        store._known.set(key, Math.max(store._known.get(key) ?? version, version));
      };

      const reconcile: (key: string) => Promise<TaskLaneRead> = (
        key: string,
      ): Promise<TaskLaneRead> => {
        const running: Promise<TaskLaneRead> | undefined = store._reconciling.get(key);
        if (running) return running;
        const run: Promise<TaskLaneRead> = (async (): Promise<TaskLaneRead> => {
          try {
            const task: TaskSummary = await firstValueFrom(store._api.read(key));
            record(key, task.version);
            store._reads.next(task);
            return { kind: 'read', task };
          } catch (error: unknown) {
            return readProblem(error)?.status === 404 ? { kind: 'gone' } : { kind: 'failed' };
          } finally {
            store._reconciling.delete(key);
          }
        })();
        store._reconciling.set(key, run);
        return run;
      };

      return {
        knownVersion(key: string): number | undefined {
          return store._known.get(key);
        },
        reconcile,
        write<T>(
          key: string,
          send: (version: number) => Promise<T>,
          fallback?: number,
        ): Promise<T> {
          const before: Promise<void> = store._lanes.get(key) ?? Promise.resolve();
          const run: Promise<T> = before.then(async (): Promise<T> => {
            const reading: Promise<TaskLaneRead> | undefined = store._reconciling.get(key);
            if (reading) await reading;
            const known: number | undefined = store._known.get(key);
            const version: number | undefined =
              known === undefined ? fallback : Math.max(known, fallback ?? known);
            if (version === undefined) throw new Error(`No confirmed version of ${key}.`);
            record(key, version);
            try {
              return await send(version);
            } catch (error: unknown) {
              if (error instanceof TaskVersionConflict) void reconcile(key);
              throw error;
            }
          });
          const settled: Promise<void> = run.then(
            (): void => undefined,
            (): void => undefined,
          );
          store._lanes.set(key, settled);
          void settled.then((): void => {
            if (store._lanes.get(key) === settled) store._lanes.delete(key);
          });
          return run;
        },
        acceptVersion(version: number, _changes?: Partial<TaskSummary>, key?: string): void {
          if (key === undefined) return;
          const known: number | undefined = store._known.get(key);
          if (known !== undefined && version <= known) return;
          if (known === undefined || version !== known + 1) {
            void reconcile(key);
            return;
          }
          record(key, version);
        },
      };
    }),
  );
}

/**
 * Constant TaskRowWriteLaneStore
 *
 * @description
 * The per-task write lane of a page whose rows belong to no list, provided on its route with
 * `TaskStatusChangesStore` and `TaskRowActionsStore` (`TASK_ROW_ACTIONS_PROVIDERS`), and as
 * `TASK_WRITE_LANE` for the status changes. A write of a task runs after the earlier ones, and
 * after a read of it still running, against the newest version known: the page's copy or the
 * version this lane last sent at, returned or read, whichever is newer. A returned version is
 * adopted only when it follows the known one (known + 1, the rule of `TaskDetailStore`): the write
 * was then the only change; any other newer version reads the task again and the next write waits
 * for that read. A `TaskVersionConflict` reads the task again the same way. Since every write
 * of the page goes through the lane, the page's own changes never cause a `412`.
 *
 * @type {Type<TaskRowWriteLaneInstance>}
 */
export const TaskRowWriteLaneStore: Type<TaskRowWriteLaneInstance> = createTaskRowWriteLane();
