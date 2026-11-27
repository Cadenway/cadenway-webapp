/**
 * Type NotificationEvent
 *
 * @description
 * An event of the notification matrix (mockup `Compte.dc.html` lines 1476-1482), named as the
 * contract's `channels` keys.
 *
 * @type {'mention' | 'assignment' | 'comment' | 'statusChange' | 'dueDate' | 'access' | 'billing'}
 */
export type NotificationEvent =
  'mention' | 'assignment' | 'comment' | 'statusChange' | 'dueDate' | 'access' | 'billing';

/**
 * Type NotificationChannel
 *
 * @description
 * A channel of the notification matrix: in the app, by email or on mobile.
 *
 * @type {'inApp' | 'email' | 'mobile'}
 */
export type NotificationChannel = 'inApp' | 'email' | 'mobile';

/**
 * Type NotificationDigest
 *
 * @description
 * Email cadence of the events with email enabled: each one, a daily or a weekly summary, or never.
 *
 * @type {'each' | 'daily' | 'weekly' | 'never'}
 */
export type NotificationDigest = 'each' | 'daily' | 'weekly' | 'never';

/**
 * Type NotificationChannels
 *
 * @description
 * Whether each channel signals an event.
 *
 * @type {Readonly<Record<NotificationChannel, boolean>>}
 */
export type NotificationChannels = Readonly<Record<NotificationChannel, boolean>>;

/**
 * Type NotificationMatrix
 *
 * @description
 * The channels of every event.
 *
 * @type {Readonly<Record<NotificationEvent, NotificationChannels>>}
 */
export type NotificationMatrix = Readonly<Record<NotificationEvent, NotificationChannels>>;

/**
 * Interface NotificationPreferences
 *
 * @description
 * The person's notification preferences, shared by all their organizations.
 */
export interface NotificationPreferences {
  // #region Properties
  /**
   * Property channels
   *
   * @description
   * The channels of every event.
   *
   * @type {NotificationMatrix}
   * @readonly
   */
  readonly channels: NotificationMatrix;

  /**
   * Property digest
   *
   * @description
   * Email cadence.
   *
   * @type {NotificationDigest}
   * @readonly
   */
  readonly digest: NotificationDigest;

  /**
   * Property doNotDisturb
   *
   * @description
   * Whether quiet hours hold mobile notifications back (urgent mentions still go through).
   *
   * @type {boolean}
   * @readonly
   */
  readonly doNotDisturb: boolean;

  /**
   * Property version
   *
   * @description
   * Version the next change is made from (`If-Match`).
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}

/**
 * Interface NotificationChannelChange
 *
 * @description
 * One box of the matrix ticked or cleared.
 */
export interface NotificationChannelChange {
  // #region Properties
  /**
   * Property kind
   *
   * @description
   * Discriminant of the change.
   *
   * @type {'channel'}
   * @readonly
   */
  readonly kind: 'channel';

  /**
   * Property event
   *
   * @description
   * The event of the row.
   *
   * @type {NotificationEvent}
   * @readonly
   */
  readonly event: NotificationEvent;

  /**
   * Property channel
   *
   * @description
   * The channel of the column.
   *
   * @type {NotificationChannel}
   * @readonly
   */
  readonly channel: NotificationChannel;

  /**
   * Property enabled
   *
   * @description
   * Whether the channel now signals the event.
   *
   * @type {boolean}
   * @readonly
   */
  readonly enabled: boolean;
  // #endregion
}

/**
 * Interface NotificationDigestChange
 *
 * @description
 * Another email cadence chosen.
 */
export interface NotificationDigestChange {
  // #region Properties
  /**
   * Property kind
   *
   * @description
   * Discriminant of the change.
   *
   * @type {'digest'}
   * @readonly
   */
  readonly kind: 'digest';

  /**
   * Property digest
   *
   * @description
   * The chosen cadence.
   *
   * @type {NotificationDigest}
   * @readonly
   */
  readonly digest: NotificationDigest;
  // #endregion
}

/**
 * Interface DoNotDisturbChange
 *
 * @description
 * The quiet hours switched on or off.
 */
export interface DoNotDisturbChange {
  // #region Properties
  /**
   * Property kind
   *
   * @description
   * Discriminant of the change.
   *
   * @type {'doNotDisturb'}
   * @readonly
   */
  readonly kind: 'doNotDisturb';

  /**
   * Property enabled
   *
   * @description
   * Whether quiet hours now apply.
   *
   * @type {boolean}
   * @readonly
   */
  readonly enabled: boolean;
  // #endregion
}

/**
 * Type NotificationPreferenceChange
 *
 * @description
 * One setting changed on the page, saved at once.
 *
 * @type {NotificationChannelChange | NotificationDigestChange | DoNotDisturbChange}
 */
export type NotificationPreferenceChange =
  NotificationChannelChange | NotificationDigestChange | DoNotDisturbChange;
