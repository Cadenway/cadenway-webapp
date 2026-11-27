/**
 * Class TaskVersionConflict
 *
 * @description
 * Raised by the task data access when the gateway answers `412` to an `If-Match` write: someone
 * changed the task since its version was read. The caller refetches the task and warns.
 */
export class TaskVersionConflict extends Error {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Names the task whose version no longer matches.
   *
   * @param {string} taskKey - Key of the task.
   * @constructor
   */
  public constructor(taskKey: string) {
    super(`The version of ${taskKey} changed.`);
    this.name = 'TaskVersionConflict';
  }
  // #endregion
}

/**
 * Class TaskWriteCancelled
 *
 * @description
 * Raised by a write lane for a queued write it no longer sends: the page that queued it was left,
 * or the organization it was asked in is no longer the current one. Nothing reached the gateway,
 * so the caller puts its shown value back without a failure toast.
 */
export class TaskWriteCancelled extends Error {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Names the task whose write was dropped.
   *
   * @param {string} taskKey - Key of the task.
   * @constructor
   */
  public constructor(taskKey: string) {
    super(`The queued write of ${taskKey} was not sent.`);
    this.name = 'TaskWriteCancelled';
  }
  // #endregion
}
