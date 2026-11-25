import { HttpErrorResponse, type HttpResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { TasksService, type UpdateTaskClientResult } from '@cadenway/api-client';
import type { PriorityKey, StatusKey } from '@cadenway/contracts';
import { catchError, map, type MonoTypeOperatorFunction, type Observable, throwError } from 'rxjs';

import { hasProblemCode } from '@core/api';

import type { TaskSummary } from '../../../models/task-summary/task-summary.interface';
import type { TaskCancellation } from '../../../models/task-status-change/task-status-change.interface';
import { TaskVersionConflict } from '../../../models/task-write-error/task-write-error.model';
import { toTaskSummary } from '../../adapters/task-summary/task-summary.adapter';

/**
 * Function ifMatch
 *
 * @description
 * The `If-Match` precondition of a write made against a task version.
 *
 * @param {number} version - Task version the write was made against.
 * @returns {Record<string, string>} The header.
 */
function ifMatch(version: number): Record<string, string> {
  return { 'If-Match': `"${version.toString()}"` };
}

/**
 * Function versionConflicts
 *
 * @description
 * Turns a `412` other than an organization change into `TaskVersionConflict`, so the caller
 * reads the task again; any other error passes unchanged.
 *
 * @param {string} taskKey - Key of the written task.
 * @returns {MonoTypeOperatorFunction<T>} The operator.
 */
function versionConflicts<T>(taskKey: string): MonoTypeOperatorFunction<T> {
  return catchError((error: unknown) =>
    throwError(() =>
      error instanceof HttpErrorResponse &&
      error.status === 412 &&
      !hasProblemCode(error, 'organization.context-changed')
        ? new TaskVersionConflict(taskKey)
        : error,
    ),
  );
}

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
        { headers: ifMatch(version) },
      )
      .pipe(
        map((task: UpdateTaskClientResult) => toTaskSummary(task)),
        versionConflicts(taskKey),
      );
  }

  /**
   * Method changePriority
   *
   * @description
   * Sends one priority change with `If-Match`; a `412` other than an organization change rejects
   * with `TaskVersionConflict`.
   *
   * @param {string} taskKey - Key of the task.
   * @param {number} version - Version the change was made against.
   * @param {PriorityKey} priority - New priority.
   * @returns {Observable<TaskSummary>} The task as the gateway saved it, with its new version.
   */
  public changePriority(
    taskKey: string,
    version: number,
    priority: PriorityKey,
  ): Observable<TaskSummary> {
    return this.client.updateTask(taskKey, { priority }, { headers: ifMatch(version) }).pipe(
      map((task: UpdateTaskClientResult) => toTaskSummary(task)),
      versionConflicts(taskKey),
    );
  }

  /**
   * Method assign
   *
   * @description
   * Adds one assignee with `If-Match`; a person already assigned answers the same version.
   *
   * @param {string} taskKey - Key of the task.
   * @param {number} version - Version the change was made against.
   * @param {string} userId - User id of the person.
   * @returns {Observable<TaskSummary>} The task as the gateway saved it, with its new version.
   */
  public assign(taskKey: string, version: number, userId: string): Observable<TaskSummary> {
    return this.client.assignTask(taskKey, userId, {}, { headers: ifMatch(version) }).pipe(
      map((task: UpdateTaskClientResult) => toTaskSummary(task)),
      versionConflicts(taskKey),
    );
  }

  /**
   * Method unassign
   *
   * @description
   * Removes one assignee with `If-Match`. The gateway answers no body: the version after the
   * change comes from the `ETag` header, null when the header is missing or unreadable.
   *
   * @param {string} taskKey - Key of the task.
   * @param {number} version - Version the change was made against.
   * @param {string} userId - User id of the person.
   * @returns {Observable<number | null>} The version after the change, or null when unknown.
   */
  public unassign(taskKey: string, version: number, userId: string): Observable<number | null> {
    return this.client
      .unassignTask(taskKey, userId, { headers: ifMatch(version), observe: 'response' })
      .pipe(
        map((response: HttpResponse<void>): number | null => {
          const tag: string | null = response.headers.get('ETag');
          const parsed: number = Number((tag ?? '').replace(/^W\//u, '').replaceAll('"', ''));
          return tag !== null && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
        }),
        versionConflicts(taskKey),
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
