import {
  type ApiProblem,
  hasProblemCode,
  OrganizationSwitchPendingError,
  readProblem,
} from '@core/api';

/**
 * Class OrganizationChangedError
 *
 * @description
 * The workspace shows another organization than the one where a write started, so the write is
 * not sent: a write belongs to the organization where it starts.
 */
export class OrganizationChangedError extends Error {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Names the error.
   *
   * @constructor
   */
  public constructor() {
    super('The organization changed before the request was sent.');
    this.name = 'OrganizationChangedError';
  }
  // #endregion
}

/**
 * Function isContextChange
 *
 * @description
 * Whether a write was refused because its organization is no longer the one shown: changed
 * before the send, a switch in progress, or `412 organization.context-changed`. The workspace
 * recovery takes over; the write ends silently.
 *
 * @param {unknown} error - The failure.
 * @returns {boolean} Whether the organization context changed.
 */
export function isContextChange(error: unknown): boolean {
  return (
    error instanceof OrganizationChangedError ||
    error instanceof OrganizationSwitchPendingError ||
    hasProblemCode(error, 'organization.context-changed')
  );
}

/**
 * Function isUncertain
 *
 * @description
 * Whether a failure leaves the outcome of a write unknown: no HTTP status (a lost answer, a
 * timeout) or a server error (`5xx`). The write may have been applied, so the caller reads again
 * instead of reporting a failure. Check `isContextChange` first.
 *
 * @param {unknown} error - The failure.
 * @returns {boolean} Whether the outcome is unknown.
 */
export function isUncertain(error: unknown): boolean {
  const problem: ApiProblem | null = readProblem(error);
  return problem === null || problem.status === 0 || problem.status >= 500;
}

/**
 * Function isRequestInProgress
 *
 * @description
 * Whether a creation was refused because an equivalent one with the same idempotency key is still
 * running (`409 idempotency.request-in-progress`): its outcome is not known yet.
 *
 * @param {unknown} error - The failure.
 * @returns {boolean} Whether the same creation is still running.
 */
export function isRequestInProgress(error: unknown): boolean {
  return hasProblemCode(error, 'idempotency.request-in-progress');
}

/**
 * Function isVersionMismatch
 *
 * @description
 * Whether a write named a version that is no longer the stored one
 * (`412 request.version-mismatch`): someone saved the document first.
 *
 * @param {unknown} error - The failure.
 * @returns {boolean} Whether the version is stale.
 */
export function isVersionMismatch(error: unknown): boolean {
  return hasProblemCode(error, 'request.version-mismatch');
}

/**
 * Function isGone
 *
 * @description
 * Whether the document no longer exists for the caller (`404`): deleted, or no longer visible.
 *
 * @param {unknown} error - The failure.
 * @returns {boolean} Whether the document is gone.
 */
export function isGone(error: unknown): boolean {
  return readProblem(error)?.status === 404;
}

/**
 * Function isForbidden
 *
 * @description
 * Whether the caller may no longer write in the document's space (`403`).
 *
 * @param {unknown} error - The failure.
 * @returns {boolean} Whether the write is forbidden.
 */
export function isForbidden(error: unknown): boolean {
  return readProblem(error)?.status === 403;
}
