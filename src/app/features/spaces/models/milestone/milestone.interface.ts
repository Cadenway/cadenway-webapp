import type { StatusKey } from '../list-view-config/list-view-config.interface';

/**
 * Interface Milestone
 *
 * @description
 * A milestone of a space, as its overview lists it.
 */
export interface Milestone {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Task key (« CAD-490 »).
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
   * Property status
   *
   * @description
   * Task status.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property listId
   *
   * @description
   * List holding the milestone.
   *
   * @type {string}
   * @readonly
   */
  readonly listId: string;

  /**
   * Property dueDate
   *
   * @description
   * Due date, `YYYY-MM-DD`, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly dueDate: string | null;
  // #endregion
}

/**
 * Interface MilestonePage
 *
 * @description
 * The first milestones of a space, by due date, and how many match in all.
 */
export interface MilestonePage {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * Milestones, the soonest first, undated last.
   *
   * @type {readonly Milestone[]}
   * @readonly
   */
  readonly items: readonly Milestone[];

  /**
   * Property total
   *
   * @description
   * Every visible milestone of the space.
   *
   * @type {number}
   * @readonly
   */
  readonly total: number;
  // #endregion
}
