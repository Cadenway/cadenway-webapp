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
import { CwToastService } from '@cadenway/ui/components/toast';
import { distinctUntilChanged, filter, pipe, tap } from 'rxjs';

import { TaskSectionsApi } from '../../data-access/services/task-sections-api/task-sections-api.service';
import type {
  TaskApprovalReview,
  TaskApprovalRound,
  TaskApprovalSnapshot,
} from '../../models/task-detail-sections/task-detail-sections.interface';
import type { TaskDetailTask } from '../../models/task-detail/task-detail.interface';
import { TaskVersionConflict } from '../../models/task-write-error/task-write-error.model';
import { TaskDetailStore } from '../task-detail/task-detail.store';

/**
 * Type TaskApprovalAction
 *
 * @description
 * The vote being sent.
 *
 * @type {'approve' | 'changes' | 'withdraw'}
 */
export type TaskApprovalAction = 'approve' | 'changes' | 'withdraw';

/**
 * Interface TaskApprovalCardState
 *
 * @description
 * State of the approval card.
 */
interface TaskApprovalCardState {
  // #region Properties
  /**
   * Property snapshot
   *
   * @description
   * The last approval read or answered, or null before the first read.
   *
   * @type {TaskApprovalSnapshot | null}
   * @readonly
   */
  readonly snapshot: TaskApprovalSnapshot | null;

  /**
   * Property loading
   *
   * @description
   * Whether the approval is being read.
   *
   * @type {boolean}
   * @readonly
   */
  readonly loading: boolean;

  /**
   * Property failed
   *
   * @description
   * Whether the last read failed.
   *
   * @type {boolean}
   * @readonly
   */
  readonly failed: boolean;

  /**
   * Property pending
   *
   * @description
   * The vote being sent, or null.
   *
   * @type {TaskApprovalAction | null}
   * @readonly
   */
  readonly pending: TaskApprovalAction | null;
  // #endregion
}

/**
 * Interface TaskApprovalCardStoreInstance
 *
 * @description
 * Public API of `TaskApprovalCardStore`.
 */
export interface TaskApprovalCardStoreInstance {
  // #region Properties
  /**
   * Property round
   *
   * @description
   * The current round with at least one reviewer, or null (no card).
   *
   * @type {Signal<TaskApprovalRound | null>}
   * @readonly
   */
  readonly round: Signal<TaskApprovalRound | null>;

  /**
   * Property loading
   *
   * @description
   * Whether the approval is being read.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loading: Signal<boolean>;

  /**
   * Property failed
   *
   * @description
   * Whether the last read failed (the card's inline error).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly failed: Signal<boolean>;

  /**
   * Property pending
   *
   * @description
   * The vote being sent, or null.
   *
   * @type {Signal<TaskApprovalAction | null>}
   * @readonly
   */
  readonly pending: Signal<TaskApprovalAction | null>;
  // #endregion

  // #region Methods
  /**
   * Method load
   *
   * @description
   * Reads the approval of the open task again (`Retry`).
   *
   * @returns {Promise<void>} Resolves once read.
   */
  load(): Promise<void>;

  /**
   * Method approve
   *
   * @description
   * Records the caller's approval with its toast.
   *
   * @returns {Promise<boolean>} Whether it was recorded.
   */
  approve(): Promise<boolean>;

  /**
   * Method requestChanges
   *
   * @description
   * Records the caller's change request; the gateway posts the reason as a comment and moves
   * the task back to `In progress`.
   *
   * @param {string} reason - What to change, not blank.
   * @returns {Promise<boolean>} Whether it was recorded.
   */
  requestChanges(reason: string): Promise<boolean>;

  /**
   * Method withdraw
   *
   * @description
   * Withdraws the caller's vote (`Withdraw my review`).
   *
   * @returns {Promise<boolean>} Whether it was withdrawn.
   */
  withdraw(): Promise<boolean>;
  // #endregion
}

/**
 * Function createTaskApprovalCardStore
 *
 * @description
 * Builds the approval card store.
 *
 * @returns {Type<TaskApprovalCardStoreInstance>} Injectable store constructor.
 */
function createTaskApprovalCardStore(): Type<TaskApprovalCardStoreInstance> {
  const initialState: TaskApprovalCardState = {
    snapshot: null,
    loading: false,
    failed: false,
    pending: null,
  };
  return signalStore(
    withState(initialState),
    withProps(() => ({
      _api: inject(TaskSectionsApi),
      _detail: inject(TaskDetailStore),
      _toasts: inject(CwToastService),
    })),
    withComputed((store) => ({
      round: computed((): TaskApprovalRound | null => {
        const round: TaskApprovalRound | null = store.snapshot()?.round ?? null;
        return round && round.reviews.length > 0 ? round : null;
      }),
      _version: computed((): number | null => store._detail.confirmedTask()?.version ?? null),
    })),
    withMethods((store) => {
      const failedVote: (error: unknown) => void = (error: unknown): void => {
        const conflict: boolean = error instanceof TaskVersionConflict;
        store._toasts.error($localize`:@@task.approval.failed:Could not record your review`, {
          description: conflict
            ? $localize`:@@task.properties.conflict-text:The task changed in the meantime; its latest version is shown.`
            : $localize`:@@task.detail.failed-text:The server did not answer. Try again in a moment.`,
        });
        if (conflict) void read();
      };
      const vote: (
        key: string,
        send: (version: number) => Promise<TaskApprovalSnapshot>,
      ) => Promise<TaskApprovalSnapshot> = (
        key: string,
        send: (version: number) => Promise<TaskApprovalSnapshot>,
      ): Promise<TaskApprovalSnapshot> =>
        store._detail.write(key, async (version: number): Promise<TaskApprovalSnapshot> => {
          const snapshot: TaskApprovalSnapshot = await send(version);
          const task: TaskDetailTask | null = store._detail.confirmedTask();
          const moved: boolean = task?.key === key && task.status !== snapshot.taskStatus;
          store._detail.acceptVersion(snapshot.taskVersion, { status: snapshot.taskStatus }, key);
          if (moved) void store._detail.reload();
          return snapshot;
        });
      const settle: (snapshot: TaskApprovalSnapshot) => void = (
        snapshot: TaskApprovalSnapshot,
      ): void => {
        patchState(store, { snapshot, pending: null });
      };
      const read: () => Promise<void> = async (): Promise<void> => {
        const key: string | null = store._detail.taskKey();
        if (key === null) return;
        patchState(store, { loading: true, failed: false });
        try {
          const snapshot: TaskApprovalSnapshot = await store._api.approval(key);
          if (store._detail.taskKey() === key) {
            patchState(store, { snapshot, loading: false });
          }
        } catch {
          if (store._detail.taskKey() === key) patchState(store, { loading: false, failed: true });
        }
      };
      return {
        load: read,

        async approve(): Promise<boolean> {
          const key: string | null = store._detail.taskKey();
          const round: TaskApprovalRound | null = store.round();
          if (key === null || round === null || store.pending()) return false;
          patchState(store, { pending: 'approve' });
          try {
            const snapshot: TaskApprovalSnapshot = await vote(
              key,
              (version: number): Promise<TaskApprovalSnapshot> =>
                store._api.approve(key, round.id, version),
            );
            settle(snapshot);
            const reviews: readonly TaskApprovalReview[] = snapshot.round?.reviews ?? [];
            if (snapshot.round?.status === 'approved') {
              store._toasts.success($localize`:@@task.approval.all-approved:Approved by all`, {
                description: $localize`:@@task.approval.all-approved-text:${key}:key: moves to Done.`,
              });
            } else {
              const waiting: number = reviews.filter(
                (review: TaskApprovalReview): boolean => review.decision !== 'approved',
              ).length;
              store._toasts.success($localize`:@@task.approval.recorded:Approval recorded`, {
                description: $localize`:@@task.approval.recorded-text:${waiting}:count: review(s) still expected.`,
              });
            }
            return true;
          } catch (error: unknown) {
            patchState(store, { pending: null });
            failedVote(error);
            return false;
          }
        },

        async requestChanges(reason: string): Promise<boolean> {
          const key: string | null = store._detail.taskKey();
          const round: TaskApprovalRound | null = store.round();
          if (key === null || round === null || store.pending() || reason.trim() === '') {
            return false;
          }
          patchState(store, { pending: 'changes' });
          try {
            const snapshot: TaskApprovalSnapshot = await vote(
              key,
              (version: number): Promise<TaskApprovalSnapshot> =>
                store._api.requestChanges(key, round.id, reason.trim(), version),
            );
            settle(snapshot);
            void store._detail.reloadComments();
            store._toasts.success($localize`:@@task.approval.changes-sent:Changes requested`, {
              description: $localize`:@@task.approval.changes-sent-text:${key}:key: goes back to In progress; your message is in a comment.`,
            });
            return true;
          } catch (error: unknown) {
            patchState(store, { pending: null });
            failedVote(error);
            return false;
          }
        },

        async withdraw(): Promise<boolean> {
          const key: string | null = store._detail.taskKey();
          const round: TaskApprovalRound | null = store.round();
          if (key === null || round === null || store.pending()) return false;
          patchState(store, { pending: 'withdraw' });
          try {
            const version: number | null = await store._detail.write(
              key,
              async (latest: number): Promise<number | null> => {
                const tagged: number | null = await store._api.withdrawVote(key, round.id, latest);
                if (tagged !== null) store._detail.acceptVersion(tagged, {}, key);
                return tagged;
              },
            );
            patchState(store, { pending: null });
            await read();
            const snapshot: TaskApprovalSnapshot | null = store.snapshot();
            if (version === null && snapshot) {
              store._detail.acceptVersion(snapshot.taskVersion, { status: snapshot.taskStatus });
            }
            return true;
          } catch (error: unknown) {
            patchState(store, { pending: null });
            failedVote(error);
            return false;
          }
        },

        _follow: rxMethod<number | null>(
          pipe(
            filter((version: number | null): version is number => version !== null),
            distinctUntilChanged(),
            filter(
              (version: number): boolean =>
                store.pending() === null && store.snapshot()?.taskVersion !== version,
            ),
            tap((): void => {
              void read();
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
 * Constant TaskApprovalCardStore
 *
 * @description
 * The approval of the open task (`App.dc.html` lines 2122-2134, 5065-5106), provided by
 * `cw-task-detail-tabs`. It reads the current round when the detail is shown and again whenever
 * the confirmed task version moves past the version the approval was answered at (a request from
 * the properties panel, a pushed change), but not while a vote is being sent. A vote (approve,
 * request changes, withdraw) goes through the detail's per-task write path
 * (`TaskDetailStore.write`) with `If-Match` set to the newest confirmed task version, and the
 * detail takes the version it answers (only when it follows the confirmed one, else it reads the
 * task again); when the vote moved the task's status (the last approval to `done`, a change
 * request to `progress`) the detail is read again. A change request also reads the first comment
 * page, which carries its comment. Failures keep the card as it was with the failure toast; a
 * `412` also reads the approval again (and the lane the task); a failed read is the card's inline
 * error with `Retry`.
 *
 * @type {Type<TaskApprovalCardStoreInstance>}
 */
export const TaskApprovalCardStore: Type<TaskApprovalCardStoreInstance> =
  createTaskApprovalCardStore();
