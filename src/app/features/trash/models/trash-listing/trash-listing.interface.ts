import type { TrashEntry } from '../trash-entry/trash-entry.interface';

/**
 * Interface TrashListing
 *
 * @description
 * One read of the trash: the most recently deleted entries, up to the read's cap, and how many
 * entries the trash holds in all.
 */
export interface TrashListing {
  // #region Properties
  /**
   * Property entries
   *
   * @description
   * The entries read, the most recently deleted first.
   *
   * @type {readonly TrashEntry[]}
   * @readonly
   */
  readonly entries: readonly TrashEntry[];

  /**
   * Property total
   *
   * @description
   * Entries the caller may restore, including those past the cap; never fewer than `entries`.
   *
   * @type {number}
   * @readonly
   */
  readonly total: number;

  /**
   * Property nextCursor
   *
   * @description
   * Cursor of the next page after the entries read, or null when the read reached the end.
   *
   * @type {string | null}
   * @readonly
   */
  readonly nextCursor: string | null;
  // #endregion
}
