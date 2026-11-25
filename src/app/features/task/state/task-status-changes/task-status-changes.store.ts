import { DestroyRef, inject, type Signal, type Type } from '@angular/core';
import type { CancelReason, StatusKey } from '@cadenway/contracts';
import { CwToastService } from '@cadenway/ui/components/toast';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  catchError,
  concatMap,
  debounce,
  EMPTY,
  groupBy,
  map,
  mergeMap,
  type Observable,
  pipe,
  Subject,
  throwError,
  timer,
} from 'rxjs';

import { CANCEL_REASON_LABELS } from '../../constants/task-copy/task-copy.constants';
import { TaskApi } from '../../data-access/services/task-api/task-api.service';
import type { StatusOption } from '../../models/status-option/status-option.interface';
import type {
  TaskCancellation,
  TaskStatusChange,
} from '../../models/task-status-change/task-status-change.interface';
import type { TaskSummary } from '../../models/task-summary/task-summary.interface';
import { TaskVersionConflict } from '../../models/task-write-error/task-write-error.model';
import { statusLabel } from '../../utils/task-status/task-status.util';

/**
 * Constant STATUS_SETTLE_MS
 *
 * @description
 * Delay after the last click before a status change is sent and the task joins its new group
 * (`animateStatus` of `App.dc.html`), in milliseconds.
 *
 * @type {number}
 */
export const STATUS_SETTLE_MS: number = 460;

/**
 * Constant TOAST_MS
 *
 * @description
 * How long the change toast offers « Annuler », in milliseconds.
 *
 * @type {number}
 */
const TOAST_MS: number = 6000;

/**
 * Interface PendingChange
 *
 * @description
 * A click shown at once that has not settled yet.
 */
interface PendingChange {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * Status clicked last.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property cancellation
   *
   * @description
   * Reason and note of a cancellation, otherwise null.
   *
   * @type {TaskCancellation | null}
   * @readonly
   */
  readonly cancellation: TaskCancellation | null;
  // #endregion
}

/**
 * Interface SettledStatus
 *
 * @description
 * The status a task has after a settled change, sent or confirmed, with the version the next
 * write goes against.
 */
interface SettledStatus {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * Settled status.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property cancelReason
   *
   * @description
   * Its cancel reason, when cancelled.
   *
   * @type {CancelReason | null}
   * @readonly
   */
  readonly cancelReason: CancelReason | null;

  /**
   * Property version
   *
   * @description
   * Last version the gateway confirmed.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;

  /**
   * Property writing
   *
   * @description
   * Whether the write of this status is still in flight.
   *
   * @type {boolean}
   * @readonly
   */
  readonly writing: boolean;
  // #endregion
}

/**
 * Interface UndoSnapshot
 *
 * @description
 * What the toast's « Annuler » puts back: the status before the last confirmed change.
 */
interface UndoSnapshot {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * Previous status.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property cancelReason
   *
   * @description
   * Previous cancel reason, when the previous status was `cancelled`.
   *
   * @type {CancelReason | null}
   * @readonly
   */
  readonly cancelReason: CancelReason | null;

  /**
   * Property changedTo
   *
   * @description
   * Status the change it undoes led to; an undo applies only while the task still has it.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly changedTo: StatusKey;
  // #endregion
}

/**
 * Interface TaskCancelRequest
 *
 * @description
 * A request for « Annulé » that waits for the cancel reason dialog.
 */
export interface TaskCancelRequest {
  // #region Properties
  /**
   * Property taskKeys
   *
   * @description
   * Keys of the tasks the dialog cancels (its title names them).
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly taskKeys: readonly string[];
  // #endregion
}

/**
 * Interface StatusRequest
 *
 * @description
 * One click that reached the send stream of its task.
 */
interface StatusRequest {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the task.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property status
   *
   * @description
   * Status clicked.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property undo
   *
   * @description
   * Whether the request is the toast's « Annuler »: sent at once, without a new toast.
   *
   * @type {boolean}
   * @readonly
   */
  readonly undo: boolean;
  // #endregion
}

/**
 * Interface WriteOutcome
 *
 * @description
 * What a write ended with: the saved task, or the task as it is after a version conflict.
 */
interface WriteOutcome {
  // #region Properties
  /**
   * Property conflict
   *
   * @description
   * Whether the gateway refused the version and `task` is the task read again.
   *
   * @type {boolean}
   * @readonly
   */
  readonly conflict: boolean;

  /**
   * Property task
   *
   * @description
   * The task as the gateway has it.
   *
   * @type {TaskSummary}
   * @readonly
   */
  readonly task: TaskSummary;
  // #endregion
}

/**
 * Interface TaskStatusChangesState
 *
 * @description
 * Pending clicks, settled statuses and the cancel request, keyed by task id.
 */
interface TaskStatusChangesState {
  // #region Properties
  /**
   * Property cancelRequest
   *
   * @description
   * The « Annulé » click waiting for the cancel reason dialog, or null.
   *
   * @type {TaskCancelRequest | null}
   * @readonly
   */
  readonly cancelRequest: TaskCancelRequest | null;

  /**
   * Property _cancelTask
   *
   * @description
   * Task the cancel request is about.
   *
   * @type {TaskSummary | null}
   * @readonly
   */
  readonly _cancelTask: TaskSummary | null;

  /**
   * Property _pending
   *
   * @description
   * One pending click per task.
   *
   * @type {Readonly<Partial<Record<string, PendingChange>>>}
   * @readonly
   */
  readonly _pending: Readonly<Partial<Record<string, PendingChange>>>;

  /**
   * Property _settled
   *
   * @description
   * Status of each task after its last settled change.
   *
   * @type {Readonly<Partial<Record<string, SettledStatus>>>}
   * @readonly
   */
  readonly _settled: Readonly<Partial<Record<string, SettledStatus>>>;

  /**
   * Property _undo
   *
   * @description
   * What « Annuler » puts back, per task.
   *
   * @type {Readonly<Partial<Record<string, UndoSnapshot>>>}
   * @readonly
   */
  readonly _undo: Readonly<Partial<Record<string, UndoSnapshot>>>;

  /**
   * Property _tasks
   *
   * @description
   * The task each request came with, for its key, its milestone flag and its version.
   *
   * @type {Readonly<Partial<Record<string, TaskSummary>>>}
   * @readonly
   */
  readonly _tasks: Readonly<Partial<Record<string, TaskSummary>>>;

  /**
   * Property _options
   *
   * @description
   * Statuses of each space a request named, for the words of the toasts.
   *
   * @type {Readonly<Partial<Record<string, readonly StatusOption[]>>>}
   * @readonly
   */
  readonly _options: Readonly<Partial<Record<string, readonly StatusOption[]>>>;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * No change requested.
 *
 * @type {TaskStatusChangesState}
 */
const initialState: TaskStatusChangesState = {
  cancelRequest: null,
  _cancelTask: null,
  _pending: {},
  _settled: {},
  _undo: {},
  _tasks: {},
  _options: {},
};

/**
 * Function omit
 *
 * @description
 * The record without one key.
 *
 * @param {Readonly<Partial<Record<string, T>>>} record - Record to copy.
 * @param {string} id - Key to leave out.
 * @returns {Partial<Record<string, T>>} The copy.
 */
function omit<T>(
  record: Readonly<Partial<Record<string, T>>>,
  id: string,
): Partial<Record<string, T>> {
  return Object.fromEntries(
    Object.entries(record).filter(([key]: [string, T | undefined]) => key !== id),
  );
}

/**
 * Function settledOf
 *
 * @description
 * The settled status that still applies to a task: one in flight, or one confirmed at a version
 * newer than the task the caller holds. Once the caller's task catches up, it wins.
 *
 * @param {Readonly<Partial<Record<string, SettledStatus>>>} settled - Settled statuses.
 * @param {TaskSummary} task - Task as the caller holds it.
 * @returns {SettledStatus | null} The settled status, or null.
 */
function settledOf(
  settled: Readonly<Partial<Record<string, SettledStatus>>>,
  task: TaskSummary,
): SettledStatus | null {
  const entry: SettledStatus | undefined = settled[task.id];
  return entry && (entry.writing || entry.version > task.version) ? entry : null;
}

/**
 * Interface TaskStatusChangesInstance
 *
 * @description
 * The status change interaction of `cw-status-interactions`, shared by a route's lists, boards and
 * pickers.
 */
interface TaskStatusChangesInstance {
  // #region Properties
  /**
   * Property cancelRequest
   *
   * @description
   * The « Annulé » click waiting for the cancel reason dialog; the page renders
   * `cw-task-cancel-dialog` open while it is set.
   *
   * @type {Signal<TaskCancelRequest | null>}
   * @readonly
   */
  readonly cancelRequest: Signal<TaskCancelRequest | null>;

  /**
   * Property changed
   *
   * @description
   * Emits each change when it settles, 460 ms after the last click, so grouped views move the task
   * then; and again when a refusal or a conflict puts another status back.
   *
   * @type {Observable<TaskStatusChange>}
   * @readonly
   */
  readonly changed: Observable<TaskStatusChange>;
  // #endregion

  // #region Methods
  /**
   * Method pendingStatus
   *
   * @description
   * The clicked status of a task that has not settled yet; reactive in templates and computed
   * signals.
   *
   * @param {string} taskId - Id of the task.
   * @returns {StatusKey | null} The pending status, or null.
   */
  pendingStatus(taskId: string): StatusKey | null;

  /**
   * Method displayedStatus
   *
   * @description
   * The status the icon and the label show now: the pending click, else the settled change, else
   * the task's own status.
   *
   * @param {TaskSummary} task - Task as the caller holds it.
   * @returns {StatusKey} The status to show.
   */
  displayedStatus(task: TaskSummary): StatusKey;

  /**
   * Method settledStatus
   *
   * @description
   * The status a grouped view files the task under: it changes 460 ms after the last click.
   *
   * @param {TaskSummary} task - Task as the caller holds it.
   * @returns {StatusKey} The status to group by.
   */
  settledStatus(task: TaskSummary): StatusKey;

  /**
   * Method request
   *
   * @description
   * Shows a clicked status at once and settles it 460 ms after the last click with one versioned
   * write. A new click replaces the pending one, a click on the saved status cancels it, and
   * « Annulé » opens the cancel reason dialog first.
   *
   * @param {TaskSummary} task - Task as the caller holds it.
   * @param {StatusKey} status - Clicked status.
   * @param {readonly StatusOption[]} [options] - Statuses of the task's space, for the toast words.
   */
  request(task: TaskSummary, status: StatusKey, options?: readonly StatusOption[]): void;

  /**
   * Method confirmCancel
   *
   * @description
   * « Annuler la tâche »: requests `cancelled` with the dialog's reason and note.
   *
   * @param {TaskCancellation} cancellation - Reason and note.
   */
  confirmCancel(cancellation: TaskCancellation): void;

  /**
   * Method keepTask
   *
   * @description
   * « Garder la tâche »: closes the dialog without any change.
   */
  keepTask(): void;

  /**
   * Method undo
   *
   * @description
   * The toast's « Annuler »: sends the status before the last confirmed change at once, while the
   * task still has the status that change gave it.
   *
   * @param {string} taskId - Id of the task.
   */
  undo(taskId: string): void;
  // #endregion
}

/**
 * Function createTaskStatusChanges
 *
 * @description
 * Creates the status change store.
 *
 * @returns {Type<TaskStatusChangesInstance>} Injectable store constructor.
 */
function createTaskStatusChanges(): Type<TaskStatusChangesInstance> {
  return signalStore(
    withState(initialState),
    withProps(() => {
      const changes: Subject<TaskStatusChange> = new Subject<TaskStatusChange>();
      inject(DestroyRef).onDestroy(() => {
        changes.complete();
      });
      return { _changes: changes, changed: changes.asObservable() };
    }),
    withMethods(
      (store, api: TaskApi = inject(TaskApi), toasts: CwToastService = inject(CwToastService)) => {
        const settledStatus: (task: TaskSummary) => StatusKey = (task: TaskSummary): StatusKey =>
          settledOf(store._settled(), task)?.status ?? task.status;

        const labelOf: (task: TaskSummary, status: StatusKey) => string = (
          task: TaskSummary,
          status: StatusKey,
        ): string => statusLabel(status, store._options()[task.spaceId] ?? [], task.milestone);

        const failed: () => void = (): void => {
          toasts.error($localize`:@@task.status-change.failed:Could not change the status`, {
            description: $localize`:@@task.status-change.failed-text:The server did not answer. Try again in a moment.`,
          });
        };

        const confirmedToast: (task: TaskSummary, from: StatusKey, to: StatusKey) => void = (
          task: TaskSummary,
          from: StatusKey,
          to: StatusKey,
        ): void => {
          const reason: CancelReason | null = store._settled()[task.id]?.cancelReason ?? null;
          const title: string =
            to === 'cancelled'
              ? $localize`:@@task.status-change.cancelled:${task.key}:key: cancelled`
              : $localize`:@@task.status-change.moved:${task.key}:key: moved to ${labelOf(task, to)}:status:`;
          const description: string =
            to === 'cancelled' && reason
              ? $localize`:@@task.status-change.reason:Reason: ${CANCEL_REASON_LABELS[reason]}:reason:.`
              : $localize`:@@task.status-change.from:From ${labelOf(task, from)}:status:.`;
          toasts.show(title, {
            description,
            duration: TOAST_MS,
            undo: (): void => {
              undo(task.id);
            },
          });
        };

        const commit: (request: StatusRequest) => Observable<unknown> = ({
          id,
          status,
          undo: isUndo,
        }: StatusRequest): Observable<unknown> => {
          const pending: PendingChange | undefined = store._pending()[id];
          const task: TaskSummary | undefined = store._tasks()[id];
          if (pending?.status !== status || !task) return EMPTY;
          const before: SettledStatus | undefined = store._settled()[id];
          const current: SettledStatus | null = settledOf(store._settled(), task);
          const from: StatusKey = current?.status ?? task.status;
          const fromReason: CancelReason | null = current
            ? current.cancelReason
            : task.cancelReason;
          const version: number = current?.version ?? task.version;
          const reason: CancelReason | null = pending.cancellation?.reason ?? null;
          patchState(store, (state: TaskStatusChangesState) => ({
            _pending: omit(state._pending, id),
            _settled: {
              ...state._settled,
              [id]: { status, cancelReason: reason, version, writing: true },
            },
          }));
          store._changes.next({ taskId: id, from, to: status, reason });

          const restore: () => void = (): void => {
            patchState(store, (state: TaskStatusChangesState) => ({
              _settled: before ? { ...state._settled, [id]: before } : omit(state._settled, id),
            }));
            store._changes.next({ taskId: id, from: status, to: from, reason: fromReason });
          };

          return api.changeStatus(task.key, version, status, pending.cancellation).pipe(
            map((saved: TaskSummary): WriteOutcome => ({ conflict: false, task: saved })),
            catchError((error: unknown) =>
              error instanceof TaskVersionConflict
                ? api
                    .read(task.key)
                    .pipe(
                      map((fresh: TaskSummary): WriteOutcome => ({ conflict: true, task: fresh })),
                    )
                : throwError(() => error),
            ),
            tapResponse({
              next: ({ conflict, task: saved }: WriteOutcome): void => {
                patchState(store, (state: TaskStatusChangesState) => ({
                  _settled: {
                    ...state._settled,
                    [id]: {
                      status: saved.status,
                      cancelReason: saved.cancelReason,
                      version: saved.version,
                      writing: false,
                    },
                  },
                  _undo:
                    conflict || isUndo
                      ? omit(state._undo, id)
                      : {
                          ...state._undo,
                          [id]: { status: from, cancelReason: fromReason, changedTo: saved.status },
                        },
                }));
                if (conflict) {
                  if (saved.status !== status) {
                    store._changes.next({
                      taskId: id,
                      from: status,
                      to: saved.status,
                      reason: saved.cancelReason,
                    });
                  }
                  toasts.warning(
                    $localize`:@@task.status-change.conflict:${task.key}:key: changed elsewhere`,
                    {
                      description: $localize`:@@task.status-change.conflict-text:Its latest status is shown: ${labelOf(task, saved.status)}:status:.`,
                    },
                  );
                } else if (!isUndo) {
                  confirmedToast(task, from, saved.status);
                }
              },
              error: (): void => {
                restore();
                failed();
              },
            }),
          );
        };

        const send: (request: StatusRequest) => void = rxMethod<StatusRequest>(
          pipe(
            groupBy((request: StatusRequest) => request.id),
            mergeMap((requests: Observable<StatusRequest>) =>
              requests.pipe(
                debounce((request: StatusRequest) => timer(request.undo ? 0 : STATUS_SETTLE_MS)),
                concatMap(commit),
              ),
            ),
          ),
        );

        const place: (
          task: TaskSummary,
          status: StatusKey,
          cancellation: TaskCancellation | null,
        ) => void = (
          task: TaskSummary,
          status: StatusKey,
          cancellation: TaskCancellation | null,
        ): void => {
          if (status === settledStatus(task)) {
            patchState(store, (state: TaskStatusChangesState) => ({
              _pending: omit(state._pending, task.id),
            }));
            return;
          }
          patchState(store, (state: TaskStatusChangesState) => ({
            _pending: { ...state._pending, [task.id]: { status, cancellation } },
          }));
          send({ id: task.id, status, undo: false });
        };

        const undo: (taskId: string) => void = (taskId: string): void => {
          const snapshot: UndoSnapshot | undefined = store._undo()[taskId];
          const task: TaskSummary | undefined = store._tasks()[taskId];
          if (!snapshot || !task || settledStatus(task) !== snapshot.changedTo) return;
          if (store._pending()[taskId]) return;
          patchState(store, (state: TaskStatusChangesState) => ({
            _pending: {
              ...state._pending,
              [taskId]: {
                status: snapshot.status,
                cancellation: snapshot.cancelReason
                  ? { reason: snapshot.cancelReason, note: '' }
                  : null,
              },
            },
            _undo: omit(state._undo, taskId),
          }));
          send({ id: taskId, status: snapshot.status, undo: true });
        };

        return {
          pendingStatus(taskId: string): StatusKey | null {
            return store._pending()[taskId]?.status ?? null;
          },
          displayedStatus(task: TaskSummary): StatusKey {
            return store._pending()[task.id]?.status ?? settledStatus(task);
          },
          settledStatus,
          request(task: TaskSummary, status: StatusKey, options?: readonly StatusOption[]): void {
            patchState(store, (state: TaskStatusChangesState) => ({
              _tasks: { ...state._tasks, [task.id]: task },
              _options: options ? { ...state._options, [task.spaceId]: options } : state._options,
            }));
            if (status === 'cancelled' && settledStatus(task) !== 'cancelled') {
              patchState(store, { cancelRequest: { taskKeys: [task.key] }, _cancelTask: task });
              return;
            }
            place(task, status, null);
          },
          confirmCancel(cancellation: TaskCancellation): void {
            const task: TaskSummary | null = store._cancelTask();
            patchState(store, { cancelRequest: null, _cancelTask: null });
            if (task) place(task, 'cancelled', cancellation);
          },
          keepTask(): void {
            patchState(store, { cancelRequest: null, _cancelTask: null });
          },
          undo,
        };
      },
    ),
  );
}

/**
 * Constant TaskStatusChanges
 *
 * @description
 * The status change interaction (`cw-status-interactions`), provided by the route whose lists,
 * boards and pickers change statuses, so it dies with it. The icon and the label change at once;
 * one pending change per task settles 460 ms after the last click with one `updateTask` write
 * against its version (`If-Match`), and the writes of one task never overlap. A `412` reads the
 * task again and warns; any other failure puts the confirmed status back with a failure toast. A
 * confirmed change shows a 6 s toast whose « Annuler » restores the previous status.
 *
 * @type {Type<TaskStatusChangesInstance>}
 */
export const TaskStatusChanges: Type<TaskStatusChangesInstance> = createTaskStatusChanges();
