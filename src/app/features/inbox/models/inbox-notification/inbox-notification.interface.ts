import type { CwStatusKey } from '@cadenway/ui/components/status-icon';

/**
 * Interface InboxNotification
 *
 * @description
 * A notification of the signed-in person, as the inbox popover shows it.
 */
export interface InboxNotification {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Notification identifier.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property kind
   *
   * @description
   * Category (`mention`, `assignment`, `comment`, `status-change`, `approval`, `due-date`,
   * `access`, `billing`, or a later one shown as a generic notification).
   *
   * @type {string}
   * @readonly
   */
  readonly kind: string;

  /**
   * Property actorName
   *
   * @description
   * Name of the person who caused it, or null when no person is visible.
   *
   * @type {string | null}
   * @readonly
   */
  readonly actorName: string | null;

  /**
   * Property actorInitials
   *
   * @description
   * Initials of that person (`IR`), or an empty string.
   *
   * @type {string}
   * @readonly
   */
  readonly actorInitials: string;

  /**
   * Property taskKey
   *
   * @description
   * Key of the task it is about, or null when no task is visible.
   *
   * @type {string | null}
   * @readonly
   */
  readonly taskKey: string | null;

  /**
   * Property taskName
   *
   * @description
   * Name of that task, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly taskName: string | null;

  /**
   * Property excerpt
   *
   * @description
   * Quoted text (a mention, a comment), or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly excerpt: string | null;

  /**
   * Property status
   *
   * @description
   * Status a `status-change` moved the task to, or null.
   *
   * @type {CwStatusKey | null}
   * @readonly
   */
  readonly status: CwStatusKey | null;

  /**
   * Property createdAt
   *
   * @description
   * When it was created, as an ISO 8601 instant.
   *
   * @type {string}
   * @readonly
   */
  readonly createdAt: string;

  /**
   * Property read
   *
   * @description
   * Whether the person read it.
   *
   * @type {boolean}
   * @readonly
   */
  readonly read: boolean;
  // #endregion
}

/**
 * Interface InboxNotificationPage
 *
 * @description
 * The newest notifications and the unread count across all of them.
 */
export interface InboxNotificationPage {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * Notifications, the newest first.
   *
   * @type {readonly InboxNotification[]}
   * @readonly
   */
  readonly items: readonly InboxNotification[];

  /**
   * Property unreadCount
   *
   * @description
   * Unread notifications across every page.
   *
   * @type {number}
   * @readonly
   */
  readonly unreadCount: number;
  // #endregion
}
