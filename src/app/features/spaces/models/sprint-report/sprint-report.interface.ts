import type { StatusKey } from '@cadenway/contracts';

/**
 * Interface SprintReportTask
 *
 * @description
 * A task of the sprint's scope in the report's preview (`Delivered`, `To carry over`).
 */
export interface SprintReportTask {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Task key (`CAD-482`), which opens its detail.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property name
   *
   * @description
   * Task name.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property points
   *
   * @description
   * Points the task counts for, before rounding.
   *
   * @type {number}
   * @readonly
   */
  readonly points: number;

  /**
   * Property status
   *
   * @description
   * Status of the task at the observation.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;
  // #endregion
}

/**
 * Interface SprintReportBreakdown
 *
 * @description
 * The delivered or the remaining part of the sprint's scope at the observation.
 */
export interface SprintReportBreakdown {
  // #region Properties
  /**
   * Property points
   *
   * @description
   * Points of the part, before rounding.
   *
   * @type {number}
   * @readonly
   */
  readonly points: number;

  /**
   * Property taskCount
   *
   * @description
   * Tasks of the part the caller sees.
   *
   * @type {number}
   * @readonly
   */
  readonly taskCount: number;

  /**
   * Property tasks
   *
   * @description
   * The first six tasks of the part, in key order.
   *
   * @type {readonly SprintReportTask[]}
   * @readonly
   */
  readonly tasks: readonly SprintReportTask[];
  // #endregion
}

/**
 * Interface SprintBurndownDay
 *
 * @description
 * One day of the burndown; a null value is unknown (no history, or a day still to come).
 */
export interface SprintBurndownDay {
  // #region Properties
  /**
   * Property date
   *
   * @description
   * Calendar day, `YYYY-MM-DD`.
   *
   * @type {string}
   * @readonly
   */
  readonly date: string;

  /**
   * Property actual
   *
   * @description
   * Points remaining at the end of the day, or null.
   *
   * @type {number | null}
   * @readonly
   */
  readonly actual: number | null;

  /**
   * Property ideal
   *
   * @description
   * Points the ideal line leaves on that day, or null.
   *
   * @type {number | null}
   * @readonly
   */
  readonly ideal: number | null;

  /**
   * Property projected
   *
   * @description
   * Points the current pace leaves on that day, or null.
   *
   * @type {number | null}
   * @readonly
   */
  readonly projected: number | null;
  // #endregion
}

/**
 * Interface SprintVelocity
 *
 * @description
 * An earlier, completed sprint of the same space: its commitment and what it delivered.
 */
export interface SprintVelocity {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * The sprint.
   *
   * @type {string}
   * @readonly
   */
  readonly listId: string;

  /**
   * Property name
   *
   * @description
   * Sprint name (`Sprint 13`).
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property committed
   *
   * @description
   * Points committed at its opening, or null without history.
   *
   * @type {number | null}
   * @readonly
   */
  readonly committed: number | null;

  /**
   * Property delivered
   *
   * @description
   * Points delivered at its close, or null without history.
   *
   * @type {number | null}
   * @readonly
   */
  readonly delivered: number | null;
  // #endregion
}

/**
 * Interface SprintReport
 *
 * @description
 * The points, burndown and velocity of a sprint, observed on the caller's day.
 */
export interface SprintReport {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * The sprint.
   *
   * @type {string}
   * @readonly
   */
  readonly listId: string;

  /**
   * Property name
   *
   * @description
   * Sprint name (`Sprint 14`).
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property startDate
   *
   * @description
   * First day, `YYYY-MM-DD`.
   *
   * @type {string}
   * @readonly
   */
  readonly startDate: string;

  /**
   * Property endDate
   *
   * @description
   * Last day, `YYYY-MM-DD`.
   *
   * @type {string}
   * @readonly
   */
  readonly endDate: string;

  /**
   * Property committed
   *
   * @description
   * Points committed at the sprint's opening, or null when the opening cannot be rebuilt.
   *
   * @type {number | null}
   * @readonly
   */
  readonly committed: number | null;

  /**
   * Property delivered
   *
   * @description
   * The done part of the scope, or null when it is unknown.
   *
   * @type {SprintReportBreakdown | null}
   * @readonly
   */
  readonly delivered: SprintReportBreakdown | null;

  /**
   * Property remaining
   *
   * @description
   * The open part of the scope, or null when it is unknown.
   *
   * @type {SprintReportBreakdown | null}
   * @readonly
   */
  readonly remaining: SprintReportBreakdown | null;

  /**
   * Property projected
   *
   * @description
   * Points the current pace leaves at the sprint's end, or null until a pace is known.
   *
   * @type {number | null}
   * @readonly
   */
  readonly projected: number | null;

  /**
   * Property days
   *
   * @description
   * Every day of the sprint, oldest first.
   *
   * @type {readonly SprintBurndownDay[]}
   * @readonly
   */
  readonly days: readonly SprintBurndownDay[];

  /**
   * Property velocity
   *
   * @description
   * Up to four earlier sprints of the space, oldest first.
   *
   * @type {readonly SprintVelocity[]}
   * @readonly
   */
  readonly velocity: readonly SprintVelocity[];
  // #endregion
}
