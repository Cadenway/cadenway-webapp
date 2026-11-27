import type { ListMembersClientResult, ListMyTasksClientResult } from '@cadenway/api-client';

import { type Person, personOf, type TaskSummary } from '@features/task';

import type { MyTasksCounts } from '../../../models/my-tasks-read/my-tasks-read.interface';

/**
 * Type MyTaskDto
 *
 * @description
 * One task of a `listMyTasks` page.
 *
 * @type {ListMyTasksClientResult['items'][number]}
 */
export type MyTaskDto = ListMyTasksClientResult['items'][number];

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
 * Function toMyTask
 *
 * @description
 * Maps a task of `listMyTasks` to the summary Task's rows and menu take. Task's own adapter is not
 * published across features, so each page of rows outside a list maps its summaries itself. The
 * gateway's summaries carry no comment count, so `comments` is null.
 *
 * @param {MyTaskDto} task - The task the gateway returned.
 * @returns {TaskSummary} The display model.
 */
export function toMyTask(task: MyTaskDto): TaskSummary {
  return {
    id: task.key,
    key: task.key,
    name: task.name,
    status: task.status,
    cancelReason: task.cancelReason,
    priority: task.priority,
    assigneeIds: task.assignees.map((assignee: MyTaskDto['assignees'][number]) => assignee.userId),
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
 * Function toMyTasksCounts
 *
 * @description
 * Maps the counts of a `listMyTasks` page.
 *
 * @param {ListMyTasksClientResult['counts']} counts - The counts the gateway returned.
 * @returns {MyTasksCounts} The counts of both tabs.
 */
export function toMyTasksCounts(counts: ListMyTasksClientResult['counts']): MyTasksCounts {
  return { open: counts.open, closed: counts.closed };
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
