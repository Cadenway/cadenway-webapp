import type { StatusCategory, StatusKey } from '@cadenway/contracts';

/**
 * Interface StatusOption
 *
 * @description
 * One status of a space as the pickers offer it: the space's name for it (or the default word),
 * its category, whether the space hides it, and whether a milestone can take it. The order of a
 * list of options is the workflow order of `STATUS_KEYS`.
 */
export interface StatusOption {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Status key.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly key: StatusKey;

  /**
   * Property label
   *
   * @description
   * Name the space gives the status, or the default word when it does not rename it.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property category
   *
   * @description
   * Category of the status: menus group their options under it.
   *
   * @type {StatusCategory}
   * @readonly
   */
  readonly category: StatusCategory;

  /**
   * Property hidden
   *
   * @description
   * Whether the space no longer uses the status; a task that already has it keeps it.
   *
   * @type {boolean}
   * @readonly
   */
  readonly hidden: boolean;

  /**
   * Property milestone
   *
   * @description
   * Whether a milestone can take the status (`MILESTONE_STATUS_KEYS`).
   *
   * @type {boolean}
   * @readonly
   */
  readonly milestone: boolean;
  // #endregion
}
