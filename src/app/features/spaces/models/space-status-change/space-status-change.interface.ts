import type { StatusKey } from '../list-view-config/list-view-config.interface';

/**
 * Interface SpaceStatusChange
 *
 * @description
 * A change of one status of a space (`Space statuses`): a member left out stays as it is.
 */
export interface SpaceStatusChange {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * The new name, trimmed, 1 to 24 characters, or null for the default label.
   *
   * @type {string | null | undefined}
   * @readonly
   */
  readonly name?: string | null;

  /**
   * Property hidden
   *
   * @description
   * Whether the space stops using the status; `todo` and `done` are always used.
   *
   * @type {boolean | undefined}
   * @readonly
   */
  readonly hidden?: boolean;
  // #endregion
}

/**
 * Type SpaceStatusesChange
 *
 * @description
 * A change of the statuses of a space by key, or null to put back every default
 * (`Reset to defaults`).
 *
 * @type {Readonly<Partial<Record<StatusKey, SpaceStatusChange>>> | null}
 */
export type SpaceStatusesChange = Readonly<Partial<Record<StatusKey, SpaceStatusChange>>> | null;
