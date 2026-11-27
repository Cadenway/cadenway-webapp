/**
 * Type InboxReadSource
 *
 * @description
 * Where the person read notifications: the rail's popover or the home screen's digest.
 *
 * @type {'popover' | 'digest'}
 */
export type InboxReadSource = 'popover' | 'digest';

/**
 * Interface InboxRead
 *
 * @description
 * Notifications the gateway recorded as read, published so the other inbox views catch up.
 */
export interface InboxRead {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * Organization the notifications belong to.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property source
   *
   * @description
   * The view that recorded the read.
   *
   * @type {InboxReadSource}
   * @readonly
   */
  readonly source: InboxReadSource;

  /**
   * Property ids
   *
   * @description
   * Notifications marked read; with `all`, the listed ones the view showed unread.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly ids: readonly string[];

  /**
   * Property all
   *
   * @description
   * Whether it was `Mark all as read`, which also covers notifications off every list.
   *
   * @type {boolean}
   * @readonly
   */
  readonly all: boolean;
  // #endregion
}
