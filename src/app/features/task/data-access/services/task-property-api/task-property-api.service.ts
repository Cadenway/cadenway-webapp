import { HttpErrorResponse, type HttpResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import {
  type AddTaskLabelClientResult,
  type AssignTaskClientResult,
  type CreateTaskDependencyClientResult,
  type GetListClientResult,
  type GetTaskApprovalClientResult,
  type GetTaskStatusDurationsClientResult,
  type ListDependencyCandidatesClientResult,
  type ListTaskDependenciesClientResult,
  type ListTaskWatchersClientResult,
  ListsService,
  TaskTimeService,
  TasksService,
} from '@cadenway/api-client';
import { firstValueFrom } from 'rxjs';

import { hasProblemCode } from '@core/api';

import type { TaskDetailTask } from '../../../models/task-detail/task-detail.interface';
import type {
  TaskApproval,
  TaskDependency,
  TaskDependencyDirection,
  TaskDependencyTask,
  TaskStatusTimes,
} from '../../../models/task-property/task-property.interface';
import { TaskVersionConflict } from '../../../models/task-write-error/task-write-error.model';
import { toTaskDetailTask } from '../../adapters/task-detail/task-detail.adapter';
import {
  toTaskApproval,
  toTaskDependency,
  toTaskDependencyTask,
  toTaskStatusTimes,
} from '../../adapters/task-property/task-property.adapter';
import { TaskApprovalRead } from '../task-approval-read/task-approval-read.service';

/**
 * Constant PAGE_SIZE
 *
 * @description
 * Page size of the collections read to their last cursor page (watchers, dependencies).
 *
 * @type {number}
 */
const PAGE_SIZE: number = 100;

/**
 * Constant CANDIDATE_LIMIT
 *
 * @description
 * Dependency candidates shown at most (`App.dc.html`, the dependency dialog).
 *
 * @type {number}
 */
export const CANDIDATE_LIMIT: number = 10;

/**
 * Function versionOf
 *
 * @description
 * Reads the task version a response carries in its `ETag` (`"7"` or `W/"7"`).
 *
 * @param {HttpResponse<unknown>} response - The response.
 * @returns {number | null} The version, or null without a readable `ETag`.
 */
function versionOf(response: HttpResponse<unknown>): number | null {
  const tag: string | null = response.headers.get('ETag');
  const match: RegExpExecArray | null = tag ? /(\d+)/u.exec(tag) : null;
  return match ? Number(match[1]) : null;
}

/**
 * Interface CreatedDependency
 *
 * @description
 * A dependency the gateway created, with the open task's new version.
 */
export interface CreatedDependency {
  // #region Properties
  /**
   * Property dependency
   *
   * @description
   * The edge, seen from the open task.
   *
   * @type {TaskDependency}
   * @readonly
   */
  readonly dependency: TaskDependency;

  /**
   * Property version
   *
   * @description
   * The open task's version after the change, or null when the answer has no `ETag`.
   *
   * @type {number | null}
   * @readonly
   */
  readonly version: number | null;
  // #endregion
}

/**
 * Service TaskPropertyApi
 *
 * @description
 * The reads and writes of the task detail's properties panel that are not fields of the task
 * patch: assignees and labels (actions answering the task), the watchers' accounts, the current
 * approval round, dependencies and their candidates, the time per status, and the end of the
 * list's sprint. Collections are read to their last cursor page. Writes without a task in the
 * answer give the task's new version from the `ETag`, so the detail's next `If-Match` matches.
 */
@Service()
export class TaskPropertyApi {
  // #region Properties
  /**
   * Property approvalRead
   *
   * @description
   * The approval read shared with the other reader of the same task.
   *
   * @type {TaskApprovalRead}
   * @readonly
   */
  private readonly approvalRead: TaskApprovalRead = inject(TaskApprovalRead);

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
   * Property lists
   *
   * @description
   * Generated list operations.
   *
   * @type {ListsService}
   * @readonly
   */
  private readonly lists: ListsService = inject(ListsService);

  /**
   * Property time
   *
   * @description
   * Generated time operations (the time per status).
   *
   * @type {TaskTimeService}
   * @readonly
   */
  private readonly time: TaskTimeService = inject(TaskTimeService);
  // #endregion

  // #region Methods
  /**
   * Method assign
   *
   * @description
   * Adds a person to the assignees (a person already assigned changes nothing).
   *
   * @param {string} taskKey - Key of the task.
   * @param {string} userId - Account of the person.
   * @returns {Promise<TaskDetailTask>} The task as the gateway saved it.
   */
  public async assign(taskKey: string, userId: string): Promise<TaskDetailTask> {
    const task: AssignTaskClientResult = await firstValueFrom(
      this.tasks.assignTask(taskKey, userId, {}),
    );
    return toTaskDetailTask(task);
  }

  /**
   * Method unassign
   *
   * @description
   * Removes a person from the assignees.
   *
   * @param {string} taskKey - Key of the task.
   * @param {string} userId - Account of the person.
   * @returns {Promise<number | null>} The task's new version, or null without an `ETag`.
   */
  public async unassign(taskKey: string, userId: string): Promise<number | null> {
    const response: HttpResponse<unknown> = await firstValueFrom<HttpResponse<unknown>>(
      this.tasks.unassignTask(taskKey, userId, { observe: 'response' }),
    );
    return versionOf(response);
  }

  /**
   * Method label
   *
   * @description
   * Adds a label to the task, or removes it (without regard to case).
   *
   * @param {string} taskKey - Key of the task.
   * @param {string} label - The label.
   * @param {boolean} on - Whether to add it.
   * @returns {Promise<TaskDetailTask>} The task as the gateway saved it.
   */
  public async label(taskKey: string, label: string, on: boolean): Promise<TaskDetailTask> {
    const task: AddTaskLabelClientResult = await firstValueFrom(
      on
        ? this.tasks.addTaskLabel(taskKey, { name: label })
        : this.tasks.removeTaskLabel(taskKey, { name: label }),
    );
    return toTaskDetailTask(task);
  }

  /**
   * Method watchers
   *
   * @description
   * Reads the accounts that follow the task (the defaults, creator and assignees, with the
   * per-person overrides applied), without the HTTP cache.
   *
   * @param {string} taskKey - Key of the task.
   * @returns {Promise<readonly string[]>} The user ids.
   */
  public async watchers(taskKey: string): Promise<readonly string[]> {
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const page: ListTaskWatchersClientResult = await firstValueFrom(
        this.tasks.listTaskWatchers(taskKey, { limit: PAGE_SIZE, cursor }, { cache: 'no-store' }),
      );
      ids.push(...page.items.map((watcher) => watcher.userId));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return ids;
  }

  /**
   * Method approval
   *
   * @description
   * Reads the current approval round of the task.
   *
   * @param {string} taskKey - Key of the task.
   * @returns {Promise<TaskApproval>} The approval.
   */
  public async approval(taskKey: string): Promise<TaskApproval> {
    const state: GetTaskApprovalClientResult = await firstValueFrom(
      this.approvalRead.approval(taskKey),
    );
    return toTaskApproval(state);
  }

  /**
   * Method requestApproval
   *
   * @description
   * Starts a new approval round with these reviewers, replacing the current one and its votes
   * (the gateway has no operation that edits a round's reviewers). `If-Match` is required.
   *
   * @param {string} taskKey - Key of the task.
   * @param {number} version - Task version the change was made against.
   * @param {readonly string[]} reviewerIds - One to twenty accounts with edit access.
   * @returns {Promise<TaskApproval>} The new approval state.
   * @throws {TaskVersionConflict} When the task changed since that version.
   */
  public async requestApproval(
    taskKey: string,
    version: number,
    reviewerIds: readonly string[],
  ): Promise<TaskApproval> {
    try {
      const state: GetTaskApprovalClientResult = await firstValueFrom(
        this.tasks.requestTaskApproval(
          taskKey,
          { reviewerUserIds: [...reviewerIds] },
          { headers: { 'If-Match': `"${version.toString()}"` } },
        ),
      );
      return toTaskApproval(state);
    } catch (error: unknown) {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 412 &&
        !hasProblemCode(error, 'organization.context-changed')
      ) {
        throw new TaskVersionConflict(taskKey);
      }
      throw error;
    }
  }

  /**
   * Method dependencies
   *
   * @description
   * Reads the dependencies of the task, seen from it, without the HTTP cache.
   *
   * @param {string} taskKey - Key of the task.
   * @returns {Promise<readonly TaskDependency[]>} The dependencies in creation order.
   */
  public async dependencies(taskKey: string): Promise<readonly TaskDependency[]> {
    const edges: TaskDependency[] = [];
    let cursor: string | undefined;
    do {
      const page: ListTaskDependenciesClientResult = await firstValueFrom(
        this.tasks.listTaskDependencies(
          taskKey,
          { limit: PAGE_SIZE, cursor },
          { cache: 'no-store' },
        ),
      );
      edges.push(...page.items.map((edge) => toTaskDependency(edge, taskKey)));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return edges;
  }

  /**
   * Method addDependency
   *
   * @description
   * Links the task to another one, with an `Idempotency-Key` so a retried request does not
   * link twice. The gateway refuses a duplicate (`409`) and a cycle (`422 dependency.cycle`).
   *
   * @param {string} taskKey - Key of the open task.
   * @param {string} otherKey - Key of the other task.
   * @param {TaskDependencyDirection} direction - Whether the open task is blocked by it or blocks it.
   * @param {string} idempotencyKey - Key of the request.
   * @returns {Promise<CreatedDependency>} The edge and the task's new version.
   */
  public async addDependency(
    taskKey: string,
    otherKey: string,
    direction: TaskDependencyDirection,
    idempotencyKey: string,
  ): Promise<CreatedDependency> {
    const response: HttpResponse<CreateTaskDependencyClientResult> = await firstValueFrom(
      this.tasks.createTaskDependency(
        taskKey,
        { otherTaskKey: otherKey, direction },
        { observe: 'response', headers: { 'Idempotency-Key': idempotencyKey } },
      ),
    );
    if (!response.body) throw new Error('The gateway returned no dependency.');
    return {
      dependency: toTaskDependency(response.body, taskKey),
      version: versionOf(response),
    };
  }

  /**
   * Method removeDependency
   *
   * @description
   * Removes a dependency of the task.
   *
   * @param {string} taskKey - Key of the open task.
   * @param {string} dependencyId - Id of the edge.
   * @returns {Promise<number | null>} The task's new version, or null without an `ETag`.
   */
  public async removeDependency(taskKey: string, dependencyId: string): Promise<number | null> {
    const response: HttpResponse<unknown> = await firstValueFrom<HttpResponse<unknown>>(
      this.tasks.deleteTaskDependency(taskKey, dependencyId, { observe: 'response' }),
    );
    return versionOf(response);
  }

  /**
   * Method candidates
   *
   * @description
   * The editable tasks the open task can be linked to in that direction, same list first; the
   * gateway leaves out those it knows unsuitable (itself, a cycle).
   *
   * @param {string} taskKey - Key of the open task.
   * @param {TaskDependencyDirection} direction - Direction of the link to create.
   * @param {string} search - Typed text (name or key), possibly empty.
   * @returns {Promise<readonly TaskDependencyTask[]>} Ten candidates at most.
   */
  public async candidates(
    taskKey: string,
    direction: TaskDependencyDirection,
    search: string,
  ): Promise<readonly TaskDependencyTask[]> {
    const text: string = search.trim().slice(0, 100);
    const page: ListDependencyCandidatesClientResult = await firstValueFrom(
      this.tasks.listDependencyCandidates(
        taskKey,
        { direction, limit: CANDIDATE_LIMIT, ...(text ? { search: text } : {}) },
        { cache: 'no-store' },
      ),
    );
    return page.items.map(toTaskDependencyTask);
  }

  /**
   * Method statusTimes
   *
   * @description
   * Reads the time the task spent in each status; a milestone has none.
   *
   * @param {string} taskKey - Key of the task.
   * @returns {Promise<TaskStatusTimes | null>} The times, or null for a milestone.
   */
  public async statusTimes(taskKey: string): Promise<TaskStatusTimes | null> {
    const result: GetTaskStatusDurationsClientResult = await firstValueFrom(
      this.time.getTaskStatusDurations(taskKey, { cache: 'no-store' }),
    );
    return toTaskStatusTimes(result);
  }

  /**
   * Method sprintEnd
   *
   * @description
   * The last day of the sprint of a list, for the due date's `End of the sprint` shortcut.
   *
   * @param {string} listId - Id of the list.
   * @returns {Promise<string | null>} The day (`YYYY-MM-DD`), or null for a list that is not a sprint.
   */
  public async sprintEnd(listId: string): Promise<string | null> {
    const list: GetListClientResult = await firstValueFrom(this.lists.getList(listId));
    return list.sprint?.endDate ?? null;
  }
  // #endregion
}
