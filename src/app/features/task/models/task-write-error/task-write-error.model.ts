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
