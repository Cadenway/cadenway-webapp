import type { TaskSummary } from '@features/task';

import type { CalendarMode } from '../../models/calendar-view/calendar-view.interface';
import type { DueWindow } from '../../models/list-tasks/list-tasks.interface';
import type { TaskFieldChanges } from '../../models/view-task-write/view-task-write.interface';
import { todayIso, toLocalDate } from '../calendar-date/calendar-date.util';

/**
 * Constant MONTH_GRID_DAYS
 *
 * @description
 * Days of the month grid: six weeks, as `cw-calendar-view` and the mockup draw it.
 *
 * @type {number}
 */
const MONTH_GRID_DAYS: number = 42;

/**
 * Constant DAY_MS
 *
 * @description
 * Milliseconds in a day, for the distance between two local midnights.
 *
 * @type {number}
 */
const DAY_MS: number = 86_400_000;

/**
 * Function addDays
 *
 * @description
 * A plain date moved by a number of days, in the local calendar (no time zone shift).
 *
 * @param {string} iso - Plain date, `YYYY-MM-DD`.
 * @param {number} days - Days to add, negative to go back.
 * @returns {string} The moved date.
 */
export function addDays(iso: string, days: number): string {
  const date: Date = toLocalDate(iso);
  date.setDate(date.getDate() + days);
  return todayIso(date);
}

/**
 * Function daysBetween
 *
 * @description
 * Days from one plain date to another, negative when the second comes first.
 *
 * @param {string} from - First date.
 * @param {string} to - Second date.
 * @returns {number} The days between them.
 */
export function daysBetween(from: string, to: string): number {
  return Math.round((toLocalDate(to).getTime() - toLocalDate(from).getTime()) / DAY_MS);
}

/**
 * Function weekStart
 *
 * @description
 * The Monday of a plain date's week (the French week, `weekStartsOn` 1).
 *
 * @param {string} iso - Plain date.
 * @returns {string} Its Monday.
 */
export function weekStart(iso: string): string {
  return addDays(iso, -((toLocalDate(iso).getDay() + 6) % 7));
}

/**
 * Function calendarWindow
 *
 * @description
 * The due dates the shown grid covers, both included: the six Monday-first weeks from the week
 * of the first of the month (`App.dc.html` line 6385), or the Monday to Sunday of the week.
 *
 * @param {CalendarMode} mode - Month or week.
 * @param {string} shown - A day of the month or week shown.
 * @returns {DueWindow} The window the grid reads.
 */
export function calendarWindow(mode: CalendarMode, shown: string): DueWindow {
  if (mode === 'week') {
    const from: string = weekStart(shown);
    return { from, to: addDays(from, 6) };
  }
  const from: string = weekStart(`${shown.slice(0, 8)}01`);
  return { from, to: addDays(from, MONTH_GRID_DAYS - 1) };
}

/**
 * Function rescheduleChanges
 *
 * @description
 * The single-field write that gives a task a new due date, or null when it already has it. A
 * dated task sends the due date alone, so the gateway moves its start by the same days. An
 * undated task keeps its start unless it would come after the new due date, which the gateway
 * refuses (`422 task.start-date-invalid`): the start then moves to that day.
 *
 * @param {TaskSummary} task - The task, as shown.
 * @param {string} due - The new due date.
 * @returns {TaskFieldChanges | null} The write, or null for no change.
 */
export function rescheduleChanges(task: TaskSummary, due: string): TaskFieldChanges | null {
  if (task.due === due) return null;
  if (task.due !== null || task.start === null || task.start <= due) return { dueDate: due };
  return { dueDate: due, startDate: due };
}

/**
 * Function formatLongDay
 *
 * @description
 * A day as the mockup writes it in long form (`dueInfo(…).long`, the day menu's title): the
 * weekday, the day and the month, the year when it is not the current one, capitalized
 * (`Tuesday, November 24` in English, `Mardi 24 novembre` in French).
 *
 * @param {string} iso - Plain date.
 * @param {string} locale - Application locale.
 * @param {Date} [now] - Current instant, for the current year.
 * @returns {string} The formatted day.
 */
export function formatLongDay(iso: string, locale: string, now: Date = new Date()): string {
  const date: Date = toLocalDate(iso);
  const text: string = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  }).format(date);
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}
