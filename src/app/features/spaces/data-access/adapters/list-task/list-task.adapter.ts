import type {
  CountTaskGroupsParams,
  ListTasksQuery,
  TaskGroup,
  TaskSummary as TaskSummaryDto,
  TaskSummaryPage,
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

/**
 * Function toListTask
 *
 * @description
 * Maps a task of a list page to the task summary of the rows. The gateway has no other id than
 * the key, so `id` is the key; the comment count stays null, task summaries carry none.
 *
 * @param {TaskSummaryDto} task - A task as `queryListTasks` or `listSubtasks` answers it.
 * @returns {TaskSummary} The display model.
 */
export function toListTask(task: TaskSummaryDto): TaskSummary {
  return {
    id: task.key,
    key: task.key,
    name: task.name,
    status: task.status,
    cancelReason: task.cancelReason,
    priority: task.priority,
    assigneeIds: task.assignees.map((assignee: { userId: string }) => assignee.userId),
    due: task.dueDate,
    start: task.startDate,
    labels: [...task.labels],
    subtasks: { closed: task.subtaskCounts.closed, total: task.subtaskCounts.total },
    checklist: { closed: task.checklistCounts.done, total: task.checklistCounts.total },
    comments: null,
    parentKey: task.parentKey,
    milestone: task.milestone === true,
    recurrence: task.recurrence ?? 'none',
    listId: task.listId,
    spaceId: task.spaceId,
    version: task.version,
  };
}

/**
 * Function toListTaskPage
 *
 * @description
 * Maps one cursor page of tasks.
 *
 * @param {TaskSummaryPage} page - The page as the gateway answers it.
 * @returns {ListTaskPage} The display model.
 */
export function toListTaskPage(page: TaskSummaryPage): ListTaskPage {
  return { items: page.items.map(toListTask), nextCursor: page.nextCursor, total: page.total };
}

/**
 * Function toTaskGroupCount
 *
 * @description
 * Maps one group of `countTaskGroups`.
 *
 * @param {TaskGroup} group - The group as the gateway answers it.
 * @returns {TaskGroupCount} The display model.
 */
export function toTaskGroupCount(group: TaskGroup): TaskGroupCount {
  return { value: group.value, count: group.count };
}

/**
 * Function withGroup
 *
 * @description
 * The view's query with the value of one group in place of the filter of the grouped field, as
 * the contract reads a group ("grouping is a filter"). The group counts already respect the
 * view's filters, so the group value narrows them.
 *
 * @param {ListTaskQuery} query - The view's query.
 * @param {GroupFilter | null} group - The group to read, or null for every task.
 * @returns {ListTaskQuery} The query of the group.
 */
export function withGroup(query: ListTaskQuery, group: GroupFilter | null): ListTaskQuery {
  if (!group) return query;
  switch (group.groupBy) {
    case 'status':
      return { ...query, status: [group.value as NonNullable<ListTaskQuery['status']>[number]] };
    case 'priority':
      return {
        ...query,
        priority: [group.value as NonNullable<ListTaskQuery['priority']>[number]],
      };
    case 'assignee':
      return { ...query, assignee: [group.value] };
  }
}

/**
 * Function toListTasksQuery
 *
 * @description
 * The `queryListTasks` body of one page of the view, a group's value added.
 *
 * @param {ListTaskQuery} query - The view's query.
 * @param {GroupFilter | null} group - The group to read, or null for every task.
 * @param {string | null} cursor - Cursor of the page, null for the first one.
 * @param {number} limit - Page size, 100 at most.
 * @returns {ListTasksQuery} The request body.
 */
export function toListTasksQuery(
  query: ListTaskQuery,
  group: GroupFilter | null,
  cursor: string | null,
  limit: number,
): ListTasksQuery {
  const scoped: ListTaskQuery = withGroup(query, group);
  return {
    ...(scoped.status ? { status: [...scoped.status] } : {}),
    ...(scoped.priority ? { priority: [...scoped.priority] } : {}),
    ...(scoped.assignee ? { assignee: [...scoped.assignee] } : {}),
    ...(scoped.label ? { label: [...scoped.label] } : {}),
    ...(scoped.search ? { search: scoped.search } : {}),
    ...(scoped.milestone ? { milestone: true } : {}),
    level: scoped.level,
    sort: scoped.sort as NonNullable<ListTasksQuery['sort']>,
    ...(cursor === null ? {} : { cursor }),
    limit,
  };
}

/**
 * Function toGroupCountParams
 *
 * @description
 * The `countTaskGroups` parameters of the view.
 *
 * @param {ListGroupQuery} groupQuery - The view's grouping and query.
 * @param {string | null} cursor - Cursor of the page of groups, null for the first one.
 * @returns {CountTaskGroupsParams} The request parameters.
 */
export function toGroupCountParams(
  groupQuery: ListGroupQuery,
  cursor: string | null,
): CountTaskGroupsParams {
  const query: ListTaskQuery = groupQuery.query;
  return {
    groupBy: groupQuery.groupBy,
    ...(query.status ? { status: [...query.status] } : {}),
    ...(query.priority ? { priority: [...query.priority] } : {}),
    ...(query.assignee ? { assignee: [...query.assignee] } : {}),
    ...(query.label ? { label: [...query.label] } : {}),
    ...(query.search ? { search: query.search } : {}),
    ...(query.milestone ? { milestone: true } : {}),
    level: query.level,
    ...(cursor === null ? {} : { cursor }),
    limit: 100,
  };
}
