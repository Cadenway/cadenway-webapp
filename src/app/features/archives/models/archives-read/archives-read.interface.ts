import type { ArchivedListItem } from '../archived-list/archived-list.interface';
import type { ArchivedTaskItem } from '../archived-task/archived-task.interface';

/**
 * Interface ArchivesRead
 *
 * @description
 * Both tabs of the archives, each read to its last page, with the totals the gateway counted.
 */
export interface ArchivesRead {
  // #region Properties
  /**
   * Property lists
   *
   * @description
   * The archived lists, the most recently archived first.
   *
   * @type {readonly ArchivedListItem[]}
   * @readonly
   */
  readonly lists: readonly ArchivedListItem[];

  /**
   * Property listTotal
   *
   * @description
   * The archived lists the gateway counted.
   *
   * @type {number}
   * @readonly
   */
  readonly listTotal: number;

  /**
   * Property listCursor
   *
   * @description
   * Cursor of the next page of archived lists after those read, or null when every one was read.
   *
   * @type {string | null}
   * @readonly
   */
  readonly listCursor: string | null;

  /**
   * Property tasks
   *
   * @description
   * The roots of the archived subtrees, the most recently archived first.
   *
   * @type {readonly ArchivedTaskItem[]}
   * @readonly
   */
  readonly tasks: readonly ArchivedTaskItem[];

  /**
   * Property taskTotal
   *
   * @description
   * The archived roots the gateway counted.
   *
   * @type {number}
   * @readonly
   */
  readonly taskTotal: number;

  /**
   * Property taskCursor
   *
   * @description
   * Cursor of the next page of archived roots after those read, or null when every one was read.
   *
   * @type {string | null}
   * @readonly
   */
  readonly taskCursor: string | null;
  // #endregion
}

/**
 * Type ArchivesTab
 *
 * @description
 * The two tabs of the archives.
 *
 * @type {'lists' | 'tasks'}
 */
export type ArchivesTab = 'lists' | 'tasks';

/**
 * Interface ArchivesDepth
 *
 * @description
 * Pages read per tab: a background read refreshes each tab down to the depth already shown.
 */
export interface ArchivesDepth {
  // #region Properties
  /**
   * Property lists
   *
   * @description
   * Pages of archived lists to read.
   *
   * @type {number}
   * @readonly
   */
  readonly lists: number;

  /**
   * Property tasks
   *
   * @description
   * Pages of archived roots to read.
   *
   * @type {number}
   * @readonly
   */
  readonly tasks: number;
  // #endregion
}

/**
 * Interface ArchivesMore
 *
 * @description
 * The next pages of one tab, read from its cursor by `Show more`.
 */
export interface ArchivesMore<T> {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The items of those pages, in order.
   *
   * @type {readonly T[]}
   * @readonly
   */
  readonly items: readonly T[];

  /**
   * Property total
   *
   * @description
   * The total the gateway counted on the last page read.
   *
   * @type {number}
   * @readonly
   */
  readonly total: number;

  /**
   * Property cursor
   *
   * @description
   * Cursor of the page after them, or null at the end.
   *
   * @type {string | null}
   * @readonly
   */
  readonly cursor: string | null;
  // #endregion
}
