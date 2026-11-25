import type { CancelReason, StatusKey } from '@cadenway/contracts';

/**
 * Interface BulkSelection
 *
 * @description
 * A selected task, with the version the rows show so a stale selection is refused.
 */
export interface BulkSelection {
  // #region Properties
  /**
   * Property taskKey
   *
   * @description
   * Task key.
   *
   * @type {string}
   * @readonly
   */
  readonly taskKey: string;

  /**
   * Property version
   *
   * @description
   * Expected task version, or absent to skip the check.
   *
   * @type {number | undefined}
   * @readonly
   */
  readonly version?: number;
  // #endregion
}

/**
 * Type BulkAction
 *
 * @description
 * The actions of the selection bar: `Mark done`, `Assign`, `Move to…` and `Delete` (to the
 * trash).
 *
 * @type {{ readonly type: 'done' } | { readonly type: 'assign'; readonly userId: string } | { readonly type: 'move'; readonly listId: string } | { readonly type: 'trash' }}
 */
export type BulkAction =
  | { readonly type: 'done' }
  | {
      readonly type: 'status';
      readonly status: StatusKey;
      readonly cancelReason?: CancelReason;
      readonly cancelNote?: string | null;
    }
  | { readonly type: 'assign'; readonly userId: string }
  | { readonly type: 'move'; readonly listId: string }
  | { readonly type: 'trash' };

/**
 * Constant BULK_CHUNK_SIZE
 *
 * @description
 * Tasks one `executeBulkTaskAction` call takes at most; a larger selection is sent in several
 * calls, each one atomic.
 *
 * @type {number}
 */
export const BULK_CHUNK_SIZE: number = 50;

/**
 * Interface BulkOutcome
 *
 * @description
 * What a bulk action changed: each chunk of the selection succeeds or fails as a whole, so a
 * selection over 50 tasks may change in part.
 */
export interface BulkOutcome {
  // #region Properties
  /**
   * Property affected
   *
   * @description
   * Task rows the succeeded chunks changed, subtrees included.
   *
   * @type {number}
   * @readonly
   */
  readonly affected: number;

  /**
   * Property done
   *
   * @description
   * Selected tasks of the succeeded chunks.
   *
   * @type {readonly BulkSelection[]}
   * @readonly
   */
  readonly done: readonly BulkSelection[];

  /**
   * Property failed
   *
   * @description
   * Selected tasks of the refused chunks, unchanged.
   *
   * @type {readonly BulkSelection[]}
   * @readonly
   */
  readonly failed: readonly BulkSelection[];

  /**
   * Property unknown
   *
   * @description
   * Tasks whose chunk may have been applied but whose response was lost.
   *
   * @type {readonly BulkSelection[]}
   * @readonly
   */
  readonly unknown: readonly BulkSelection[];

  /**
   * Property notSent
   *
   * @description
   * Tasks not sent after an unresolved chunk, a workspace change or store destruction.
   *
   * @type {readonly BulkSelection[]}
   * @readonly
   */
  readonly notSent: readonly BulkSelection[];
  // #endregion
}
