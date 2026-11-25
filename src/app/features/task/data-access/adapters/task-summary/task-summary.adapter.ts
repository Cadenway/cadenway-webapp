import type { ListTasksClientResult, UpdateTaskClientResult } from '@cadenway/api-client';

import type { TaskSummary } from '../../../models/task-summary/task-summary.interface';

/**
 * Type TaskSummaryDto
 *
 * @description
 * The fields a task summary and a full task of the gateway share, which the summary reads.
 *
 * @type {Pick<ListTasksClientResult['items'][number] & UpdateTaskClientResult, string>}
 */
export type TaskSummaryDto = Pick<
  ListTasksClientResult['items'][number] & UpdateTaskClientResult,
  | 'key'
  | 'name'
  | 'status'
  | 'cancelReason'
  | 'priority'
  | 'assignees'
  | 'dueDate'
  | 'startDate'
  | 'labels'
  | 'parentKey'
  | 'listId'
  | 'spaceId'
  | 'subtaskCounts'
  | 'checklistCounts'
  | 'milestone'
  | 'recurrence'
  | 'version'
>;

/**
 * Function toTaskSummary
 *
 * @description
 * Maps a task summary or a full task of the gateway to the summary the rows show. The gateway's
 * summaries carry no comment count yet, so `comments` is null.
 *
 * @param {TaskSummaryDto} task - Task returned by the gateway.
 * @returns {TaskSummary} The display model.
 */
export function toTaskSummary(task: TaskSummaryDto): TaskSummary {
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
