import type { ListTimesheetPage, ListTimesheetRow } from '@cadenway/api-client';

import type { ListTimesheet, TimesheetEntry } from '../../../models/timesheet/timesheet.interface';

/**
 * Constant WEEK_LENGTH
 *
 * @description
 * Days of a timesheet week, Monday to Sunday.
 *
 * @type {number}
 */
const WEEK_LENGTH: number = 7;

/**
 * Function weekOf
 *
 * @description
 * Keeps exactly seven whole, non-negative minute counts: a shorter answer is padded with zeros and
 * a longer one cut, so the table and the charts always draw seven days.
 *
 * @param {readonly number[]} minutes - Minutes as the gateway sent them.
 * @returns {readonly number[]} Seven minute counts, Monday first.
 */
function weekOf(minutes: readonly number[]): readonly number[] {
  return Array.from({ length: WEEK_LENGTH }, (_: unknown, index: number): number => {
    const value: number = index < minutes.length ? minutes[index] : 0;
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
  });
}

/**
 * Function toTimesheetEntry
 *
 * @description
 * Maps a row of `getListTimesheet` to the minutes of one person on one task.
 *
 * @param {ListTimesheetRow} row - A row of a timesheet page.
 * @returns {TimesheetEntry} The display model.
 */
export function toTimesheetEntry(row: ListTimesheetRow): TimesheetEntry {
  return {
    userId: row.author.userId,
    taskKey: row.taskKey,
    name: row.name,
    status: row.status,
    minutesByDay: weekOf(row.minutesByDay),
    totalMinutes: row.totalMinutes,
  };
}

/**
 * Function toListTimesheet
 *
 * @description
 * Joins the pages of one week into its timesheet. The days and totals come from the first page
 * (the gateway computes them across pages); the entries of every page follow in order.
 *
 * @param {readonly ListTimesheetPage[]} pages - The pages of the week, first one first; at least one.
 * @returns {ListTimesheet} The display model.
 */
export function toListTimesheet(pages: readonly ListTimesheetPage[]): ListTimesheet {
  const [first]: readonly ListTimesheetPage[] = pages;
  const totals: readonly number[] = weekOf(first.days.map((day) => day.totalMinutes));
  return {
    listId: first.listId,
    weekStart: first.weekStart,
    days: first.days
      .slice(0, WEEK_LENGTH)
      .map((day, index: number) => ({ date: day.date, totalMinutes: totals[index] })),
    totalMinutes: first.totalMinutes,
    entries: pages.flatMap((page: ListTimesheetPage) => page.items.map(toTimesheetEntry)),
  };
}
