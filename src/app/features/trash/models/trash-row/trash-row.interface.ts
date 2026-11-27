import type { TrashEntry } from '../trash-entry/trash-entry.interface';

/**
 * Type TrashWrite
 *
 * @description
 * The write in flight on one entry: its restore or its purge.
 *
 * @type {'restore' | 'purge'}
 */
export type TrashWrite = 'restore' | 'purge';

/**
 * Interface TrashRow
 *
 * @description
 * An entry as the trash page shows it: the entry, who deleted it and the write in flight on it.
 */
export interface TrashRow {
  // #region Properties
  /**
   * Property entry
   *
   * @description
   * The trash entry.
   *
   * @type {TrashEntry}
   * @readonly
   */
  readonly entry: TrashEntry;

  /**
   * Property deletedBy
   *
   * @description
   * Name of who deleted it (a member, `Former member` or `An automation`), or null while the
   * member directory is unread or unreadable, and for another kind of actor: the row then leaves
   * out `by <name>`.
   *
   * @type {string | null}
   * @readonly
   */
  readonly deletedBy: string | null;

  /**
   * Property pending
   *
   * @description
   * The write in flight on the entry, or null.
   *
   * @type {TrashWrite | null}
   * @readonly
   */
  readonly pending: TrashWrite | null;
  // #endregion
}
