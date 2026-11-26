/**
 * Interface TaskTimeEntry
 *
 * @description
 * Time someone recorded on a task (`Saisies`).
 */
export interface TaskTimeEntry {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the entry.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property authorId
   *
   * @description
   * Account that recorded it; only that author may delete it.
   *
   * @type {string}
   * @readonly
   */
  readonly authorId: string;

  /**
   * Property minutes
   *
   * @description
   * Whole minutes recorded, 1 to 1,440.
   *
   * @type {number}
   * @readonly
   */
  readonly minutes: number;

  /**
   * Property workDate
   *
   * @description
   * Day the work was done (`YYYY-MM-DD`).
   *
   * @type {string}
   * @readonly
   */
  readonly workDate: string;

  /**
   * Property note
   *
   * @description
   * The note, or an empty string.
   *
   * @type {string}
   * @readonly
   */
  readonly note: string;

  /**
   * Property createdAt
   *
   * @description
   * When it was recorded (ISO instant).
   *
   * @type {string}
   * @readonly
   */
  readonly createdAt: string;
  // #endregion
}

/**
 * Interface TaskTimeLog
 *
 * @description
 * The time entries of a task, newest first, with the totals of all of them.
 */
export interface TaskTimeLog {
  // #region Properties
  /**
   * Property entries
   *
   * @description
   * The entries, newest first.
   *
   * @type {readonly TaskTimeEntry[]}
   * @readonly
   */
  readonly entries: readonly TaskTimeEntry[];

  /**
   * Property totalMinutes
   *
   * @description
   * Minutes recorded on the task (subtasks counted apart).
   *
   * @type {number}
   * @readonly
   */
  readonly totalMinutes: number;
  // #endregion
}

/**
 * Interface TaskTimeDraft
 *
 * @description
 * Time about to be recorded: a shortcut, the typed duration, or a stopped timer.
 */
export interface TaskTimeDraft {
  // #region Properties
  /**
   * Property minutes
   *
   * @description
   * Whole minutes, at least 1.
   *
   * @type {number}
   * @readonly
   */
  readonly minutes: number;

  /**
   * Property note
   *
   * @description
   * Optional note, trimmed.
   *
   * @type {string}
   * @readonly
   */
  readonly note: string;
  // #endregion
}
