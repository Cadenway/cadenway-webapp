import type { CancelReason, StatusKey } from '@cadenway/contracts';

/**
 * Interface TaskStatusChange
 *
 * @description
 * A status change that settled: emitted 460 ms after the last click, when the list should move
 * the task to its new group, and again when a refusal or a conflict puts another status back.
 */
export interface TaskStatusChange {
  // #region Properties
  /**
   * Property taskId
   *
   * @description
   * Id of the task (its key).
   *
   * @type {string}
   * @readonly
   */
  readonly taskId: string;

  /**
   * Property from
   *
   * @description
   * Status the task leaves.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly from: StatusKey;

  /**
   * Property to
   *
   * @description
   * Status the task now shows.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly to: StatusKey;

  /**
   * Property reason
   *
   * @description
   * Why the task was cancelled, when `to` is `cancelled`.
   *
   * @type {CancelReason | null}
   * @readonly
   */
  readonly reason: CancelReason | null;
  // #endregion
}

/**
 * Interface TaskCancellation
 *
 * @description
 * What the cancel reason dialog answers: one of the four reasons and an optional note.
 */
export interface TaskCancellation {
  // #region Properties
  /**
   * Property reason
   *
   * @description
   * The chosen reason.
   *
   * @type {CancelReason}
   * @readonly
   */
  readonly reason: CancelReason;

  /**
   * Property note
   *
   * @description
   * The trimmed « Précision », or an empty string.
   *
   * @type {string}
   * @readonly
   */
  readonly note: string;
  // #endregion
}
