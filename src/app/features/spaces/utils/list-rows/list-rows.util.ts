import type { TaskSummary } from '@features/task';

import type {
  GroupProgress,
  ListRowsQuery,
  ListTaskPage,
  TaskGroupCount,
} from '../../models/list-rows/list-rows.interface';
import type { ListGroupQuery } from '../../models/list-view-config/list-view-config.interface';

/**
 * Constant ALL_GROUP
 *
 * @description
 * Value of the one group of a view that does not group (« Toutes les tâches »).
 *
 * @type {string}
 */
export const ALL_GROUP: string = 'all';

/**
 * Constant NO_ASSIGNEE_GROUP
 *
 * @description
 * Value of the group of the tasks nobody is assigned (« Non assignées »).
 *
 * @type {string}
 */
export const NO_ASSIGNEE_GROUP: string = 'none';

/**
 * Function startGroups
 *
 * @description
 * The reading progress of the groups before any page: the groups of `countTaskGroups` in their
 * order, those without a task already read, or the one group of a view that does not group.
 *
 * @param {readonly TaskGroupCount[] | null} counts - The group counts, null without grouping.
 * @returns {GroupProgress[]} The progress of each group.
 */
export function startGroups(counts: readonly TaskGroupCount[] | null): GroupProgress[] {
  if (counts === null) {
    return [{ value: ALL_GROUP, count: null, cursor: null, started: false, done: false }];
  }
  return counts.map((group: TaskGroupCount): GroupProgress => ({
    value: group.value,
    count: group.count,
    cursor: null,
    started: false,
    done: group.count === 0,
  }));
}

/**
 * Function nextGroup
 *
 * @description
 * The group whose next page the rows read: in the groups' order, an open group not read to its
 * end, or a folded group not read at all (its first page makes its header show).
 *
 * @param {readonly GroupProgress[]} groups - The reading progress.
 * @param {readonly string[]} collapsed - Values of the folded groups.
 * @returns {GroupProgress | null} The group to read, or null when nothing is left.
 */
export function nextGroup(
  groups: readonly GroupProgress[],
  collapsed: readonly string[],
): GroupProgress | null {
  return (
    groups.find((group: GroupProgress): boolean =>
      collapsed.includes(group.value) ? !group.started && !group.done : !group.done,
    ) ?? null
  );
}

/**
 * Function advanceGroup
 *
 * @description
 * The reading progress after one page of a group.
 *
 * @param {readonly GroupProgress[]} groups - The reading progress.
 * @param {string} value - The group read.
 * @param {ListTaskPage} page - The page read.
 * @returns {GroupProgress[]} The new progress.
 */
export function advanceGroup(
  groups: readonly GroupProgress[],
  value: string,
  page: ListTaskPage,
): GroupProgress[] {
  return groups.map((group: GroupProgress): GroupProgress =>
    group.value === value
      ? { ...group, cursor: page.nextCursor, started: true, done: page.nextCursor === null }
      : group,
  );
}

/**
 * Function groupValuesOf
 *
 * @description
 * The groups a task is filed under: its status, its priority, each of its assignees (a task with
 * two assignees shows in both groups, as `countTaskGroups` counts it) or `none`, or the one group
 * of a view that does not group.
 *
 * @param {TaskSummary} task - The task, its settled status applied.
 * @param {ListGroupQuery['groupBy'] | null} groupBy - What the view groups by.
 * @returns {readonly string[]} The group values.
 */
export function groupValuesOf(
  task: TaskSummary,
  groupBy: ListGroupQuery['groupBy'] | null,
): readonly string[] {
  switch (groupBy) {
    case 'status':
      return [task.status];
    case 'priority':
      return [task.priority];
    case 'assignee':
      return task.assigneeIds.length > 0 ? task.assigneeIds : [NO_ASSIGNEE_GROUP];
    case null:
      return [ALL_GROUP];
  }
}

/**
 * Function rowsKey
 *
 * @description
 * Identity of a read of the rows: the organization, the list, the query and the grouping. Two
 * reads with the same key show the same rows, so a reload keeps them in place.
 *
 * @param {string} organizationId - The committed organization.
 * @param {ListRowsQuery} query - The list and the view's query.
 * @returns {string} The key.
 */
export function rowsKey(organizationId: string, query: ListRowsQuery): string {
  return JSON.stringify([organizationId, query.listId, query.query, query.groupQuery]);
}
