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
 * Interface TrashedTaskView
 *
 * @description
 * Contains the display fields that a caller allowed to restore the task may see.
 */
export interface TrashedTaskView {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * The task the caller opened.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property name
   *
   * @description
   * The name of the deleted task.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property entryId
   *
   * @description
   * The trash entry containing the task.
   *
   * @type {string}
   * @readonly
   */
  readonly entryId: string;

  /**
   * Property trashedAt
   *
   * @description
   * The date and time of deletion.
   *
   * @type {string}
   * @readonly
   */
  readonly trashedAt: string;

  /**
   * Property purgeAt
   *
   * @description
   * The date and time when the entry becomes eligible for purge.
   *
   * @type {string}
   * @readonly
   */
  readonly purgeAt: string;
  // #endregion
}

/**
 * Type TaskRestoreOutcome
 *
 * @description
 * Represents the outcomes the deleted-task page can present.
 *
 * @type {'restored' | 'pending' | 'not-found'}
 */
export type TaskRestoreOutcome = 'restored' | 'pending' | 'not-found';

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

  /**
   * Property trashedTask
   *
   * @description
   * Validated public metadata for the current deleted task, when available.
   *
   * @type {TrashedTaskView | null}
   * @readonly
   */
  public readonly trashedTask: TrashedTaskView | null;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Preserves the display category without retaining the rejected request.
   *
   * @param {TaskDetailFailure} failure - The mapped category.
   * @param {TrashedTaskView | null} [trashedTask] - Validated deleted-task metadata.
   * @constructor
   */
  public constructor(failure: TaskDetailFailure, trashedTask: TrashedTaskView | null = null) {
    super(failure);
    this.failure = failure;
    this.trashedTask = trashedTask;
  }
  // #endregion
}
