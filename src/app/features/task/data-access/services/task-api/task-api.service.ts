import { HttpErrorResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { TasksService, type UpdateTaskClientResult } from '@cadenway/api-client';
import type { StatusKey } from '@cadenway/contracts';
import { catchError, map, type Observable, throwError } from 'rxjs';

import { hasProblemCode } from '@core/api';

import type { TaskSummary } from '../../../models/task-summary/task-summary.interface';
import type { TaskCancellation } from '../../../models/task-status-change/task-status-change.interface';
import { TaskVersionConflict } from '../../../models/task-write-error/task-write-error.model';
import { toTaskSummary } from '../../adapters/task-summary/task-summary.adapter';

/**
 * Service TaskApi
 *
 * @description
 * Versioned writes on one task through `TasksService`, mapped to task summaries. The workspace's
 * `OrganizationPin` adds `If-Organization-Match` to these operations.
 */
@Service()
export class TaskApi {
  // #region Properties
  /**
   * Property client
   *
   * @description
   * Generated task operations.
   *
   * @type {TasksService}
   * @readonly
   */
  private readonly client: TasksService = inject(TasksService);
  // #endregion

  // #region Methods
  /**
   * Method changeStatus
   *
   * @description
   * Sends one status change with `If-Match` set to the version the change was made against. A
   * cancellation carries its reason and its note (null when blank); any other status clears them
   * on the gateway. A `412` other than an organization change rejects with `TaskVersionConflict`.
   *
   * @param {string} taskKey - Key of the task.
   * @param {number} version - Version the change was made against.
   * @param {StatusKey} status - New status.
   * @param {TaskCancellation | null} cancellation - Reason and note, required for `cancelled`.
   * @returns {Observable<TaskSummary>} The task as the gateway saved it, with its new version.
   */
  public changeStatus(
    taskKey: string,
    version: number,
    status: StatusKey,
    cancellation: TaskCancellation | null,
  ): Observable<TaskSummary> {
    return this.client
      .updateTask(
        taskKey,
        status === 'cancelled' && cancellation
          ? {
              status,
              cancelReason: cancellation.reason,
              cancelNote: cancellation.note === '' ? null : cancellation.note,
            }
          : { status },
        { headers: { 'If-Match': `"${version.toString()}"` } },
      )
      .pipe(
        map((task: UpdateTaskClientResult) => toTaskSummary(task)),
        catchError((error: unknown) =>
          throwError(() =>
            error instanceof HttpErrorResponse &&
            error.status === 412 &&
            !hasProblemCode(error, 'organization.context-changed')
              ? new TaskVersionConflict(taskKey)
              : error,
          ),
        ),
      );
  }

  /**
   * Method read
   *
   * @description
   * Reads the current state of a task, after a conflict, without the HTTP cache.
   *
   * @param {string} taskKey - Key of the task.
   * @returns {Observable<TaskSummary>} The task as the gateway has it now.
   */
  public read(taskKey: string): Observable<TaskSummary> {
    return this.client
      .getTask(taskKey, { cache: 'no-store' })
      .pipe(map((task: UpdateTaskClientResult) => toTaskSummary(task)));
  }
  // #endregion
}
