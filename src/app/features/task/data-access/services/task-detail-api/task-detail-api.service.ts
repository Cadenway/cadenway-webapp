import { HttpErrorResponse, type HttpResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import {
  ArchivesService,
  type GetTaskDetailClientResult,
  type GetTaskReminderClientResult,
  type ListTaskCommentsClientResult,
  type ListTasksClientResult,
  type ListTaskWatchersClientResult,
  RemindersService,
  type SearchClientResult,
  SearchService,
  SpacesService,
  TaskQueriesService,
  TasksService,
  type TrashTaskClientResult,
  TrashService,
  type UpdateTaskClientResult,
} from '@cadenway/api-client';
import { firstValueFrom, type Observable } from 'rxjs';

import { hasProblemCode } from '@core/api';

import type {
  TaskCommentPage,
  TaskDetail,
  TaskDetailPatch,
  TaskDetailTask,
  TaskParentCandidate,
  TaskReminder,
  TaskTrashEntry,
  TaskWatchers,
} from '../../../models/task-detail/task-detail.interface';
import { TaskVersionConflict } from '../../../models/task-write-error/task-write-error.model';
import { toTaskRouteError } from '../../adapters/route-error/task-route-error.adapter';
import {
  toTaskCommentPage,
  toTaskDetail,
  toTaskDetailTask,
  toTaskPatch,
  toTaskReminder,
} from '../../adapters/task-detail/task-detail.adapter';

/**
 * Constant PARENT_CANDIDATE_PAGE
 *
 * @description
 * Tasks of the open task's list read for the parent picker, one page (`level: all`).
 *
 * @type {number}
 */
const PARENT_CANDIDATE_PAGE: number = 100;

/**
 * Constant PARENT_SEARCH_PAGE
 *
 * @description
 * Search hits read for the parent picker, across lists.
 *
 * @type {number}
 */
const PARENT_SEARCH_PAGE: number = 20;

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
 * Function isVersionConflict
 *
 * @description
 * Whether a write failed on its `If-Match` (`412` other than an organization change).
 *
 * @param {unknown} error - The failure.
 * @returns {boolean} Whether the task changed since the version written against.
 */
function isVersionConflict(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    error.status === 412 &&
    !hasProblemCode(error, 'organization.context-changed')
  );
}

/**
 * Function versioned
 *
 * @description
 * Awaits a write, turning a version conflict into `TaskVersionConflict`.
 *
 * @param {string} taskKey - Key of the written task.
 * @param {Observable<T>} write - The write.
 * @returns {Promise<T>} Its answer.
 * @throws {TaskVersionConflict} When the task changed since the version written against.
 */
async function versioned<T>(taskKey: string, write: Observable<T>): Promise<T> {
  try {
    return await firstValueFrom(write);
  } catch (error: unknown) {
    throw isVersionConflict(error) ? new TaskVersionConflict(taskKey) : error;
  }
}

/**
 * Service TaskDetailApi
 *
 * @description
 * The reads and writes of the task detail through the generated client, mapped to the detail's
 * display models: the aggregate (`getTaskDetail`, without the HTTP cache), its comments, the
 * JSON Merge Patch with `If-Match`, duplication, archive, trash and restore, the watchers, the
 * caller's reminder, a template from the task, and the parent picker's candidates. Writes against
 * a version reject with `TaskVersionConflict` on a `412` other than an organization change.
 */
@Service()
export class TaskDetailApi {
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
   * Property queries
   *
   * @description
   * Generated list task queries.
   *
   * @type {TaskQueriesService}
   * @readonly
   */
  private readonly queries: TaskQueriesService = inject(TaskQueriesService);

  /**
   * Property archives
   *
   * @description
   * Generated archive operations.
   *
   * @type {ArchivesService}
   * @readonly
   */
  private readonly archives: ArchivesService = inject(ArchivesService);

  /**
   * Property trashes
   *
   * @description
   * Generated trash operations.
   *
   * @type {TrashService}
   * @readonly
   */
  private readonly trashes: TrashService = inject(TrashService);

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
   * Property spaces
   *
   * @description
   * Generated space operations (task templates).
   *
   * @type {SpacesService}
   * @readonly
   */
  private readonly spaces: SpacesService = inject(SpacesService);

  /**
   * Property search
   *
   * @description
   * Generated search operation.
   *
   * @type {SearchService}
   * @readonly
   */
  private readonly search: SearchService = inject(SearchService);
  // #endregion

  // #region Methods
  /**
   * Method read
   *
   * @description
   * Reads the detail aggregate without the HTTP cache. A failure rejects with the typed route
   * error the dialog renders (`toTaskRouteError`): deleted task, not found or unavailable.
   *
   * @param {string} taskKey - Key of the task.
   * @returns {Promise<TaskDetail>} The detail.
   */
  public async read(taskKey: string): Promise<TaskDetail> {
    try {
      const detail: GetTaskDetailClientResult = await firstValueFrom(
        this.tasks.getTaskDetail(taskKey, { cache: 'no-store' }),
      );
      return toTaskDetail(detail);
    } catch (error: unknown) {
      throw toTaskRouteError(error);
    }
  }

  /**
   * Method readComments
   *
   * @description
   * Reads the first page of comments, the part a partial detail misses.
   *
   * @param {string} taskKey - Key of the task.
   * @returns {Promise<TaskCommentPage>} The first page.
   */
  public async readComments(taskKey: string): Promise<TaskCommentPage> {
    const page: ListTaskCommentsClientResult = await firstValueFrom(
      this.tasks.listTaskComments(taskKey, {}, { cache: 'no-store' }),
    );
    return toTaskCommentPage(page);
  }

  /**
   * Method update
   *
   * @description
   * Sends a JSON Merge Patch with `If-Match` set to the version it was made against.
   *
   * @param {string} taskKey - Key of the task.
   * @param {number} version - Version the change was made against.
   * @param {TaskDetailPatch} patch - The changed fields.
   * @returns {Promise<TaskDetailTask>} The task as the gateway saved it.
   * @throws {TaskVersionConflict} When the task changed since that version.
   */
  public async update(
    taskKey: string,
    version: number,
    patch: TaskDetailPatch,
  ): Promise<TaskDetailTask> {
    const task: UpdateTaskClientResult = await versioned(
      taskKey,
      this.tasks.updateTask(taskKey, toTaskPatch(patch), { headers: ifMatch(version) }),
    );
    return toTaskDetailTask(task);
  }

  /**
   * Method duplicate
   *
   * @description
   * Duplicates the task in its list (` (copie)` added by the gateway), with an
   * `Idempotency-Key` so a retried request does not copy twice.
   *
   * @param {string} taskKey - Key of the task.
   * @param {number} version - Version the copy was asked against.
   * @param {string} idempotencyKey - Key of the request.
   * @returns {Promise<TaskDetailTask>} The copy.
   */
  public async duplicate(
    taskKey: string,
    version: number,
    idempotencyKey: string,
  ): Promise<TaskDetailTask> {
    const copy: UpdateTaskClientResult = await versioned(
      taskKey,
      this.tasks.duplicateTask(
        taskKey,
        {},
        { headers: { ...ifMatch(version), 'Idempotency-Key': idempotencyKey } },
      ),
    );
    return toTaskDetailTask(copy);
  }

  /**
   * Method archive
   *
   * @description
   * Archives the task with its subtasks.
   *
   * @param {string} taskKey - Key of the task.
   * @param {number} version - Version the archive was asked against.
   * @returns {Promise<void>} Resolves once archived.
   */
  public async archive(taskKey: string, version: number): Promise<void> {
    await versioned(taskKey, this.archives.archiveTask(taskKey, {}, { headers: ifMatch(version) }));
  }

  /**
   * Method unarchive
   *
   * @description
   * Restores the archive of the task (the `Undo` of an archive).
   *
   * @param {string} taskKey - Key of the task.
   * @returns {Promise<void>} Resolves once restored.
   */
  public async unarchive(taskKey: string): Promise<void> {
    await firstValueFrom(this.archives.unarchiveTask(taskKey, {}));
  }

  /**
   * Method trash
   *
   * @description
   * Moves the task and its subtasks to the trash.
   *
   * @param {string} taskKey - Key of the task.
   * @param {number} version - Version the deletion was asked against.
   * @returns {Promise<TaskTrashEntry>} The trash entry, for `Undo`.
   */
  public async trash(taskKey: string, version: number): Promise<TaskTrashEntry> {
    const entry: TrashTaskClientResult = await versioned(
      taskKey,
      this.trashes.trashTask(taskKey, {}, { headers: ifMatch(version) }),
    );
    return { id: entry.id, subtaskCount: entry.subtaskCount };
  }

  /**
   * Method restore
   *
   * @description
   * Takes a trash entry out of the trash (the `Undo` of a deletion).
   *
   * @param {string} entryId - The trash entry.
   * @returns {Promise<void>} Resolves once restored.
   */
  public async restore(entryId: string): Promise<void> {
    await firstValueFrom(this.trashes.restoreTrashEntry(entryId, {}));
  }

  /**
   * Method watchers
   *
   * @description
   * Reads how many people follow the task and whether the caller does (one item is enough: the
   * total and the caller's state come with every page).
   *
   * @param {string} taskKey - Key of the task.
   * @returns {Promise<TaskWatchers>} The watchers.
   */
  public async watchers(taskKey: string): Promise<TaskWatchers> {
    const page: ListTaskWatchersClientResult = await firstValueFrom(
      this.tasks.listTaskWatchers(taskKey, { limit: 1 }, { cache: 'no-store' }),
    );
    return { total: page.total, following: page.callerFollows };
  }

  /**
   * Method follow
   *
   * @description
   * Makes the caller follow the task, or stop following it. A committed change adds one to the
   * task version, which the answer's `ETag` carries.
   *
   * @param {string} taskKey - Key of the task.
   * @param {string} userId - The caller's account.
   * @param {boolean} following - Whether to follow.
   * @returns {Promise<number | null>} The task's new version, or null when the answer has none.
   */
  public async follow(taskKey: string, userId: string, following: boolean): Promise<number | null> {
    const response: HttpResponse<unknown> = await firstValueFrom<HttpResponse<unknown>>(
      following
        ? this.tasks.followTaskWatcher(taskKey, userId, {}, { observe: 'response' })
        : this.tasks.unfollowTaskWatcher(taskKey, userId, { observe: 'response' }),
    );
    return versionOf(response);
  }

  /**
   * Method reminder
   *
   * @description
   * Reads the caller's pending reminder of the task; none is null (`404 reminder.not-found`).
   *
   * @param {string} taskKey - Key of the task.
   * @returns {Promise<TaskReminder | null>} The reminder, or null.
   */
  public async reminder(taskKey: string): Promise<TaskReminder | null> {
    try {
      const reminder: GetTaskReminderClientResult = await firstValueFrom(
        this.reminders.getTaskReminder(taskKey, { cache: 'no-store' }),
      );
      return toTaskReminder(reminder);
    } catch (error: unknown) {
      if (hasProblemCode(error, 'reminder.not-found')) return null;
      throw error;
    }
  }

  /**
   * Method setReminder
   *
   * @description
   * Sets the caller's one pending reminder of the task, replacing a previous one.
   *
   * @param {string} taskKey - Key of the task.
   * @param {Date} at - When to remind, in the future.
   * @param {string} note - Its note; blank clears it.
   * @returns {Promise<TaskReminder>} The reminder.
   */
  public async setReminder(taskKey: string, at: Date, note: string): Promise<TaskReminder> {
    const reminder: GetTaskReminderClientResult = await firstValueFrom(
      this.reminders.setTaskReminder(taskKey, {
        remindAt: at.toISOString(),
        note: note.trim() === '' ? null : note,
      }),
    );
    return toTaskReminder(reminder);
  }

  /**
   * Method saveReminderNote
   *
   * @description
   * Changes the note of a pending reminder without rescheduling it.
   *
   * @param {string} reminderId - The reminder.
   * @param {string} note - The note; blank clears it.
   * @returns {Promise<TaskReminder>} The reminder.
   */
  public async saveReminderNote(reminderId: string, note: string): Promise<TaskReminder> {
    const reminder: GetTaskReminderClientResult = await firstValueFrom(
      this.reminders.updateReminderNote(reminderId, { note: note.trim() === '' ? null : note }),
    );
    return toTaskReminder(reminder);
  }

  /**
   * Method deleteReminder
   *
   * @description
   * Removes the caller's reminder.
   *
   * @param {string} reminderId - The reminder.
   * @returns {Promise<void>} Resolves once removed.
   */
  public async deleteReminder(reminderId: string): Promise<void> {
    await firstValueFrom(this.reminders.deleteReminder(reminderId));
  }

  /**
   * Method saveTemplate
   *
   * @description
   * Saves the task as a template of its space (name, priority, labels, description, checklist
   * and subtask names).
   *
   * @param {string} spaceId - Space of the task.
   * @param {string} taskKey - Key of the task.
   * @returns {Promise<void>} Resolves once saved.
   */
  public async saveTemplate(spaceId: string, taskKey: string): Promise<void> {
    await firstValueFrom(this.spaces.createTaskTemplate(spaceId, { sourceTaskKey: taskKey }));
  }

  /**
   * Method listCandidates
   *
   * @description
   * Reads one page of the tasks of a list, subtasks included, matching an optional text, as
   * parent candidates with their own parent and subtask count.
   *
   * @param {string} listId - The open task's list.
   * @param {string} query - Text to find; blank reads the list's first tasks.
   * @returns {Promise<readonly TaskParentCandidate[]>} The candidates.
   */
  public async listCandidates(
    listId: string,
    query: string,
  ): Promise<readonly TaskParentCandidate[]> {
    const text: string = query.trim();
    const page: ListTasksClientResult = await firstValueFrom(
      this.queries.listTasks(
        listId,
        {
          level: 'all',
          limit: PARENT_CANDIDATE_PAGE,
          ...(text === '' ? {} : { search: text.slice(0, 100) }),
        },
        { cache: 'no-store' },
      ),
    );
    return page.items.map((task: ListTasksClientResult['items'][number]): TaskParentCandidate => ({
      key: task.key,
      name: task.name,
      status: task.status,
      sameList: true,
      parentKey: task.parentKey,
      children: task.subtaskCounts.total,
    }));
  }

  /**
   * Method searchCandidates
   *
   * @description
   * Searches the visible tasks of every list by name or key, as parent candidates whose depth
   * and size the client does not know (the gateway refuses a parent beyond the limits).
   *
   * @param {string} query - Text to find, not blank.
   * @returns {Promise<readonly TaskParentCandidate[]>} The candidates.
   */
  public async searchCandidates(query: string): Promise<readonly TaskParentCandidate[]> {
    const page: SearchClientResult = await firstValueFrom(
      this.search.search({ q: query.trim().slice(0, 200), limit: PARENT_SEARCH_PAGE }),
    );
    const candidates: TaskParentCandidate[] = [];
    for (const hit of page.items) {
      if (hit.kind !== 'task' || !('taskKey' in hit)) continue;
      candidates.push({ key: hit.taskKey, name: hit.name, status: hit.status, sameList: false });
    }
    return candidates;
  }
  // #endregion
}
