import type { StatusKey } from '@cadenway/contracts';

/**
 * Type TaskApprovalDecision
 *
 * @description
 * The vote of a reviewer: approved, changes requested, or none yet (an unknown decision reads as
 * none, as the contract allows).
 *
 * @type {'approved' | 'changes-requested' | null}
 */
export type TaskApprovalDecision = 'approved' | 'changes-requested' | null;

/**
 * Interface TaskApprover
 *
 * @description
 * A reviewer of the current approval round of a task.
 */
export interface TaskApprover {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * Account of the reviewer.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property decision
   *
   * @description
   * The reviewer's vote, null while waiting.
   *
   * @type {TaskApprovalDecision}
   * @readonly
   */
  readonly decision: TaskApprovalDecision;
  // #endregion
}

/**
 * Interface TaskApproval
 *
 * @description
 * The current approval round of a task (`Approbation` row), or the absence of one.
 */
export interface TaskApproval {
  // #region Properties
  /**
   * Property reviewers
   *
   * @description
   * Eligible reviewers of the current round in request order; empty without a round.
   *
   * @type {readonly TaskApprover[]}
   * @readonly
   */
  readonly reviewers: readonly TaskApprover[];

  /**
   * Property taskVersion
   *
   * @description
   * Task version the approval state was read at (the next `If-Match`).
   *
   * @type {number}
   * @readonly
   */
  readonly taskVersion: number;
  // #endregion
}

/**
 * Type TaskDependencyDirection
 *
 * @description
 * How the open task relates to the other task: blocked by it, or blocking it.
 *
 * @type {'blocked-by' | 'blocks'}
 */
export type TaskDependencyDirection = 'blocked-by' | 'blocks';

/**
 * Interface TaskDependencyTask
 *
 * @description
 * The other end of a dependency, as its chip and the date warning need it.
 */
export interface TaskDependencyTask {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Key of the task.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

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
   * Property milestone
   *
   * @description
   * Whether the task is a milestone (its icon is a diamond).
   *
   * @type {boolean}
   * @readonly
   */
  readonly milestone: boolean;

  /**
   * Property due
   *
   * @description
   * Due date (`YYYY-MM-DD`), or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly due: string | null;
  // #endregion
}

/**
 * Interface TaskDependency
 *
 * @description
 * An edge between the open task and another one, seen from the open task.
 */
export interface TaskDependency {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the edge.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property direction
   *
   * @description
   * `blocked-by` when the other task blocks the open one, `blocks` otherwise.
   *
   * @type {TaskDependencyDirection}
   * @readonly
   */
  readonly direction: TaskDependencyDirection;

  /**
   * Property task
   *
   * @description
   * The other task.
   *
   * @type {TaskDependencyTask}
   * @readonly
   */
  readonly task: TaskDependencyTask;
  // #endregion
}

/**
 * Interface TaskStatusTime
 *
 * @description
 * Time a task spent in one status (`Temps par statut`), repeated visits summed.
 */
export interface TaskStatusTime {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * The status.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property milliseconds
   *
   * @description
   * Elapsed time in the status, in milliseconds.
   *
   * @type {number}
   * @readonly
   */
  readonly milliseconds: number;

  /**
   * Property active
   *
   * @description
   * Whether this is the current status and it still accumulates (open or active category).
   *
   * @type {boolean}
   * @readonly
   */
  readonly active: boolean;
  // #endregion
}

/**
 * Interface TaskStatusTimes
 *
 * @description
 * Time per status of a task, in order of first appearance.
 */
export interface TaskStatusTimes {
  // #region Properties
  /**
   * Property complete
   *
   * @description
   * Whether the history covers the task since its creation.
   *
   * @type {boolean}
   * @readonly
   */
  readonly complete: boolean;

  /**
   * Property durations
   *
   * @description
   * One entry per status visited.
   *
   * @type {readonly TaskStatusTime[]}
   * @readonly
   */
  readonly durations: readonly TaskStatusTime[];
  // #endregion
}
