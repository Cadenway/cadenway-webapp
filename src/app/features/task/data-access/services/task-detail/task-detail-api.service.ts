import { HttpErrorResponse } from '@angular/common/http';
import { DOCUMENT, inject, Service } from '@angular/core';
import {
  OrganizationsService,
  RealtimeService,
  TasksService,
  TrashService,
} from '@cadenway/api-client';
import type { StatusKey } from '@cadenway/contracts';
import { IssueRealtimeTicketResponse } from '@cadenway/contracts/validators/public/realtime';
import {
  CreateTaskBody,
  GetTaskDetailHeader,
  GetTaskDetailParams,
  UpdateTaskHeader,
} from '@cadenway/contracts/validators/public/tasks';
import {
  RestoreTrashEntryParams,
  TrashTaskResponse,
} from '@cadenway/contracts/validators/public/trash';
import { RuntimeConfigStore } from '@core/config';
import { observeTaskRoom } from '@core/realtime';
import { withSessionLock } from '@features/auth';
import {
  auditTime,
  catchError,
  EMPTY,
  filter,
  fromEvent,
  map,
  merge,
  type Observable,
  of,
  switchMap,
  throwError,
  timer,
} from 'rxjs';

import {
  type TaskDetailFailure,
  TaskDetailRequestError,
  type TaskRestoreOutcome,
  type TrashedTaskView,
} from '../../../models/task-detail/task-detail-failure.model';
import type {
  TaskDetailView,
  TaskStatusConfirmation,
} from '../../../models/task-detail/task-detail.model';
import { toTaskDetailView } from '../../adapters/task-detail/task-detail.adapter';

/**
 * Function problemCode
 *
 * @description
 * Returns the stable problem code without retaining the response payload.
 *
 * @param {unknown} body - The upstream error body.
 * @returns {unknown} The untrusted problem code, if present.
 */
function problemCode(body: unknown): unknown {
  return body && typeof body === 'object' && 'code' in body ? body.code : undefined;
}

/**
 * Function readTrashedTask
 *
 * @description
 * Maps an authorized trash response to display fields for the opened task.
 *
 * @param {unknown} body - The public Problem received for the requested task.
 * @param {string} key - The task key in the current route.
 * @returns {TrashedTaskView | null} Metadata sufficient to offer restoration.
 */
function readTrashedTask(body: unknown, key: string): TrashedTaskView | null {
  if (!body || typeof body !== 'object' || !('details' in body)) return null;
  const details: unknown = body.details;
  if (!details || typeof details !== 'object' || !('key' in details) || details.key !== key) {
    return null;
  }
  const entry: ReturnType<typeof RestoreTrashEntryParams.safeParse> =
    RestoreTrashEntryParams.safeParse(details);
  const dateShape: typeof TrashTaskResponse.shape = TrashTaskResponse.shape;
  const trashedAt: ReturnType<typeof dateShape.trashedAt.safeParse> = dateShape.trashedAt.safeParse(
    'trashedAt' in details ? details.trashedAt : undefined,
  );
  const purgeAt: ReturnType<typeof dateShape.purgeAt.safeParse> = dateShape.purgeAt.safeParse(
    'purgeAt' in details ? details.purgeAt : undefined,
  );
  const name: ReturnType<typeof CreateTaskBody.shape.name.safeParse> =
    CreateTaskBody.shape.name.safeParse('name' in details ? details.name : undefined);
  if (!entry.success || !trashedAt.success || !purgeAt.success || !name.success) return null;
  return { key, name: name.data, ...entry.data, trashedAt: trashedAt.data, purgeAt: purgeAt.data };
}

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
  const code: unknown = problemCode(error.error);
  if (error.status === 404) {
    return code === 'task.trashed' ? 'trashed' : 'not-found';
  }
  if (error.status === 401) return 'session-expired';
  if (error.status === 403) {
    return code === 'organization.not-selected' || code === 'organization.mfa-required'
      ? 'organization-changed'
      : 'forbidden';
  }
  if (error.status === 412) {
    return code === 'organization.context-changed' ? 'organization-changed' : 'stale';
  }
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
  if (error instanceof TaskDetailRequestError) return throwError(() => error);
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
   * Property trash
   *
   * @description
   * The generated client used to restore authorized trash entries.
   *
   * @type {TrashService}
   * @readonly
   */
  private readonly trash: TrashService = inject(TrashService);

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

  /**
   * Property realtime
   *
   * @description
   * Issues single-use Realtime credentials through the generated API client.
   *
   * @type {RealtimeService}
   * @readonly
   */
  private readonly realtime: RealtimeService = inject(RealtimeService);

  /**
   * Property config
   *
   * @description
   * Reads whether the environment enabled a Realtime connection.
   *
   * @type {InstanceType<typeof RuntimeConfigStore>}
   * @readonly
   */
  private readonly config: InstanceType<typeof RuntimeConfigStore> = inject(RuntimeConfigStore);

  /**
   * Property document
   *
   * @description
   * Restricts recovery reads to visible task pages.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);
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
    return this.client
      .getTaskDetail(taskKey, {
        cache: 'no-store',
        headers: GetTaskDetailHeader.parse({ 'If-Organization-Match': organizationId }),
      })
      .pipe(
        map(toTaskDetailView),
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse && classifyFailure(error) === 'trashed') {
            const task: TrashedTaskView | null = readTrashedTask(error.error, taskKey);
            return throwError(() => new TaskDetailRequestError('trashed', task));
          }
          return rejectTaskRequest(error);
        }),
      );
  }

  /**
   * Method watchForChanges
   *
   * @description
   * Requests guarded detail reloads after a notice or reconnect and independently catches up
   * on missed notifications while the page remains visible.
   *
   * @param {string} taskKey - The opened task's key.
   * @param {string} organizationId - The route's expected organization.
   * @returns {Observable<void>} Coalesced reload signals until the route disconnects.
   */
  public watchForChanges(taskKey: string, organizationId: string): Observable<void> {
    const configured: string | undefined = this.config.config().realtimeUrl;
    if (
      !configured ||
      !URL.canParse(configured) ||
      !GetTaskDetailParams.safeParse({ taskKey }).success
    ) {
      return EMPTY;
    }
    const origin: URL = new URL(configured);
    if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password) {
      return EMPTY;
    }
    return merge(
      observeTaskRoom(origin, organizationId, taskKey, () =>
        this.realtime.issueRealtimeTicket({}, { timeout: 5_000 }).pipe(
          map((ticket) => IssueRealtimeTicketResponse.parse(ticket).token),
          catchError((error: unknown) => {
            if (error instanceof HttpErrorResponse && [401, 403, 404].includes(error.status)) {
              return EMPTY;
            }
            return throwError(() => error);
          }),
        ),
      ),
      fromEvent(this.document, 'visibilitychange'),
      timer(30_000, 30_000),
    ).pipe(
      auditTime(250),
      filter(() => this.document.visibilityState === 'visible'),
      map(() => undefined),
    );
  }

  /**
   * Method restore
   *
   * @description
   * Restores an authorized trash entry while the browser's organization is stable.
   *
   * @param {string} entryId - Identifier of the trash entry from the access-checked response.
   * @param {string} organizationId - Organization resolved for the current task route.
   * @returns {Observable<TaskRestoreOutcome>} A restore outcome without upstream metadata.
   */
  public restore(entryId: string, organizationId: string): Observable<TaskRestoreOutcome> {
    if (!RestoreTrashEntryParams.safeParse({ entryId }).success) return of('not-found');
    return this.inOrganization(organizationId, () =>
      this.trash.restoreTrashEntry(entryId, {}, { reportNotReady: true }).pipe(
        map((): TaskRestoreOutcome => 'restored'),
        catchError((error: unknown): Observable<TaskRestoreOutcome> => {
          if (error instanceof HttpErrorResponse) {
            if (error.status === 404) return of('not-found');
            if (
              error.status === 409 &&
              problemCode(error.error) === 'trash-entry.not-restorable-yet'
            ) {
              return of('pending');
            }
          }
          return rejectTaskRequest(error);
        }),
      ),
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
        .updateTask(
          taskKey,
          { status },
          {
            headers: UpdateTaskHeader.parse({
              'If-Match': `"${version.toString()}"`,
              'If-Organization-Match': organizationId,
            }),
          },
        )
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
