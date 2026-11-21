import { computed, inject, type Signal, type Type } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import type { StatusKey } from '@cadenway/contracts';
import { tapResponse } from '@ngrx/operators';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { type RxMethod, rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, switchMap, timer } from 'rxjs';

import { TaskDetailApi } from '../../data-access/services/task-detail/task-detail-api.service';
import {
  type TaskDetailFailure,
  TaskDetailRequestError,
} from '../../models/task-detail/task-detail-failure.model';
import type {
  TaskDetailView,
  TaskRouteContext,
  TaskStatusConfirmation,
  TaskStatusOption,
} from '../../models/task-detail/task-detail.model';

/**
 * Constant STATUS_SETTLE_DURATION
 *
 * @description
 * Wait in milliseconds for the last selection in a burst before sending a status command.
 *
 * @type {number}
 */
const STATUS_SETTLE_DURATION: number = 460;

/**
 * Interface TaskDetailState
 *
 * @description
 * Local route identity and state of the current optimistic status change.
 */
interface TaskDetailState {
  // #region Properties
  /**
   * Property _context
   *
   * @description
   * Task key and expected organization of the current routed page.
   *
   * @type {TaskRouteContext | undefined}
   * @readonly
   */
  readonly _context: TaskRouteContext | undefined;

  /**
   * Property _pendingStatus
   *
   * @description
   * Currently displayed optimistic value, until a change is confirmed or rejected.
   *
   * @type {StatusKey | null}
   * @readonly
   */
  readonly _pendingStatus: StatusKey | null;

  /**
   * Property savingStatus
   *
   * @description
   * A status command has started and must finish before another one can be sent.
   *
   * @type {boolean}
   * @readonly
   */
  readonly savingStatus: boolean;

  /**
   * Property statusSaved
   *
   * @description
   * Shows confirmation after an accepted status command.
   *
   * @type {boolean}
   * @readonly
   */
  readonly statusSaved: boolean;

  /**
   * Property statusFailure
   *
   * @description
   * Category of the last rejected status command, if any.
   *
   * @type {TaskDetailFailure | null}
   * @readonly
   */
  readonly statusFailure: TaskDetailFailure | null;
  // #endregion
}

/**
 * Interface TaskStatusCommand
 *
 * @description
 * Captures the route key and write precondition before scheduling a change.
 */
interface TaskStatusCommand extends TaskRouteContext, Pick<TaskDetailView, 'version'> {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * Target status that does not require a confirmation reason.
   *
   * @type {Exclude<StatusKey, 'cancelled'>}
   * @readonly
   */
  readonly status: Exclude<StatusKey, 'cancelled'>;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * The page starts without a loaded task or any pending edits.
 *
 * @type {TaskDetailState}
 */
const initialState: TaskDetailState = {
  _context: undefined,
  _pendingStatus: null,
  savingStatus: false,
  statusSaved: false,
  statusFailure: null,
};

/**
 * Function failureOf
 *
 * @description
 * Reads an accessible failure category from the task data-access boundary.
 *
 * @param {unknown} error - Error from an observable.
 * @returns {TaskDetailFailure} A category that is safe to show on the page.
 */
function failureOf(error: unknown): TaskDetailFailure {
  return error instanceof TaskDetailRequestError ? error.failure : 'unavailable';
}

/**
 * Function lostAccess
 *
 * @description
 * Indicates that detail from the previous session context must be hidden.
 *
 * @param {TaskDetailFailure | null} failure - The last request outcome.
 * @returns {failure is ('organization-changed' | 'session-expired')} Whether access was lost.
 */
function lostAccess(
  failure: TaskDetailFailure | null,
): failure is 'organization-changed' | 'session-expired' {
  return failure === 'organization-changed' || failure === 'session-expired';
}

/**
 * Interface TaskDetailStoreInstance
 *
 * @description
 * Public state and actions for the task page.
 */
interface TaskDetailStoreInstance {
  // #region Properties
  /**
   * Property detail
   *
   * @description
   * The visible task carrying its optimistic status, if one is pending.
   *
   * @type {Signal<TaskDetailView | undefined>}
   * @readonly
   */
  readonly detail: Signal<TaskDetailView | undefined>;

  /**
   * Property loading
   *
   * @description
   * Indicates whether the route is awaiting a new detail response.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loading: Signal<boolean>;

  /**
   * Property loadFailure
   *
   * @description
   * The safe display category when the task cannot be read.
   *
   * @type {Signal<TaskDetailFailure | null>}
   * @readonly
   */
  readonly loadFailure: Signal<TaskDetailFailure | null>;

  /**
   * Property savingStatus
   *
   * @description
   * A status command is in flight, so further commands are disabled.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly savingStatus: Signal<boolean>;

  /**
   * Property statusSaved
   *
   * @description
   * A status command was committed on the current task.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly statusSaved: Signal<boolean>;

  /**
   * Property statusFailure
   *
   * @description
   * Why the latest status command failed, when the task is still visible.
   *
   * @type {Signal<TaskDetailFailure | null>}
   * @readonly
   */
  readonly statusFailure: Signal<TaskDetailFailure | null>;
  // #endregion

  // #region Methods
  /**
   * Method followTask
   *
   * @description
   * Follows both routed inputs and drops pending work when either identity changes.
   *
   * @param {Signal<TaskRouteContext>} context - Signal bound to the task key and resolved organization.
   */
  followTask(context: Signal<TaskRouteContext>): void;

  /**
   * Method retry
   *
   * @description
   * Requests the current detail after a failure or partial response.
   */
  retry(): void;

  /**
   * Method changeStatus
   *
   * @description
   * Shows a selected status and schedules one versioned write.
   *
   * @param {StatusKey | null} status - Value selected from the task's current choices.
   */
  changeStatus(status: StatusKey | null): void;
  // #endregion
}

/**
 * Function createTaskDetailStore
 *
 * @description
 * Creates the page-scoped store and keeps its load and status command within the same lifetime.
 *
 * @returns {Type<TaskDetailStoreInstance>} The store provider consumed by the task page.
 */
function createTaskDetailStore(): Type<TaskDetailStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps((store, api = inject(TaskDetailApi)) => ({
      _detail: rxResource({
        params: () => store._context(),
        stream: (request) => api.load(request.params.key, request.params.organizationId),
      }),
    })),
    withComputed((store) => ({
      detail: computed(() => {
        if (lostAccess(store.statusFailure()) || !store._detail.hasValue()) return undefined;
        const detail: TaskDetailView = store._detail.value();
        const pending: StatusKey | null = store._pendingStatus();
        return pending ? { ...detail, status: pending } : detail;
      }),
      loading: store._detail.isLoading,
      loadFailure: computed(() => {
        const statusFailure: TaskDetailFailure | null = store.statusFailure();
        if (lostAccess(statusFailure)) return statusFailure;
        const failure: Error | undefined = store._detail.error();
        return failure ? failureOf(failure) : null;
      }),
    })),
    withMethods((store, api = inject(TaskDetailApi)) => {
      const dispatch: RxMethod<TaskStatusCommand | null> = rxMethod<TaskStatusCommand | null>(
        switchMap((command) => {
          if (command === null) return EMPTY;
          return timer(STATUS_SETTLE_DURATION).pipe(
            switchMap(() => {
              patchState(store, { savingStatus: true });
              return api
                .changeStatus(command.key, command.status, command.version, command.organizationId)
                .pipe(
                  tapResponse({
                    next: (confirmation: TaskStatusConfirmation) => {
                      store._detail.update((detail) =>
                        detail?.key === confirmation.key ? { ...detail, ...confirmation } : detail,
                      );
                      patchState(store, {
                        _pendingStatus: null,
                        savingStatus: false,
                        statusSaved: true,
                      });
                    },
                    error: (error: unknown) => {
                      const failure: TaskDetailFailure = failureOf(error);
                      patchState(store, {
                        _pendingStatus: null,
                        savingStatus: false,
                        statusFailure: failure,
                      });
                      if (failure !== 'unavailable' && !lostAccess(failure)) store._detail.reload();
                    },
                  }),
                );
            }),
          );
        }),
      );

      return {
        followTask: signalMethod<TaskRouteContext>((context) => {
          const current: TaskRouteContext | undefined = store._context();
          if (current?.key === context.key && current.organizationId === context.organizationId) {
            return;
          }
          dispatch(null);
          patchState(store, { ...initialState, _context: context });
        }),
        retry(): void {
          if (store._pendingStatus() === null && !lostAccess(store.statusFailure())) {
            store._detail.reload();
          }
        },
        changeStatus(status: StatusKey | null): void {
          if (status === null || status === 'cancelled' || store.savingStatus()) return;
          if (lostAccess(store.statusFailure()) || !store._detail.hasValue() || store.loading()) {
            return;
          }
          const detail: TaskDetailView = store._detail.value();
          const context: TaskRouteContext | undefined = store._context();
          if (detail.key !== context?.key || !detail.mayEditStatus) return;
          if (status === detail.status) {
            dispatch(null);
            patchState(store, { _pendingStatus: null, statusFailure: null, statusSaved: false });
          } else if (
            detail.options.some(
              (option: TaskStatusOption) => option.selectable && option.key === status,
            )
          ) {
            patchState(store, { _pendingStatus: status, statusFailure: null, statusSaved: false });
            dispatch({ ...context, status, version: detail.version });
          }
        },
      };
    }),
  );
}

/**
 * Constant TaskDetailStore
 *
 * @description
 * Provides isolated state for the current task page.
 *
 * @type {Type<TaskDetailStoreInstance>}
 */
export const TaskDetailStore: Type<TaskDetailStoreInstance> = createTaskDetailStore();
