import type { LookColor, LookIcon } from '../look/look.type';

/**
 * Interface ListSprint
 *
 * @description
 * The dates and goal of a sprint, as plain ISO dates.
 */
export interface ListSprint {
  // #region Properties
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
   * Property goal
   *
   * @description
   * Sprint goal (« Livrer la connexion SSO… »), or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly goal: string | null;
  // #endregion
}

/**
 * Interface TaskList
 *
 * @description
 * A list or a sprint the caller sees.
 */
export interface TaskList {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * List identifier.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property spaceId
   *
   * @description
   * Space holding the list.
   *
   * @type {string}
   * @readonly
   */
  readonly spaceId: string;

  /**
   * Property name
   *
   * @description
   * List name (« Sprint 14 »).
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property icon
   *
   * @description
   * Icon key, or null for the default (bullets, or the lightning of a sprint).
   *
   * @type {LookIcon}
   * @readonly
   */
  readonly icon: LookIcon;

  /**
   * Property color
   *
   * @description
   * Hue of the icon.
   *
   * @type {LookColor}
   * @readonly
   */
  readonly color: LookColor;

  /**
   * Property sprint
   *
   * @description
   * Sprint dates and goal, or null for a plain list.
   *
   * @type {ListSprint | null}
   * @readonly
   */
  readonly sprint: ListSprint | null;

  /**
   * Property archived
   *
   * @description
   * Whether the list is in the archives.
   *
   * @type {boolean}
   * @readonly
   */
  readonly archived: boolean;

  /**
   * Property canEdit
   *
   * @description
   * Whether the caller's role on the list allows changing it (`edit`), when the gateway said so;
   * true when it did not.
   *
   * @type {boolean}
   * @readonly
   */
  readonly canEdit: boolean;

  /**
   * Property version
   *
   * @description
   * Version sent with `If-Match`.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}

/**
 * Interface ListCounts
 *
 * @description
 * Counts of the top-level tasks of a list, subtasks left out.
 */
export interface ListCounts {
  // #region Properties
  /**
   * Property total
   *
   * @description
   * Every top-level task.
   *
   * @type {number}
   * @readonly
   */
  readonly total: number;

  /**
   * Property open
   *
   * @description
   * Tasks neither done nor cancelled (« 14 ouvertes »).
   *
   * @type {number}
   * @readonly
   */
  readonly open: number;

  /**
   * Property done
   *
   * @description
   * Done tasks.
   *
   * @type {number}
   * @readonly
   */
  readonly done: number;

  /**
   * Property cancelled
   *
   * @description
   * Cancelled tasks, left out of the done percentage.
   *
   * @type {number}
   * @readonly
   */
  readonly cancelled: number;

  /**
   * Property late
   *
   * @description
   * Open tasks whose due date is before the caller's today (« 3 en retard »).
   *
   * @type {number}
   * @readonly
   */
  readonly late: number;
  // #endregion
}

/**
 * Interface ListSummary
 *
 * @description
 * A list with its counts.
 */
export interface ListSummary {
  // #region Properties
  /**
   * Property list
   *
   * @description
   * The list.
   *
   * @type {TaskList}
   * @readonly
   */
  readonly list: TaskList;

  /**
   * Property counts
   *
   * @description
   * Its counts.
   *
   * @type {ListCounts}
   * @readonly
   */
  readonly counts: ListCounts;
  // #endregion
}

/**
 * Interface SpaceOverview
 *
 * @description
 * The lists of a space with their counts, in sidebar order.
 */
export interface SpaceOverview {
  // #region Properties
  /**
   * Property spaceId
   *
   * @description
   * The space.
   *
   * @type {string}
   * @readonly
   */
  readonly spaceId: string;

  /**
   * Property taskCount
   *
   * @description
   * Top-level tasks of the whole space.
   *
   * @type {number}
   * @readonly
   */
  readonly taskCount: number;

  /**
   * Property lists
   *
   * @description
   * The lists the caller sees, every page read.
   *
   * @type {readonly ListSummary[]}
   * @readonly
   */
  readonly lists: readonly ListSummary[];
  // #endregion
}
