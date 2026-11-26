import type {
  ListTimesheetPage,
  ListWorkloadDay,
  ListWorkloadPage,
  ListWorkloadQuery,
  ListWorkloadRow,
} from '@cadenway/api-client';

import type { ListTaskQuery } from '../../../models/list-view-config/list-view-config.interface';
import type {
  WorkloadDay,
  WorkloadItem,
  WorkloadWindow,
} from '../../../models/workload/workload.interface';

/**
 * Function toWorkloadQuery
 *
 * @description
 * The `queryGetListWorkload` body of the view: its filters, search, milestones and level (the
 * sort does not apply to a workload), the week and the page.
 *
 * @param {ListTaskQuery} query - The view's query.
 * @param {string} weekStart - Monday of the first week.
 * @param {string | null} cursor - Cursor of the page, null for the first one.
 * @param {number} limit - Page size, 100 at most.
 * @returns {ListWorkloadQuery} The request body.
 */
export function toWorkloadQuery(
  query: ListTaskQuery,
  weekStart: string,
  cursor: string | null,
  limit: number,
): ListWorkloadQuery {
  return {
    weekStart,
    ...(query.status ? { status: [...query.status] } : {}),
    ...(query.priority ? { priority: [...query.priority] } : {}),
    ...(query.assignee ? { assignee: [...query.assignee] } : {}),
    ...(query.label ? { label: [...query.label] } : {}),
    ...(query.search ? { search: query.search } : {}),
    ...(query.milestone ? { milestone: true } : {}),
    level: query.level,
    ...(cursor === null ? {} : { cursor }),
    limit,
  };
}

/**
 * Function toWorkloadDay
 *
 * @description
 * Maps a day of the window.
 *
 * @param {ListWorkloadDay} day - The day as the gateway answers it.
 * @returns {WorkloadDay} The display model.
 */
function toWorkloadDay(day: ListWorkloadDay): WorkloadDay {
  return {
    date: day.date,
    totalMinutes: day.totalMinutes,
    capacityMinutes: day.dailyCapacityMinutes,
  };
}

/**
 * Function toWorkloadItem
 *
 * @description
 * Maps one task's allocation to an assignee or to the unassigned bucket.
 *
 * @param {ListWorkloadRow} row - The row as the gateway answers it.
 * @returns {WorkloadItem} The display model.
 */
function toWorkloadItem(row: ListWorkloadRow): WorkloadItem {
  return {
    assigneeId: row.assignee?.userId ?? null,
    taskKey: row.taskKey,
    name: row.name,
    status: row.status,
    minutesByDay: [...row.minutesByDay],
  };
}

/**
 * Function toWorkloadWindow
 *
 * @description
 * Maps one page of `getListWorkload`.
 *
 * @param {ListWorkloadPage} page - The page as the gateway answers it.
 * @returns {WorkloadWindow} The display model.
 */
export function toWorkloadWindow(page: ListWorkloadPage): WorkloadWindow {
  return {
    weekStart: page.weekStart,
    days: page.days.map(toWorkloadDay),
    items: page.items.map(toWorkloadItem),
    nextCursor: page.nextCursor,
  };
}

/**
 * Function addSpentMinutes
 *
 * @description
 * Adds the minutes each author recorded in a page of `getListTimesheet` to a running total by
 * account id.
 *
 * @param {Record<string, number>} spent - Minutes by account id, updated in place.
 * @param {ListTimesheetPage} page - The page as the gateway answers it.
 * @returns {Record<string, number>} The same total.
 */
export function addSpentMinutes(
  spent: Record<string, number>,
  page: ListTimesheetPage,
): Record<string, number> {
  for (const row of page.items) {
    spent[row.author.userId] = (spent[row.author.userId] ?? 0) + row.totalMinutes;
  }
  return spent;
}
