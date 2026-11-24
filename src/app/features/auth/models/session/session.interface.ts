/**
 * Type TwoStepMethod
 *
 * @description
 * A way to answer a two-step challenge, in the order of the mockup's tabs (`Mfa.dc.html`).
 *
 * @type {'authenticator-app' | 'security-key' | 'backup-code'}
 */
export type TwoStepMethod = 'authenticator-app' | 'security-key' | 'backup-code';

/**
 * Interface SignedInAccount
 *
 * @description
 * The account a newly opened session belongs to, as the auth screens show and remember it.
 */
export interface SignedInAccount {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Full name of the account.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property email
   *
   * @description
   * Verified address of the account.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;
  // #endregion
}

/**
 * Interface TwoStepChallenge
 *
 * @description
 * What the two-step screen shows of a pending challenge. Its token stays in the flow store and
 * the session storage of the tab, never in this model.
 */
export interface TwoStepChallenge {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * Address of the account being signed in.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property name
   *
   * @description
   * Name of the account being signed in.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property methods
   *
   * @description
   * Supported methods the account can answer with, in tab order; unknown methods are dropped.
   *
   * @type {readonly TwoStepMethod[]}
   * @readonly
   */
  readonly methods: readonly TwoStepMethod[];

  /**
   * Property securityKeys
   *
   * @description
   * Names of the registered security keys.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly securityKeys: readonly string[];

  /**
   * Property backupCodesRemaining
   *
   * @description
   * Unused backup codes of the account.
   *
   * @type {number}
   * @readonly
   */
  readonly backupCodesRemaining: number;
  // #endregion
}

/**
 * Type SignInOutcome
 *
 * @description
 * An accepted first factor opens a session (only a `200`) or issues a two-step challenge (`202`).
 *
 * @type {{ readonly kind: 'signed-in'; readonly account: SignedInAccount } | { readonly kind: 'challenge'; readonly token: string; readonly challenge: TwoStepChallenge }}
 */
export type SignInOutcome =
  | { readonly kind: 'signed-in'; readonly account: SignedInAccount }
  | { readonly kind: 'challenge'; readonly token: string; readonly challenge: TwoStepChallenge };

/**
 * Type FederatedProvider
 *
 * @description
 * Social providers offered by the sign-in and sign-up screens.
 *
 * @type {'google' | 'github' | 'microsoft' | 'gitlab'}
 */
export type FederatedProvider = 'google' | 'github' | 'microsoft' | 'gitlab';

/**
 * Interface PasswordResetLink
 *
 * @description
 * The account a reset link is for and how many sessions a reset would close.
 */
export interface PasswordResetLink {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * Address of the account of the link.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property sessionCount
   *
   * @description
   * Open sessions of the account.
   *
   * @type {number}
   * @readonly
   */
  readonly sessionCount: number;
  // #endregion
}

/**
 * Interface PasswordResetResult
 *
 * @description
 * Outcome of a completed reset.
 */
export interface PasswordResetResult {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * Address the confirmation email went to.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property closedSessionCount
   *
   * @description
   * Sessions the reset closed; zero when the other sessions stay open.
   *
   * @type {number}
   * @readonly
   */
  readonly closedSessionCount: number;
  // #endregion
}
