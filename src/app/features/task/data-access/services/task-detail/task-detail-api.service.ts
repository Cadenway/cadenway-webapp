import { HttpErrorResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { OrganizationsService, TasksService } from '@cadenway/api-client';
import type { StatusKey } from '@cadenway/contracts';
import { GetTaskDetailParams } from '@cadenway/contracts/validators/public/tasks';
import { withSessionLock } from '@features/auth';
import { catchError, EMPTY, map, type Observable, switchMap, throwError } from 'rxjs';

import {
  type TaskDetailFailure,
  TaskDetailRequestError,
} from '../../../models/task-detail/task-detail-failure.model';
import type {
  TaskDetailView,
  TaskStatusConfirmation,
} from '../../../models/task-detail/task-detail.model';
import { toTaskDetailView } from '../../adapters/task-detail/task-detail.adapter';

/**
 * Function classifyFailure
 *
 * @description
 * Preserves the meaning of task API failures while discarding their details.
 *
 * @param {unknown} error - The generated client's rejection.
 * @returns {TaskDetailFailure} The public category for this screen.
 */
function classifyFailure(error: unknown): TaskDetailFailure {
  if (error instanceof TaskDetailRequestError) return error.failure;
  if (!(error instanceof HttpErrorResponse)) return 'unavailable';
  const body: unknown = error.error;
  const code: unknown = body && typeof body === 'object' && 'code' in body ? body.code : undefined;
  if (error.status === 404) {
    return code === 'task.trashed' ? 'trashed' : 'not-found';
  }
  if (error.status === 401) return 'session-expired';
  if (error.status === 403) {
    return code === 'organization.not-selected' || code === 'organization.mfa-required'
      ? 'organization-changed'
      : 'forbidden';
  }
  if (error.status === 412) return 'stale';
  return 'unavailable';
}

/**
 * Function rejectTaskRequest
 *
 * @description
 * Exposes a typed error to the detail resource without retaining the HTTP request or body.
 *
 * @param {unknown} error - The generated client's rejection.
 * @returns {Observable<never>} A stream with the mapped task failure.
 */
function rejectTaskRequest(error: unknown): Observable<never> {
  return throwError(() => new TaskDetailRequestError(classifyFailure(error)));
}

/**
 * Class TaskDetailApi
 *
 * @description
 * Loads detail and sends versioned status changes with the generated Task client.
 */
@Service()
export class TaskDetailApi {
  // #region Properties
  /**
   * Property client
   *
   * @description
   * The configured generated client.
   *
   * @type {TasksService}
   * @readonly
   */
  private readonly client: TasksService = inject(TasksService);

  /**
   * Property organizations
   *
   * @description
   * Reads the organization bound to the session cookie.
   *
   * @type {OrganizationsService}
   * @readonly
   */
  private readonly organizations: OrganizationsService = inject(OrganizationsService);
  // #endregion

  // #region Methods
  /**
   * Method load
   *
   * @description
   * Loads the detail of a task in the organization resolved by the route.
   *
   * @param {string} taskKey - The key from the task route.
   * @param {string} organizationId - The organization expected by the route.
   * @returns {Observable<TaskDetailView>} The accessible parts of the detail.
   */
  public load(taskKey: string, organizationId: string): Observable<TaskDetailView> {
    if (!GetTaskDetailParams.safeParse({ taskKey }).success) {
      return throwError(() => new TaskDetailRequestError('not-found'));
    }
    return this.inOrganization(organizationId, () =>
      this.client.getTaskDetail(taskKey, { cache: 'no-store' }).pipe(map(toTaskDetailView)),
    );
  }

  /**
   * Method changeStatus
   *
   * @description
   * Writes a normal status transition against the last seen version of the task.
   *
   * @param {string} taskKey - The currently loaded task key.
   * @param {Exclude<StatusKey, 'cancelled'>} status - A status without a required cancellation reason.
   * @param {number} version - The task's previously confirmed version.
   * @param {string} organizationId - The organization in which the task was loaded.
   * @returns {Observable<TaskStatusConfirmation>} The committed status and version.
   */
  public changeStatus(
    taskKey: string,
    status: Exclude<StatusKey, 'cancelled'>,
    version: number,
    organizationId: string,
  ): Observable<TaskStatusConfirmation> {
    return this.inOrganization(organizationId, () =>
      this.client
        .updateTask(taskKey, { status }, { headers: { 'If-Match': `"${version.toString()}"` } })
        .pipe(map((task) => ({ key: task.key, status: task.status, version: task.version }))),
    );
  }

  /**
   * Method inOrganization
   *
   * @description
   * Checks the live session and keeps it stable across the subsequent task request.
   *
   * @template T
   * @param {string} organizationId - The organization expected by the route.
   * @param {() => Observable<T>} operation - The task request bound to that organization.
   * @returns {Observable<T>} The verified request's response.
   */
  private inOrganization<T>(organizationId: string, operation: () => Observable<T>): Observable<T> {
    return withSessionLock((signal) =>
      this.organizations.getCurrentOrganization({ cache: 'no-store' }).pipe(
        switchMap((organization) => {
          if (signal.aborted) return EMPTY;
          if (organization.id !== organizationId) {
            return throwError(() => new TaskDetailRequestError('organization-changed'));
          }
          return operation();
        }),
      ),
    ).pipe(catchError(rejectTaskRequest));
  }
  // #endregion
}
