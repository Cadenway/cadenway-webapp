/**
 * Type SessionDeviceType
 *
 * @description
 * The kind of device a session runs on; `unknown` also stands for a kind a later contract adds.
 *
 * @type {'desktop' | 'mobile' | 'tablet' | 'unknown'}
 */
export type SessionDeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown';

/**
 * Interface AccountSession
 *
 * @description
 * An open session of the account, as the `Active sessions` card lists it. The contract derives
 * no place from the address, so none is shown.
 */
export interface AccountSession {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the session (not its token).
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property current
   *
   * @description
   * Whether it is the session of this browser (`This device`).
   *
   * @type {boolean}
   * @readonly
   */
  readonly current: boolean;

  /**
   * Property deviceType
   *
   * @description
   * The kind of device, for the row's icon.
   *
   * @type {SessionDeviceType}
   * @readonly
   */
  readonly deviceType: SessionDeviceType;

  /**
   * Property device
   *
   * @description
   * The browser and system as one label (`Firefox 132 · Windows 11`), or null when the gateway
   * could not read either.
   *
   * @type {string | null}
   * @readonly
   */
  readonly device: string | null;

  /**
   * Property ipAddress
   *
   * @description
   * The address the session was opened from.
   *
   * @type {string}
   * @readonly
   */
  readonly ipAddress: string;

  /**
   * Property lastActiveAt
   *
   * @description
   * Its last request (ISO 8601), recorded at most once a minute.
   *
   * @type {string}
   * @readonly
   */
  readonly lastActiveAt: string;

  /**
   * Property inactivityTimeoutMinutes
   *
   * @description
   * Minutes of inactivity after which it closes, or null when the gateway does not say.
   *
   * @type {number | null}
   * @readonly
   */
  readonly inactivityTimeoutMinutes: number | null;
  // #endregion
}

/**
 * Type SessionActivity
 *
 * @description
 * When a session was last active, as its row words it: `now` (within 2 minutes, or this
 * browser's session), minutes or hours ago the same day, `yesterday` at a time, days ago up to
 * 30, then a date.
 *
 * @type {{ readonly kind: 'now' } | { readonly kind: 'minutes' | 'hours' | 'days'; readonly count: number } | { readonly kind: 'yesterday' | 'date'; readonly at: Date }}
 */
export type SessionActivity =
  | { readonly kind: 'now' }
  | { readonly kind: 'minutes' | 'hours' | 'days'; readonly count: number }
  | { readonly kind: 'yesterday' | 'date'; readonly at: Date };

/**
 * Interface SessionTimeout
 *
 * @description
 * An inactivity timeout in the largest whole unit: days, hours, else minutes.
 */
export interface SessionTimeout {
  // #region Properties
  /**
   * Property unit
   *
   * @description
   * The unit.
   *
   * @type {'minutes' | 'hours' | 'days'}
   * @readonly
   */
  readonly unit: 'minutes' | 'hours' | 'days';

  /**
   * Property count
   *
   * @description
   * How many of it.
   *
   * @type {number}
   * @readonly
   */
  readonly count: number;
  // #endregion
}
