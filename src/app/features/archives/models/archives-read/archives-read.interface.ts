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
  // #endregion
}
