import { inject, Service } from '@angular/core';
import {
  type TaskGroup,
  type TaskGroupPage,
  TaskQueriesService,
  type TaskSummaryPage,
  TasksService,
} from '@cadenway/api-client';

import type { TaskSummary } from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

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
 * Function groupAllowed
 *
 * @description
 * Keeps only group values selected in a filter on the grouped field. The gateway resolves `me`
 * to the current user's id when naming assignee groups.
 *
 * @param {ListTaskQuery} query - The view's filters.
 * @param {GroupFilter} group - The group being considered.
 * @param {string} userId - The signed-in user id.
 * @returns {boolean} Whether the group belongs in the view.
 */
function groupAllowed(query: ListTaskQuery, group: GroupFilter, userId: string): boolean {
  const values: readonly string[] | undefined = query[group.groupBy];
  if (!values || values.length === 0) return true;
  const value: string = group.value.toLowerCase();
  return values.some(
    (item: string): boolean =>
      (group.groupBy === 'assignee' && item === 'me' ? userId : item).toLowerCase() === value,
  );
}

/**
 * Service ListTasksApi
 *
 * @description
 * The reads of the rows of the `List` view: the group counts (`countTaskGroups`), the cursor
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

  /**
   * Property workspace
   *
   * @description
   * Resolves the `me` filter to the id returned in assignee group counts.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
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
        groups.push(
          ...page.items
            .filter((group: TaskGroup): boolean =>
              groupAllowed(
                groupQuery.query,
                { groupBy: groupQuery.groupBy, value: group.value },
                this.workspace.user().id,
              ),
            )
            .map((group: TaskGroup) => toTaskGroupCount(group)),
        );
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
   * Reads one server-filtered page in the view's order. A group outside the view's filter is
   * empty and does not cause a request.
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
      if (group && !groupAllowed(query, group, this.workspace.user().id)) {
        return { items: [], nextCursor: null, total: 0 };
      }
      const page: TaskSummaryPage = await abortableRead(
        this.queries.queryListTasks(listId, toListTasksQuery(query, group, cursor, limit), {
          cache: 'no-store',
        }),
        signal,
      );
      return toListTaskPage(page);
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
