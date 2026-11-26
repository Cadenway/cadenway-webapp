import type {
  CountTaskGroupsParams,
  ListTasksQuery,
  TaskGroup,
  TaskSummary as TaskSummaryDto,
  TaskSummaryPage,
  TasksService,
} from '@cadenway/api-client';

import type { TaskSummary } from '@features/task';

import type {
  GroupFilter,
  ListTaskPage,
  TaskGroupCount,
} from '../../../models/list-rows/list-rows.interface';
import type { DueWindow } from '../../../models/list-tasks/list-tasks.interface';
import type { TaskFieldChanges } from '../../../models/view-task-write/view-task-write.interface';
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
 * Narrows the grouped field to one group. The data-access service first ensures that the group
 * is allowed by any existing filter on that field.
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
 * The `queryListTasks` body of one page of the view, a group's value and a due window added.
 *
 * @param {ListTaskQuery} query - The view's query.
 * @param {GroupFilter | null} group - The group to read, or null for every task.
 * @param {string | null} cursor - Cursor of the page, null for the first one.
 * @param {number} limit - Page size, 100 at most.
 * @param {DueWindow | null} [due] - The due dates kept (`dueFrom`, `dueTo`), or null for all.
 * @returns {ListTasksQuery} The request body.
 */
export function toListTasksQuery(
  query: ListTaskQuery,
  group: GroupFilter | null,
  cursor: string | null,
  limit: number,
  due: DueWindow | null = null,
): ListTasksQuery {
  const scoped: ListTaskQuery = withGroup(query, group);
  return {
    ...(scoped.status ? { status: [...scoped.status] } : {}),
    ...(scoped.priority ? { priority: [...scoped.priority] } : {}),
    ...(scoped.assignee ? { assignee: [...scoped.assignee] } : {}),
    ...(scoped.label ? { label: [...scoped.label] } : {}),
    ...(scoped.search ? { search: scoped.search } : {}),
    ...(scoped.milestone ? { milestone: true } : {}),
    ...(due ? { dueFrom: due.from, dueTo: due.to } : {}),
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

/**
 * Type TaskFieldPatchDto
 *
 * @description
 * The JSON Merge Patch `updateTask` takes.
 *
 * @type {Parameters<TasksService['updateTask']>[1]}
 */
export type TaskFieldPatchDto = Parameters<TasksService['updateTask']>[1];

/**
 * Function toTaskFieldPatch
 *
 * @description
 * The `updateTask` patch of a single-field write of a task view: only the fields given, null
 * kept as a removal.
 *
 * @param {TaskFieldChanges} changes - The changed fields.
 * @returns {TaskFieldPatchDto} The request body.
 */
export function toTaskFieldPatch(changes: TaskFieldChanges): TaskFieldPatchDto {
  return {
    ...(changes.dueDate === undefined ? {} : { dueDate: changes.dueDate }),
    ...(changes.startDate === undefined ? {} : { startDate: changes.startDate }),
    ...(changes.estimateMinutes === undefined ? {} : { estimateMinutes: changes.estimateMinutes }),
    ...(changes.name === undefined ? {} : { name: changes.name }),
    ...(changes.customFieldValues === undefined
      ? {}
      : { customFieldValues: { ...changes.customFieldValues } }),
  };
}
