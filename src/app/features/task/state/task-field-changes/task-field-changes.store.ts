import { DestroyRef, inject, type Type } from '@angular/core';
import type { PriorityKey } from '@cadenway/contracts';
import { CwToastService } from '@cadenway/ui/components/toast';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  catchError,
  concatMap,
  EMPTY,
  groupBy,
  map,
  mergeMap,
  type Observable,
  of,
  pipe,
  Subject,
  throwError,
} from 'rxjs';

import { hasProblemCode, OrganizationPin, OrganizationSwitchPendingError } from '@core/api';

import { TaskApi } from '../../data-access/services/task-api/task-api.service';
import type { TaskSummary } from '../../models/task-summary/task-summary.interface';
import { TaskVersionConflict } from '../../models/task-write-error/task-write-error.model';

/**
 * Interface TaskFieldChange
 *
 * @description
 * The fields a row edits in place: the priority and the assignees. A field left out keeps its
 * value.
 */
export interface TaskFieldChange {
  // #region Properties
  /**
   * Property priority
   *
   * @description
   * New priority.
   *
   * @type {PriorityKey | undefined}
   * @readonly
   */
  readonly priority?: PriorityKey;

  /**
   * Property assigneeIds
   *
   * @description
   * New assignees, in order, as user ids.
   *
   * @type {readonly string[] | undefined}
   * @readonly
   */
  readonly assigneeIds?: readonly string[];
  // #endregion
}

/**
 * Interface FieldOverride
 *
 * @description
 * What a task shows over its last read while its edits are written: the edited fields and the
 * version the last confirmed write returned.
 */
interface FieldOverride extends TaskFieldChange {
  // #region Properties
  /**
   * Property version
   *
   * @description
   * Latest version known from this store's writes; the next write goes against it.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;

  /**
   * Property writing
   *
   * @description
   * Edits queued or in flight.
   *
   * @type {number}
   * @readonly
   */
  readonly writing: number;
  // #endregion
}

/**
 * Interface FieldRequest
 *
 * @description
 * One edit waiting for its turn among the writes of its task.
 */
interface FieldRequest {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the task (its key).
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property before
   *
   * @description
   * The task as it showed before this edit, restored when the edit fails.
   *
   * @type {TaskSummary}
   * @readonly
   */
  readonly before: TaskSummary;

  /**
   * Property change
   *
   * @description
   * Fields the edit sets.
   *
   * @type {TaskFieldChange}
   * @readonly
   */
  readonly change: TaskFieldChange;

  /**
   * Property organizationId
   *
   * @description
   * Organization committed when the edit was made; the write is dropped after a switch.
   *
   * @type {string | null}
   * @readonly
   */
  readonly organizationId: string | null;
  // #endregion
}

/**
 * Interface TaskFieldChangesState
 *
 * @description
 * The overrides of the edited tasks and the latest task each edit was made on.
 */
interface TaskFieldChangesState {
  // #region Properties
  /**
   * Property _overrides
   *
   * @description
   * Edited fields shown over the read tasks, by task id.
   *
   * @type {Readonly<Partial<Record<string, FieldOverride>>>}
   * @readonly
   */
  readonly _overrides: Readonly<Partial<Record<string, FieldOverride>>>;

  /**
   * Property _tasks
   *
   * @description
   * The task each latest edit was made on, by task id: its version is the floor of the next write.
   *
   * @type {Readonly<Partial<Record<string, TaskSummary>>>}
   * @readonly
   */
  readonly _tasks: Readonly<Partial<Record<string, TaskSummary>>>;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * No edit.
 *
 * @type {TaskFieldChangesState}
 */
const initialState: TaskFieldChangesState = { _overrides: {}, _tasks: {} };

/**
 * Function sameIds
 *
 * @description
 * Whether two lists of user ids hold the same people, in any order.
 *
 * @param {readonly string[]} first - First list.
 * @param {readonly string[]} second - Second list.
 * @returns {boolean} Whether they match.
 */
function sameIds(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((id: string) => second.includes(id));
}

/**
 * Function overlay
 *
 * @description
 * The task with the override applied, while its writes run or while the override is newer than
 * the read task; a task read again at the same or a later version wins.
 *
 * @param {FieldOverride | undefined} entry - The override of the task.
 * @param {TaskSummary} task - The task as last read.
 * @returns {TaskSummary} The task to show.
 */
function overlay(entry: FieldOverride | undefined, task: TaskSummary): TaskSummary {
  if (!entry || (entry.writing === 0 && entry.version <= task.version)) return task;
  return {
    ...task,
    ...(entry.priority === undefined ? {} : { priority: entry.priority }),
    ...(entry.assigneeIds === undefined ? {} : { assigneeIds: entry.assigneeIds }),
    version: Math.max(entry.version, task.version),
  };
}

/**
 * Interface TaskFieldChangesInstance
 *
 * @description
 * Public API of `TaskFieldChangesStore`.
 */
interface TaskFieldChangesInstance {
  // #region Properties
  /**
   * Property refreshed
   *
   * @description
   * Tasks read again after a conflicting edit, which the caller puts in place of its copy.
   *
   * @type {Observable<TaskSummary>}
   * @readonly
   */
  readonly refreshed: Observable<TaskSummary>;
  // #endregion

  // #region Methods
  /**
   * Method displayed
   *
   * @description
   * The task with its edits shown at once, its version included.
   *
   * @param {TaskSummary} task - The task as last read.
   * @returns {TaskSummary} The task to show and to write against.
   */
  displayed(task: TaskSummary): TaskSummary;

  /**
   * Method edit
   *
   * @description
   * Shows the edit at once and writes it after the earlier edits of the task, against the
   * version they returned, with `If-Match`.
   *
   * @param {TaskSummary} task - The task as last read.
   * @param {TaskFieldChange} change - Fields to set.
   */
  edit(task: TaskSummary, change: TaskFieldChange): void;
  // #endregion
}

/**
 * Function createTaskFieldChanges
 *
 * @description
 * Creates the store of the in-place edits of tasks.
 *
 * @returns {Type<TaskFieldChangesInstance>} Injectable store constructor.
 */
function createTaskFieldChanges(): Type<TaskFieldChangesInstance> {
  return signalStore(
    withState(initialState),
    withProps(() => {
      const refreshed: Subject<TaskSummary> = new Subject<TaskSummary>();
      inject(DestroyRef).onDestroy(() => {
        refreshed.complete();
      });
      return { _refreshed: refreshed, refreshed: refreshed.asObservable() };
    }),
    withMethods(
      (store, api: TaskApi = inject(TaskApi), toasts: CwToastService = inject(CwToastService)) => {
        const destroyRef: DestroyRef = inject(DestroyRef);
        const organizationPin: OrganizationPin = inject(OrganizationPin);

        const displayed: (task: TaskSummary) => TaskSummary = (task: TaskSummary): TaskSummary =>
          overlay(store._overrides()[task.id], task);

        const settle: (id: string, version: number | null, revert: FieldRequest | null) => void = (
          id: string,
          version: number | null,
          revert: FieldRequest | null,
        ): void => {
          patchState(store, (state: TaskFieldChangesState): Partial<TaskFieldChangesState> => {
            const entry: FieldOverride | undefined = state._overrides[id];
            if (!entry) return {};
            let next: FieldOverride = {
              ...entry,
              writing: Math.max(0, entry.writing - 1),
              version: version === null ? entry.version : Math.max(entry.version, version),
            };
            if (revert) {
              const { change, before }: FieldRequest = revert;
              if (change.priority !== undefined && next.priority === change.priority) {
                next = { ...next, priority: before.priority };
              }
              if (
                change.assigneeIds !== undefined &&
                next.assigneeIds !== undefined &&
                sameIds(next.assigneeIds, change.assigneeIds)
              ) {
                next = { ...next, assigneeIds: before.assigneeIds };
              }
            }
            return { _overrides: { ...state._overrides, [id]: next } };
          });
        };

        const write: (request: FieldRequest, version: number) => Observable<number | null> = (
          { before, change }: FieldRequest,
          version: number,
        ): Observable<number | null> => {
          const key: string = before.key;
          const steps: ((at: number) => Observable<number | null>)[] = [];
          if (change.priority !== undefined && change.priority !== before.priority) {
            const priority: PriorityKey = change.priority;
            steps.push((at: number) =>
              api
                .changePriority(key, at, priority)
                .pipe(map((saved: TaskSummary) => saved.version)),
            );
          }
          if (change.assigneeIds !== undefined) {
            const next: readonly string[] = change.assigneeIds;
            for (const userId of next.filter((id: string) => !before.assigneeIds.includes(id))) {
              steps.push((at: number) =>
                api.assign(key, at, userId).pipe(map((saved: TaskSummary) => saved.version)),
              );
            }
            for (const userId of before.assigneeIds.filter((id: string) => !next.includes(id))) {
              steps.push((at: number) => api.unassign(key, at, userId));
            }
          }
          return steps.reduce(
            (chain: Observable<number | null>, step: (at: number) => Observable<number | null>) =>
              chain.pipe(
                concatMap((at: number | null) =>
                  at === null ? throwError(() => new TaskVersionConflict(key)) : step(at),
                ),
              ),
            of<number | null>(version),
          );
        };

        const commit: (request: FieldRequest) => Observable<unknown> = (
          request: FieldRequest,
        ): Observable<unknown> => {
          const { id, before }: FieldRequest = request;
          if (request.organizationId !== organizationPin.current()) {
            settle(id, null, request);
            return EMPTY;
          }
          const latest: TaskSummary = store._tasks()[id] ?? before;
          const version: number = Math.max(
            store._overrides()[id]?.version ?? 0,
            latest.version,
            before.version,
          );
          return write(request, version).pipe(
            catchError((error: unknown) =>
              error instanceof TaskVersionConflict
                ? api
                    .read(before.key)
                    .pipe(
                      map((fresh: TaskSummary): { conflict: TaskSummary } => ({ conflict: fresh })),
                    )
                : throwError(() => error),
            ),
            tapResponse({
              next: (result: number | null | { conflict: TaskSummary }): void => {
                if (typeof result === 'object' && result !== null) {
                  const fresh: TaskSummary = result.conflict;
                  patchState(
                    store,
                    (state: TaskFieldChangesState): Partial<TaskFieldChangesState> => ({
                      _overrides: {
                        ...state._overrides,
                        [id]: {
                          version: fresh.version,
                          writing: Math.max(0, (state._overrides[id]?.writing ?? 1) - 1),
                        },
                      },
                      _tasks: { ...state._tasks, [id]: fresh },
                    }),
                  );
                  store._refreshed.next(fresh);
                  if (!destroyRef.destroyed) {
                    toasts.warning(
                      $localize`:@@task.field-change.conflict:${before.key}:key: changed elsewhere`,
                      {
                        description: $localize`:@@task.field-change.conflict-text:Its latest values are shown.`,
                      },
                    );
                  }
                  return;
                }
                settle(id, result, null);
              },
              error: (error: unknown): void => {
                settle(id, null, request);
                if (
                  !destroyRef.destroyed &&
                  !(error instanceof OrganizationSwitchPendingError) &&
                  !hasProblemCode(error, 'organization.context-changed')
                ) {
                  toasts.error(
                    $localize`:@@task.field-change.failed:The change could not be saved`,
                    {
                      description: $localize`:@@task.status-change.failed-text:The server did not answer. Try again in a moment.`,
                    },
                  );
                }
              },
            }),
          );
        };

        const send: (request: FieldRequest) => void = rxMethod<FieldRequest>(
          pipe(
            groupBy((request: FieldRequest) => request.id),
            mergeMap((requests: Observable<FieldRequest>) => requests.pipe(concatMap(commit))),
          ),
        );

        return {
          displayed,
          edit(task: TaskSummary, change: TaskFieldChange): void {
            const before: TaskSummary = displayed(task);
            const effective: TaskFieldChange = {
              ...(change.priority !== undefined && change.priority !== before.priority
                ? { priority: change.priority }
                : {}),
              ...(change.assigneeIds !== undefined &&
              !sameIds(change.assigneeIds, before.assigneeIds)
                ? { assigneeIds: [...change.assigneeIds] }
                : {}),
            };
            if (effective.priority === undefined && effective.assigneeIds === undefined) return;
            patchState(store, (state: TaskFieldChangesState): Partial<TaskFieldChangesState> => {
              const entry: FieldOverride | undefined = state._overrides[task.id];
              return {
                _overrides: {
                  ...state._overrides,
                  [task.id]: {
                    priority: before.priority,
                    assigneeIds: before.assigneeIds,
                    ...effective,
                    version: Math.max(entry?.version ?? 0, before.version),
                    writing: (entry?.writing ?? 0) + 1,
                  },
                },
                _tasks: { ...state._tasks, [task.id]: task },
              };
            });
            send({
              id: task.id,
              before,
              change: effective,
              organizationId: organizationPin.current(),
            });
          },
        };
      },
    ),
  );
}

/**
 * Constant TaskFieldChangesStore
 *
 * @description
 * The in-place edits of a row's priority and assignees, provided by the route whose screens edit
 * tasks. Each edit shows at once (`displayed`); the edits of one task are written in order, each
 * against the version the previous one returned, with `If-Match`. An assignee change becomes one
 * assign or unassign call per person. A refused edit restores what it replaced and shows the
 * failure toast; a `412` reads the task again, emits it on `refreshed` and warns. An edit queued
 * before an organization switch is dropped.
 *
 * @type {Type<TaskFieldChangesInstance>}
 */
export const TaskFieldChangesStore: Type<TaskFieldChangesInstance> = createTaskFieldChanges();
