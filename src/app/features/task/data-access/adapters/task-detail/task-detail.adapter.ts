import type { TaskDetail } from '@cadenway/api-client';
import { MILESTONE_STATUS_KEYS, STATUS_KEYS, type StatusKey } from '@cadenway/contracts';

import { TASK_STATUS_LABELS } from '../../../constants/task-detail/task-detail-copy.constants';
import type {
  TaskDetailView,
  TaskStatusOption,
} from '../../../models/task-detail/task-detail.model';

/**
 * Constant milestoneStatuses
 *
 * @description
 * The published subset of statuses that a milestone may use.
 *
 * @type {ReadonlySet<StatusKey>}
 */
const milestoneStatuses: ReadonlySet<StatusKey> = new Set(MILESTONE_STATUS_KEYS);

/**
 * Function toTaskDetailView
 *
 * @description
 * Maps a generated detail response to the published fields used by the page.
 *
 * @param {TaskDetail} detail - The current detail aggregate.
 * @returns {TaskDetailView} The task detail, including the available status choices.
 */
export function toTaskDetailView(detail: TaskDetail): TaskDetailView {
  const { task, list, space, parent, subtasks }: TaskDetail = detail;
  const options: readonly TaskStatusOption[] = STATUS_KEYS.map((key) => ({
    key,
    label: space.statuses[key].name ?? TASK_STATUS_LABELS[key],
    selectable:
      key !== 'cancelled' &&
      !space.statuses[key].hidden &&
      (!task.milestone || milestoneStatuses.has(key)),
  }));

  return {
    key: task.key,
    name: task.name,
    status: task.status,
    version: task.version,
    description: task.description,
    mayEditStatus: list.callerRole === 'edit' && task.archivedAt == null,
    options,
    space: { id: space.id, name: space.name },
    list: { id: list.id, name: list.name },
    parent: parent === null ? null : { key: parent.key, name: parent.name },
    subtasks: subtasks.map((subtask) => ({ key: subtask.key, name: subtask.name })),
    comments: detail.comments?.items.map((comment) => ({ id: comment.id, body: comment.body })),
    commentsUnavailable: detail.partial.includes('comments'),
  };
}
