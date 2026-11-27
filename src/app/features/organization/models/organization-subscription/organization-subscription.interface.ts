/**
 * Interface OrganizationSubscription
 *
 * @description
 * The current organization's plan and usage, as the shell's plan line, the storage banner and the
 * quotas section show them.
 */
export interface OrganizationSubscription {
  // #region Properties
  /**
   * Property plan
   *
   * @description
   * Plan key (`free`, `team`, `enterprise`, or a later key).
   *
   * @type {string}
   * @readonly
   */
  readonly plan: string;

  /**
   * Property seatsUsed
   *
   * @description
   * Seats occupied by active owners, administrators and members.
   *
   * @type {number}
   * @readonly
   */
  readonly seatsUsed: number;

  /**
   * Property seatsLimit
   *
   * @description
   * Seats the plan includes.
   *
   * @type {number}
   * @readonly
   */
  readonly seatsLimit: number;

  /**
   * Property storageUsedBytes
   *
   * @description
   * Bytes of ready attachments.
   *
   * @type {number}
   * @readonly
   */
  readonly storageUsedBytes: number;

  /**
   * Property storageLimitBytes
   *
   * @description
   * Storage quota, in bytes.
   *
   * @type {number}
   * @readonly
   */
  readonly storageLimitBytes: number;

  /**
   * Property guestCount
   *
   * @description
   * Active guests, who take no seat; the contract states no guest limit. Optional so that a
   * subscription built without it (a spec fixture) stays valid; the adapter always sets it, and
   * the quotas section leaves the guests row out without it.
   *
   * @type {number | undefined}
   * @readonly
   */
  readonly guestCount?: number;
  // #endregion
}
