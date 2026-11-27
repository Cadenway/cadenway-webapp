import type { GetHomeClientResult, ListMembersClientResult } from '@cadenway/api-client';

import { type Person, personOf, type TaskSummary } from '@features/task';

/**
 * Type HomeTaskDto
 *
 * @description
 * One task of `getHome`'s `priorities`.
 *
 * @type {GetHomeClientResult['priorities'][number]}
 */
export type HomeTaskDto = GetHomeClientResult['priorities'][number];

/**
 * Type MemberDto
 *
 * @description
 * One member of a `listMembers` page.
 *
 * @type {ListMembersClientResult['items'][number]}
 */
export type MemberDto = ListMembersClientResult['items'][number];

/**
 * Function toHomeTask
 *
 * @description
 * Maps a task of `getHome` to the summary Task's line and menu take. Task's own adapter is not
 * published across features, so each page of rows outside a list maps its summaries itself. The
 * gateway's summaries carry no comment count, so `comments` is null.
 *
 * @param {HomeTaskDto} task - The task the gateway returned.
 * @returns {TaskSummary} The display model.
 */
export function toHomeTask(task: HomeTaskDto): TaskSummary {
  return {
    id: task.key,
    key: task.key,
    name: task.name,
    status: task.status,
    cancelReason: task.cancelReason,
    priority: task.priority,
    assigneeIds: task.assignees.map(
      (assignee: HomeTaskDto['assignees'][number]) => assignee.userId,
    ),
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
 * Function toPerson
 *
 * @description
 * Maps a member to the person the task menu's `Assign` offers.
 *
 * @param {MemberDto} member - The member the gateway returned.
 * @returns {Person} The person.
 */
export function toPerson(member: MemberDto): Person {
  return personOf(member.userId, member.name);
}
