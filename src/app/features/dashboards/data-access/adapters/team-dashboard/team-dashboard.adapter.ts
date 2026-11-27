import type { GetTeamDashboardClientResult } from '@cadenway/api-client';

import type { TaskSummary } from '@features/task';

import type {
  DashboardCompletionWeek,
  TeamDashboard,
} from '../../../models/team-dashboard/team-dashboard.interface';
import { isoWeekOf } from '../../../utils/calendar-week/calendar-week.util';

/**
 * Type OverdueTaskDto
 *
 * @description
 * A late task as `getTeamDashboard` returns it.
 *
 * @type {GetTeamDashboardClientResult['overdueTasks'][number]}
 */
type OverdueTaskDto = GetTeamDashboardClientResult['overdueTasks'][number];

/**
 * Function toOverdueTask
 *
 * @description
 * A late task as Task's rows and menu take it: the key is its identity, the assignees their user
 * ids. The dashboard's summaries carry no comment count.
 *
 * @param {OverdueTaskDto} task - The task the gateway returned.
 * @returns {TaskSummary} The display model.
 */
export function toOverdueTask(task: OverdueTaskDto): TaskSummary {
  return {
    id: task.key,
    key: task.key,
    name: task.name,
    status: task.status,
    cancelReason: task.cancelReason,
    priority: task.priority,
    assigneeIds: task.assignees.map((assignee: { userId: string }): string => assignee.userId),
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
 * Function toTeamDashboard
 *
 * @description
 * The dashboard the page draws: the counters as given, the weeks numbered from their Monday and
 * the late tasks as task summaries.
 *
 * @param {GetTeamDashboardClientResult} dashboard - The gateway's answer.
 * @returns {TeamDashboard} The display model.
 */
export function toTeamDashboard(dashboard: GetTeamDashboardClientResult): TeamDashboard {
  return {
    today: dashboard.today,
    weeks: dashboard.weeks,
    openCount: dashboard.openCount,
    lateCount: dashboard.lateCount,
    blockedCount: dashboard.blockedCount,
    completedCount: dashboard.completedCount,
    byStatus: dashboard.byStatus.map((row) => ({ status: row.status, count: row.count })),
    overdueTasks: dashboard.overdueTasks.map(toOverdueTask),
    assigneeThreshold: dashboard.assigneeThreshold,
    assignees: dashboard.assignees.map((row) => ({
      userId: row.userId,
      openCount: row.openCount,
    })),
    completions: dashboard.completions.map((week): DashboardCompletionWeek => ({
      startsOn: week.startsOn,
      week: isoWeekOf(week.startsOn),
      completed: week.completedCount,
    })),
  };
}
