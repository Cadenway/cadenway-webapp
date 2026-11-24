/**
 * Interface AuthProblem
 *
 * @description
 * The part of a gateway refusal the auth screens may show: never the gateway's own title or
 * detail, which are not translated and may name internal causes.
 */
export interface AuthProblem {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * HTTP status, or zero for a network failure or an unexpected answer.
   *
   * @type {number}
   * @readonly
   */
  readonly status: number;

  /**
   * Property code
   *
   * @description
   * Stable problem code (`auth.invalid-credentials`, `organization.slug-taken`...), or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly code: string | null;

  /**
   * Property remainingAttempts
   *
   * @description
   * Failures left before a lockout, when the gateway gives a positive whole number.
   *
   * @type {number | null}
   * @readonly
   */
  readonly remainingAttempts: number | null;
  // #endregion
}
