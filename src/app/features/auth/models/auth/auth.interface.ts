/**
 * Interface SignInCredentials
 *
 * @description
 * Values typed into password sign-in. The gateway holds the session in its cookie.
 */
export interface SignInCredentials {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * Account address typed in the form.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property password
   *
   * @description
   * Password submitted to the gateway, kept only in memory.
   *
   * @type {string}
   * @readonly
   */
  readonly password: string;

  /**
   * Property rememberMe
   *
   * @description
   * Whether the caller requested the persistent session cookie.
   *
   * @type {boolean}
   * @readonly
   */
  readonly rememberMe: boolean;
  // #endregion
}

/**
 * Interface SignInChallenge
 *
 * @description
 * In-memory second step of a sign-in.
 */
export interface SignInChallenge {
  // #region Properties
  /**
   * Property token
   *
   * @description
   * Opaque challenge secret sent only in an answer body.
   *
   * @type {string}
   * @readonly
   */
  readonly token: string;

  /**
   * Property email
   *
   * @description
   * Address of the account entering the authenticator step.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;
  // #endregion
}

/**
 * Interface OrganizationEntry
 *
 * @description
 * Organization identity and display fields shown on the entry screens.
 */
export interface OrganizationEntry {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Gateway organization identifier used to switch the session.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Organization name shown to the caller.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property role
   *
   * @description
   * Role label translated for display.
   *
   * @type {string}
   * @readonly
   */
  readonly role: string;
  // #endregion
}

/**
 * Interface OrganizationChoices
 *
 * @description
 * One page of options from the gateway.
 */
export interface OrganizationChoices {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * Address confirmed by the current account operation.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property items
   *
   * @description
   * Organizations available on the current page.
   *
   * @type {readonly OrganizationEntry[]}
   * @readonly
   */
  readonly items: readonly OrganizationEntry[];

  /**
   * Property nextCursor
   *
   * @description
   * Cursor for the next page, or null on the last page.
   *
   * @type {string | null}
   * @readonly
   */
  readonly nextCursor: string | null;
  // #endregion
}

/**
 * Interface AuthProblem
 *
 * @description
 * Stable failure information that can safely reach the entry screens.
 */
export interface AuthProblem {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * HTTP status, or zero for a local or transport error.
   *
   * @type {number}
   * @readonly
   */
  readonly status: number;

  /**
   * Property code
   *
   * @description
   * Stable gateway failure code, or unavailable.
   *
   * @type {string}
   * @readonly
   */
  readonly code: string;

  /**
   * Property remainingAttempts
   *
   * @description
   * Number of password attempts left when the gateway supplied it.
   *
   * @type {number}
   * @readonly
   */
  readonly remainingAttempts?: number;
  // #endregion
}
