/**
 * Type ReauthenticationMethod
 *
 * @description
 * How the person proves who they are again: their `password` (account without two-step
 * verification) or the 6-digit `code` of their authenticator app (account with it).
 *
 * @type {'password' | 'code'}
 */
export type ReauthenticationMethod = 'password' | 'code';

/**
 * Type ReauthenticationAnswer
 *
 * @description
 * What the reauthentication dialog sends: the password or the code, never both.
 *
 * @type {{ readonly password: string } | { readonly code: string }}
 */
export type ReauthenticationAnswer = { readonly password: string } | { readonly code: string };

/**
 * Type ReauthenticationFailure
 *
 * @description
 * Why the last answer was refused: a wrong password, a wrong or used code, a 15-minute lockout,
 * or a gateway that did not answer.
 *
 * @type {'password-incorrect' | 'code-incorrect' | 'locked' | 'unavailable'}
 */
export type ReauthenticationFailure =
  'password-incorrect' | 'code-incorrect' | 'locked' | 'unavailable';

/**
 * Interface ReauthenticationPrompt
 *
 * @description
 * The question the reauthentication dialog shows while an operation waits for a recent
 * authentication.
 */
export interface ReauthenticationPrompt {
  // #region Properties
  /**
   * Property method
   *
   * @description
   * What the dialog asks for.
   *
   * @type {ReauthenticationMethod}
   * @readonly
   */
  readonly method: ReauthenticationMethod;

  /**
   * Property pending
   *
   * @description
   * Whether the answer is being checked.
   *
   * @type {boolean}
   * @readonly
   */
  readonly pending: boolean;

  /**
   * Property failure
   *
   * @description
   * Why the last answer was refused, or null before any refusal.
   *
   * @type {ReauthenticationFailure | null}
   * @readonly
   */
  readonly failure: ReauthenticationFailure | null;

  /**
   * Property remainingAttempts
   *
   * @description
   * Attempts left before the lockout, when the gateway says so.
   *
   * @type {number | null}
   * @readonly
   */
  readonly remainingAttempts: number | null;
  // #endregion
}
