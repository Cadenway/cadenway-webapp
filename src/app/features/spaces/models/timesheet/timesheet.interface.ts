import type { StatusKey } from '../list-view-config/list-view-config.interface';

/**
 * Interface TimesheetDay
 *
 * @description
 * One day of a timesheet week with the minutes recorded on it across people and tasks.
 */
export interface TimesheetDay {
  // #region Properties
  /**
   * Property date
   *
   * @description
   * Calendar date, `YYYY-MM-DD`.
   *
   * @type {string}
   * @readonly
   */
  readonly date: string;

  /**
   * Property totalMinutes
   *
   * @description
   * Minutes recorded on that day.
   *
   * @type {number}
   * @readonly
   */
  readonly totalMinutes: number;
  // #endregion
}

/**
 * Interface TimesheetEntry
 *
 * @description
 * The minutes one person recorded on one task of the list, day by day over the week.
 */
export interface TimesheetEntry {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * Account of the author, a former member included.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property taskKey
   *
   * @description
   * Key of the task (`CAD-482`).
   *
   * @type {string}
   * @readonly
   */
  readonly taskKey: string;

  /**
   * Property name
   *
   * @description
   * Name of the task.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property status
   *
   * @description
   * Status of the task.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property minutesByDay
   *
   * @description
   * Minutes of each of the seven days of the week, Monday first.
   *
   * @type {readonly number[]}
   * @readonly
   */
  readonly minutesByDay: readonly number[];

  /**
   * Property totalMinutes
   *
   * @description
   * Minutes of the week.
   *
   * @type {number}
   * @readonly
   */
  readonly totalMinutes: number;
  // #endregion
}

/**
 * Interface ListTimesheet
 *
 * @description
 * The time recorded on the tasks of a list over one week, read to its last page.
 */
export interface ListTimesheet {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * The list.
   *
   * @type {string}
   * @readonly
   */
  readonly listId: string;

  /**
   * Property weekStart
   *
   * @description
   * Monday of the week, `YYYY-MM-DD`.
   *
   * @type {string}
   * @readonly
   */
  readonly weekStart: string;

  /**
   * Property days
   *
   * @description
   * The seven days of the week, Monday first, with their totals.
   *
   * @type {readonly TimesheetDay[]}
   * @readonly
   */
  readonly days: readonly TimesheetDay[];

  /**
   * Property totalMinutes
   *
   * @description
   * Minutes of the week across people and tasks.
   *
   * @type {number}
   * @readonly
   */
  readonly totalMinutes: number;

  /**
   * Property entries
   *
   * @description
   * One entry per person and task, ordered by person account, then task key.
   *
   * @type {readonly TimesheetEntry[]}
   * @readonly
   */
  readonly entries: readonly TimesheetEntry[];
  // #endregion
}

/**
 * Interface TimesheetPerson
 *
 * @description
 * A person of the timesheet with the sums of their tasks, day by day.
 */
export interface TimesheetPerson {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * Account of the person.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property minutesByDay
   *
   * @description
   * Minutes of each day, Monday first, across the person's tasks.
   *
   * @type {readonly number[]}
   * @readonly
   */
  readonly minutesByDay: readonly number[];

  /**
   * Property totalMinutes
   *
   * @description
   * Minutes of the week.
   *
   * @type {number}
   * @readonly
   */
  readonly totalMinutes: number;

  /**
   * Property tasks
   *
   * @description
   * The person's tasks with the minutes they recorded on each, in the gateway's order.
   *
   * @type {readonly TimesheetEntry[]}
   * @readonly
   */
  readonly tasks: readonly TimesheetEntry[];
  // #endregion
}

/**
 * Interface TimesheetTopTask
 *
 * @description
 * The task with the most minutes of the week, across people.
 */
export interface TimesheetTopTask {
  // #region Properties
  /**
   * Property taskKey
   *
   * @description
   * Key of the task.
   *
   * @type {string}
   * @readonly
   */
  readonly taskKey: string;

  /**
   * Property name
   *
   * @description
   * Name of the task.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property minutes
   *
   * @description
   * Minutes of the week on the task.
   *
   * @type {number}
   * @readonly
   */
  readonly minutes: number;
  // #endregion
}

/**
 * Interface TimesheetFigures
 *
 * @description
 * The key figures of a timesheet week (`App.dc.html` lines 7865-7868).
 */
export interface TimesheetFigures {
  // #region Properties
  /**
   * Property totalMinutes
   *
   * @description
   * Minutes of the week.
   *
   * @type {number}
   * @readonly
   */
  readonly totalMinutes: number;

  /**
   * Property taskCount
   *
   * @description
   * Tasks with time this week.
   *
   * @type {number}
   * @readonly
   */
  readonly taskCount: number;

  /**
   * Property workedDays
   *
   * @description
   * Working days (Monday to Friday) with time.
   *
   * @type {number}
   * @readonly
   */
  readonly workedDays: number;

  /**
   * Property averageMinutes
   *
   * @description
   * Minutes of Monday to Friday divided by the working days with time (by one when none has).
   *
   * @type {number}
   * @readonly
   */
  readonly averageMinutes: number;

  /**
   * Property topTask
   *
   * @description
   * The task with the most minutes, or null without time.
   *
   * @type {TimesheetTopTask | null}
   * @readonly
   */
  readonly topTask: TimesheetTopTask | null;
  // #endregion
}
