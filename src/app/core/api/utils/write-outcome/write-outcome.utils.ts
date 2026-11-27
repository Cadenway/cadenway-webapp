import { HttpErrorResponse } from '@angular/common/http';

import { OrganizationSwitchPendingError } from '../../organization-pin/organization-switch-pending.error';
import { type ApiProblem, readProblem } from '../problem/problem.utils';

/**
 * Function isDroppedOrganizationWrite
 *
 * @description
 * Whether a write was dropped for the organization it was meant for: the organization pin blocked
 * it while the session was changing organization (`OrganizationSwitchPendingError`, nothing was
 * sent), or the gateway refused it for another session organization
 * (`412 organization.context-changed`, nothing was applied). Neither is the person's failure, and
 * neither may be retried, rolled back or reported in the next organization: the workspace recovery
 * takes over.
 *
 * @param {unknown} error - The failed write.
 * @returns {boolean} Whether the write was dropped.
 */
export function isDroppedOrganizationWrite(error: unknown): boolean {
  if (error instanceof OrganizationSwitchPendingError) return true;
  const problem: ApiProblem | null = readProblem(error);
  return problem?.status === 412 && problem.code === 'organization.context-changed';
}

/**
 * Function isUnknownWriteOutcome
 *
 * @description
 * Whether a failed write may still have been applied: no answer (a network failure, an abort, a
 * client timeout or any failure that is not a gateway answer), a `408`, a `5xx`, or
 * `409 idempotency.request-in-progress` (the same `Idempotency-Key` is still being processed). Such
 * a write is never reported as a definite failure; any other `4xx` is a definite refusal. A dropped
 * write (`isDroppedOrganizationWrite`) is not uncertain.
 *
 * @param {unknown} error - The failed write.
 * @returns {boolean} Whether the outcome is unknown.
 */
export function isUnknownWriteOutcome(error: unknown): boolean {
  if (isDroppedOrganizationWrite(error)) return false;
  if (!(error instanceof HttpErrorResponse)) return true;
  if (error.status === 0 || error.status === 408 || error.status >= 500) return true;
  return error.status === 409 && readProblem(error)?.code === 'idempotency.request-in-progress';
}
