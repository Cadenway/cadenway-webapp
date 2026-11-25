import { inject, Service } from '@angular/core';
import {
  type TaskGroup,
  type TaskGroupPage,
  TaskQueriesService,
  type TaskSummaryPage,
  TasksService,
} from '@cadenway/api-client';

import type { TaskSummary } from '@features/task';

import type {
  GroupFilter,
  ListTaskPage,
  TaskGroupCount,
} from '../../../models/list-rows/list-rows.interface';
import type {
  ListGroupQuery,
  ListTaskQuery,
} from '../../../models/list-view-config/list-view-config.interface';
import {
  toGroupCountParams,
  toListTask,
  toListTaskPage,
  toListTasksQuery,
  toTaskGroupCount,
} from '../../adapters/list-task/list-task.adapter';
import { toRouteError } from '../../adapters/route-error/route-error.adapter';
import { abortableRead } from '../../utils/abortable-read/abortable-read.util';

/**
 * Constant SUBTASK_PAGE_LIMIT
 *
 * @description
 * Page size of the subtasks of a task; a task holds 25 subtasks at most (`KID_MAX_COUNT` of
 * `App.dc.html`), so one page holds them.
 *
 * @type {number}
 */
const SUBTASK_PAGE_LIMIT: number = 100;

/**
 * Service ListTasksApi
 *
 * @description
 * The reads of the rows of the « Liste » view: the group counts (`countTaskGroups`), the cursor
 * pages of the tasks of a list or of one of its groups (`queryListTasks`) and the subtasks of a
 * task (`listSubtasks`), mapped to task summaries. Every read bypasses the HTTP cache, so a
 * reload after a realtime notice reads the gateway again. A failed read rejects with the typed
 * route error of the list.
 */
@Service()
export class ListTasksApi {
  // #region Properties
  /**
   * Property queries
   *
   * @description
   * Generated task query operations.
   *
   * @type {TaskQueriesService}
   * @readonly
   */
  private readonly queries: TaskQueriesService = inject(TaskQueriesService);

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
  // #endregion

  // #region Methods
  /**
   * Method groups
   *
   * @description
   * Reads every group of the view with its count, in the gateway's order: the workflow for
   * statuses, `urgente` to `basse` for priorities, the most tasks first then `none` for
   * assignees.
   *
   * @param {string} listId - The list.
   * @param {ListGroupQuery} groupQuery - The view's grouping and query.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<readonly TaskGroupCount[]>} The groups.
   * @throws {Error} The typed route error of the failure.
   */
  public async groups(
    listId: string,
    groupQuery: ListGroupQuery,
    signal?: AbortSignal,
  ): Promise<readonly TaskGroupCount[]> {
    try {
      const groups: TaskGroupCount[] = [];
      let cursor: string | null = null;
      do {
        const page: TaskGroupPage = await abortableRead(
          this.queries.countTaskGroups(listId, toGroupCountParams(groupQuery, cursor), {
            cache: 'no-store',
          }),
          signal,
        );
        groups.push(...page.items.map((group: TaskGroup) => toTaskGroupCount(group)));
        cursor = page.nextCursor;
      } while (cursor !== null);
      return groups;
    } catch (error: unknown) {
      throw toRouteError(error, 'list', listId);
    }
  }

  /**
   * Method page
   *
   * @description
   * Reads tasks in the view's order, retaining its filters and checking group membership locally.
   * Pages with no matching group members are skipped until a match or the last cursor.
   *
   * @param {string} listId - The list.
   * @param {ListTaskQuery} query - The view's query.
   * @param {GroupFilter | null} group - The group to read, or null for every task.
   * @param {string | null} cursor - Cursor of the page, null for the first one.
   * @param {number} limit - Page size, 100 at most.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<ListTaskPage>} The page.
   * @throws {Error} The typed route error of the failure.
   */
  public async page(
    listId: string,
    query: ListTaskQuery,
    group: GroupFilter | null,
    cursor: string | null,
    limit: number,
    signal?: AbortSignal,
  ): Promise<ListTaskPage> {
    try {
      let nextCursor: string | null = cursor;
      for (;;) {
        const page: TaskSummaryPage = await abortableRead(
          this.queries.queryListTasks(listId, toListTasksQuery(query, group, nextCursor, limit), {
            cache: 'no-store',
          }),
          signal,
        );
        const mapped: ListTaskPage = toListTaskPage(page);
        const items: readonly TaskSummary[] = group
          ? mapped.items.filter((task: TaskSummary): boolean => {
              switch (group.groupBy) {
                case 'status':
                  return task.status === group.value;
                case 'priority':
                  return task.priority === group.value;
                case 'assignee':
                  return group.value === 'none'
                    ? task.assigneeIds.length === 0
                    : task.assigneeIds.includes(group.value);
              }
            })
          : mapped.items;
        if (items.length > 0 || mapped.nextCursor === null) return { ...mapped, items };
        nextCursor = mapped.nextCursor;
      }
    } catch (error: unknown) {
      throw toRouteError(error, 'list', listId);
    }
  }

  /**
   * Method subtasks
   *
   * @description
   * Reads the subtasks of a task, in their order, to its last page.
   *
   * @param {string} taskKey - Key of the parent task.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<readonly TaskSummary[]>} The subtasks.
   */
  public async subtasks(taskKey: string, signal?: AbortSignal): Promise<readonly TaskSummary[]> {
    const items: TaskSummary[] = [];
    let cursor: string | null = null;
    do {
      const page: TaskSummaryPage = await abortableRead(
        this.tasks.listSubtasks(
          taskKey,
          { limit: SUBTASK_PAGE_LIMIT, ...(cursor === null ? {} : { cursor }) },
          { cache: 'no-store' },
        ),
        signal,
      );
      items.push(...page.items.map(toListTask));
      cursor = page.nextCursor;
    } while (cursor !== null);
    return items;
  }
  // #endregion
}
