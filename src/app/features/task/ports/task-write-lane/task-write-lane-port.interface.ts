import type { TaskSummary } from '../../models/task-summary/task-summary.interface';

/**
 * Interface TaskWriteLane
 *
 * @description
 * The one write path of the tasks of a screen that already writes them (the task detail): the
 * status changes send through it, so a status write never overlaps another write of the same task
 * and goes against that task's newest confirmed version, not the one captured at click time.
 */
export interface TaskWriteLane {
  // #region Methods
  /**
   * Method write
   *
   * @description
   * Runs a write of a task after its earlier writes, with its newest confirmed version (or
   * `fallback` when none is known); a `TaskVersionConflict` makes the next write wait for a read.
   *
   * @param {string} key - Key of the task.
   * @param {(version: number) => Promise<T>} send - Sends the write against a version.
   * @param {number} [fallback] - Version to use when the lane knows none.
   * @returns {Promise<T>} What `send` resolved with.
   */
  write<T>(key: string, send: (version: number) => Promise<T>, fallback?: number): Promise<T>;

  /**
   * Method acceptVersion
   *
   * @description
   * Takes the version a write returned with the fields it set; a version that does not follow
   * the confirmed one reads the task again instead.
   *
   * @param {number} version - The new version.
   * @param {Partial<TaskSummary>} [changes] - Fields the write set.
   * @param {string} [key] - Key of the task.
   */
  acceptVersion(version: number, changes?: Partial<TaskSummary>, key?: string): void;
  // #endregion
}
