/**
 * Type TaskDetailFailure
 *
 * @description
 * Display states for a rejected task operation without upstream problem details.
 *
 * @type {'not-found' | 'trashed' | 'forbidden' | 'session-expired' | 'organization-changed' | 'stale' | 'unavailable'}
 */
export type TaskDetailFailure =
  | 'not-found'
  | 'trashed'
  | 'forbidden'
  | 'session-expired'
  | 'organization-changed'
  | 'stale'
  | 'unavailable';

/**
 * Class TaskDetailRequestError
 *
 * @description
 * Carries only the display category for a rejected task operation through the resource.
 */
export class TaskDetailRequestError extends Error {
  // #region Properties
  /**
   * Property failure
   *
   * @description
   * Stable category that the current screen can render without revealing provider data.
   *
   * @type {TaskDetailFailure}
   * @readonly
   */
  public readonly failure: TaskDetailFailure;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Preserves the display category without retaining the rejected request.
   *
   * @param {TaskDetailFailure} failure - The mapped category.
   * @constructor
   */
  public constructor(failure: TaskDetailFailure) {
    super(failure);
    this.failure = failure;
  }
  // #endregion
}
