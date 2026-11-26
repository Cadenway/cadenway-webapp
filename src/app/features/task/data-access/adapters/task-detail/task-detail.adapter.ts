import type {
  GetTaskDetailClientResult,
  GetTaskReminderClientResult,
  ListTaskCommentsClientResult,
  TasksService,
  UpdateTaskClientResult,
} from '@cadenway/api-client';

import type { TaskMentionSpan } from '../../../models/task-detail-sections/task-detail-sections.interface';
import type {
  TaskChecklistItem,
  TaskComment,
  TaskCommentPage,
  TaskDetail,
  TaskDetailPatch,
  TaskDetailTask,
  TaskReminder,
} from '../../../models/task-detail/task-detail.interface';
import type { TaskSummary } from '../../../models/task-summary/task-summary.interface';
import { toStatusOptions } from '../status-option/status-option.adapter';
import { toTaskSummary } from '../task-summary/task-summary.adapter';

/**
 * Type TaskCommentDto
 *
 * @description
 * One comment as the gateway sends it.
 *
 * @type {ListTaskCommentsClientResult['items'][number]}
 */
type TaskCommentDto = ListTaskCommentsClientResult['items'][number];

/**
 * Type TaskPatchDto
 *
 * @description
 * The JSON Merge Patch `updateTask` takes.
 *
 * @type {Parameters<TasksService['updateTask']>[1]}
 */
export type TaskPatchDto = Parameters<TasksService['updateTask']>[1];

/**
 * Function toTaskDetailTask
 *
 * @description
 * Maps a full task (the detail's, or what a write returns) to the detail's task model.
 *
 * @param {UpdateTaskClientResult} task - The gateway task.
 * @returns {TaskDetailTask} The task model.
 */
export function toTaskDetailTask(task: UpdateTaskClientResult): TaskDetailTask {
  const summary: TaskSummary = toTaskSummary(task);
  return {
    ...summary,
    description: task.description,
    cancelNote: task.cancelNote,
    estimateMinutes: task.estimateMinutes,
    checklistItems: task.checklist.map(
      (item: UpdateTaskClientResult['checklist'][number]): TaskChecklistItem => ({
        id: item.id,
        text: item.text,
        done: item.done,
      }),
    ),
    createdAt: task.createdAt,
    createdBy: { type: task.createdBy.type, id: task.createdBy.id },
    updatedAt: task.updatedAt,
    archivedAt: task.archivedAt ?? null,
  };
}

/**
 * Function toTaskComment
 *
 * @description
 * Maps one comment.
 *
 * @param {TaskCommentDto} comment - The gateway comment.
 * @returns {TaskComment} The comment model.
 */
function toTaskComment(comment: TaskCommentDto): TaskComment {
  return {
    id: comment.id,
    author: { type: comment.actor.type, id: comment.actor.id },
    body: comment.body,
    createdAt: comment.createdAt,
    editedAt: comment.editedAt,
    version: comment.version,
    replyToCommentId: comment.replyToCommentId,
  };
}

/**
 * Function toTaskCommentPage
 *
 * @description
 * Maps a page of comments.
 *
 * @param {ListTaskCommentsClientResult} page - The gateway page.
 * @returns {TaskCommentPage} The page model.
 */
export function toTaskCommentPage(page: ListTaskCommentsClientResult): TaskCommentPage {
  return {
    items: page.items.map(toTaskComment),
    total: page.total,
    nextCursor: page.nextCursor,
  };
}

/**
 * Function toTaskDetail
 *
 * @description
 * Maps the detail aggregate. The list's `callerRole` decides whether the caller may change the
 * task (`edit`) and comment on it (`edit` or `comment`); no role reported reads as `edit` (the
 * rule before grants existed) and an unknown one as `view`. Comments missing from the aggregate
 * are null and named in `partial`.
 *
 * @param {GetTaskDetailClientResult} detail - The gateway aggregate.
 * @returns {TaskDetail} The detail model.
 */
export function toTaskDetail(detail: GetTaskDetailClientResult): TaskDetail {
  const role: string | undefined = detail.list.callerRole;
  return {
    task: toTaskDetailTask(detail.task),
    space: {
      id: detail.space.id,
      name: detail.space.name,
      statuses: toStatusOptions(detail.space.statuses),
    },
    list: {
      id: detail.list.id,
      name: detail.list.name,
      spaceId: detail.list.spaceId,
      canEdit: role === undefined || role === 'edit',
      canComment: role === undefined || role === 'edit' || role === 'comment',
    },
    parent: detail.parent
      ? { key: detail.parent.key, name: detail.parent.name, status: detail.parent.status }
      : null,
    subtasks: detail.subtasks.map(toTaskSummary),
    comments: detail.comments ? toTaskCommentPage(detail.comments) : null,
    partial: [...detail.partial],
  };
}

/**
 * Function toTaskPatch
 *
 * @description
 * Maps a detail patch to the gateway's JSON Merge Patch: `due` and `start` become `dueDate` and
 * `startDate`, a blank cancellation note becomes null, the description's mention spans become
 * `descriptionMentions`, and absent members stay absent.
 *
 * @param {TaskDetailPatch} patch - The detail patch.
 * @returns {TaskPatchDto} The gateway patch.
 */
export function toTaskPatch(patch: TaskDetailPatch): TaskPatchDto {
  const body: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (field === 'due') body['dueDate'] = value;
    else if (field === 'start') body['startDate'] = value;
    else if (field === 'cancelNote') body['cancelNote'] = value === '' ? null : value;
    else if (field === 'descriptionMentions') {
      body['descriptionMentions'] = (value as readonly TaskMentionSpan[]).map(
        (span: TaskMentionSpan) => ({ userId: span.userId, start: span.start, end: span.end }),
      );
    } else body[field] = value;
  }
  return body;
}

/**
 * Function toTaskReminder
 *
 * @description
 * Maps the caller's pending reminder of a task.
 *
 * @param {GetTaskReminderClientResult} reminder - The gateway reminder.
 * @returns {TaskReminder} The reminder model.
 */
export function toTaskReminder(reminder: GetTaskReminderClientResult): TaskReminder {
  return {
    id: reminder.id,
    at: reminder.remindAt,
    note: reminder.note ?? '',
    fired: reminder.firedAt !== null,
  };
}
