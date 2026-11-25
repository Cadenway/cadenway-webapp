import { HttpErrorResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import {
  type BulkTaskAction,
  type BulkTaskActionValue,
  type BulkTaskResult,
  type BulkTaskResultEntry,
  RemindersService,
  TasksService,
  TrashService,
} from '@cadenway/api-client';
import { firstValueFrom } from 'rxjs';

import type {
  TaskBulkAction,
  TaskBulkEntry,
  TaskBulkOutcome,
  TaskBulkSelection,
} from '../../../models/task-bulk/task-bulk.interface';

/**
 * Constant TASK_BULK_CHUNK_SIZE
 *
 * @description
 * Tasks one `executeBulkTaskAction` call takes at most; a larger selection is sent in several
 * chunks, one after the other.
 *
 * @type {number}
 */
export const TASK_BULK_CHUNK_SIZE: number = 50;

/**
 * Function isUncertainFailure
 *
 * @description
 * Distinguishes a missing or server answer, after which the action may have been applied, from a
 * deterministic refusal.
 *
 * @param {unknown} error - The failed request.
 * @returns {boolean} Whether the request may have been applied.
 */
export function isUncertainFailure(error: unknown): boolean {
  return !(error instanceof HttpErrorResponse) || error.status === 0 || error.status >= 500;
}

/**
 * Function toBulkActionValue
 *
 * @description
 * The `action` member of `executeBulkTaskAction`; a cancellation note is sent only with
 * `cancelled`, blank as null.
 *
 * @param {TaskBulkAction} action - The action.
 * @returns {BulkTaskActionValue} The gateway action.
 */
function toBulkActionValue(action: TaskBulkAction): BulkTaskActionValue {
  if (action.type === 'status') {
    return action.status === 'cancelled'
      ? {
          type: 'status',
          status: action.status,
          cancelReason: action.cancelReason,
          cancelNote: action.cancelNote === '' ? null : (action.cancelNote ?? null),
        }
      : { type: 'status', status: action.status };
  }
  return action;
}

/**
 * Function toBulkTaskAction
 *
 * @description
 * The body of one `executeBulkTaskAction` chunk.
 *
 * @param {readonly TaskBulkSelection[]} selection - Tasks of the chunk, 1 to 50.
 * @param {TaskBulkAction} action - The action.
 * @returns {BulkTaskAction} The gateway body.
 */
export function toBulkTaskAction(
  selection: readonly TaskBulkSelection[],
  action: TaskBulkAction,
): BulkTaskAction {
  return {
    selection: selection.map((item: TaskBulkSelection) =>
      item.version === undefined
        ? { taskKey: item.taskKey }
        : { taskKey: item.taskKey, version: item.version },
    ),
    action: toBulkActionValue(action),
  };
}

/**
 * Function toEntry
 *
 * @description
 * Maps one result of the gateway to what the caller undoes or opens.
 *
 * @param {BulkTaskResultEntry} entry - The gateway result.
 * @returns {TaskBulkEntry} The result.
 */
function toEntry(entry: BulkTaskResultEntry): TaskBulkEntry {
  return {
    taskKey: entry.taskKey,
    version: entry.version ?? null,
    newTaskKey: entry.newTaskKey ?? null,
    trashEntryId: entry.trashEntryId ?? null,
  };
}

/**
 * Service TaskActionsApi
 *
 * @description
 * The writes of a task's menu and of a selection: `TasksService.executeBulkTaskAction` (status,
 * priority, assignees, move, trash, copy), `RemindersService.setTaskReminder` and
 * `TrashService.restoreTrashEntry`, which undoes a deletion. The workspace's `OrganizationPin`
 * adds `If-Organization-Match` where the contract asks for it.
 */
@Service()
export class TaskActionsApi {
  // #region Properties
  /**
   * Property tasks
   *
   * @description
   * Generated task operations.
   *
   * @type {TasksService}
   * @readonly
   */
  private readonly tasks: TasksService = inject(TasksService);

  /**
   * Property reminders
   *
   * @description
   * Generated reminder operations.
   *
   * @type {RemindersService}
   * @readonly
   */
  private readonly reminders: RemindersService = inject(RemindersService);

  /**
   * Property trash
   *
   * @description
   * Generated trash operations.
   *
   * @type {TrashService}
   * @readonly
   */
  private readonly trash: TrashService = inject(TrashService);
  // #endregion

  // #region Methods
  /**
   * Method bulk
   *
   * @description
   * Applies an action to the selection in chunks of 50, one call after the other. Each chunk is
   * atomic and has its own `Idempotency-Key`, reused for one retry after an uncertain answer.
   * Before each send and retry, `current` must still hold (same organization, live caller);
   * otherwise the remaining tasks are reported as not sent. A chunk without a certain answer stops
   * the rest. The promise never rejects.
   *
   * @param {readonly TaskBulkSelection[]} selection - The selected tasks.
   * @param {TaskBulkAction} action - The action.
   * @param {() => boolean} current - Whether the caller may still send.
   * @returns {Promise<TaskBulkOutcome>} What was applied, refused, uncertain or not sent.
   */
  public async bulk(
    selection: readonly TaskBulkSelection[],
    action: TaskBulkAction,
    current: () => boolean,
  ): Promise<TaskBulkOutcome> {
    let affected: number = 0;
    const done: TaskBulkEntry[] = [];
    const failed: TaskBulkSelection[] = [];
    const unknown: TaskBulkSelection[] = [];
    const notSent: TaskBulkSelection[] = [];
    for (let start: number = 0; start < selection.length; start += TASK_BULK_CHUNK_SIZE) {
      const chunk: readonly TaskBulkSelection[] = selection.slice(
        start,
        start + TASK_BULK_CHUNK_SIZE,
      );
      const rest: readonly TaskBulkSelection[] = selection.slice(start + TASK_BULK_CHUNK_SIZE);
      if (!current()) {
        notSent.push(...chunk, ...rest);
        break;
      }
      const key: string = crypto.randomUUID();
      let result: BulkTaskResult | null = null;
      let uncertain: boolean = false;
      try {
        result = await this.send(chunk, action, key);
      } catch (error: unknown) {
        uncertain = isUncertainFailure(error);
        if (!uncertain) failed.push(...chunk);
      }
      if (uncertain) {
        if (!current()) {
          unknown.push(...chunk);
          notSent.push(...rest);
          break;
        }
        try {
          result = await this.send(chunk, action, key);
        } catch (error: unknown) {
          if (isUncertainFailure(error)) {
            unknown.push(...chunk);
            notSent.push(...rest);
            break;
          }
          failed.push(...chunk);
        }
      }
      if (result) {
        affected += result.affectedCount;
        const byKey: Map<string, BulkTaskResultEntry> = new Map<string, BulkTaskResultEntry>(
          result.results.map((entry: BulkTaskResultEntry) => [entry.taskKey, entry]),
        );
        for (const item of chunk) {
          const entry: BulkTaskResultEntry | undefined = byKey.get(item.taskKey);
          done.push(
            entry
              ? toEntry(entry)
              : { taskKey: item.taskKey, version: null, newTaskKey: null, trashEntryId: null },
          );
        }
      }
    }
    return { affected, done, failed, unknown, notSent };
  }

  /**
   * Method remind
   *
   * @description
   * Sets the caller's reminder of a task (`Remind me tomorrow morning`), replacing a previous one.
   *
   * @param {string} taskKey - Key of the task.
   * @param {Date} at - When to remind.
   * @returns {Promise<void>} Resolves once it is recorded.
   */
  public async remind(taskKey: string, at: Date): Promise<void> {
    await firstValueFrom(this.reminders.setTaskReminder(taskKey, { remindAt: at.toISOString() }));
  }

  /**
   * Method restore
   *
   * @description
   * Takes a deleted task, with its subtasks, out of the trash (the `Undo` of a deletion).
   *
   * @param {string} entryId - The trash entry.
   * @returns {Promise<void>} Resolves once the task is back.
   */
  public async restore(entryId: string): Promise<void> {
    await firstValueFrom(this.trash.restoreTrashEntry(entryId, {}));
  }

  /**
   * Method send
   *
   * @description
   * Sends one chunk.
   *
   * @param {readonly TaskBulkSelection[]} chunk - 1 to 50 tasks.
   * @param {TaskBulkAction} action - The action.
   * @param {string} idempotencyKey - Key of the chunk, reused by its retry.
   * @returns {Promise<BulkTaskResult>} The gateway's results.
   */
  private send(
    chunk: readonly TaskBulkSelection[],
    action: TaskBulkAction,
    idempotencyKey: string,
  ): Promise<BulkTaskResult> {
    return firstValueFrom(
      this.tasks.executeBulkTaskAction(toBulkTaskAction(chunk, action), {
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    );
  }
  // #endregion
}
