import { HttpErrorResponse } from '@angular/common/http';

import type { AuthProblem } from '../../models/auth/auth.interface';

/**
 * Function authProblem
 *
 * @description
 * Extracts the stable code and the bounded attempt count without retaining request details.
 *
 * @param {unknown} error - The failure from the generated client.
 * @returns {AuthProblem} Presentation-safe information about the failure.
 */
export function authProblem(error: unknown): AuthProblem {
  if (!(error instanceof HttpErrorResponse)) {
    return { status: 0, code: 'unavailable' };
  }

  const body: unknown = error.error;
  const code: string =
    typeof body === 'object' && body !== null && 'code' in body && typeof body.code === 'string'
      ? body.code
      : 'unavailable';

  if (typeof body === 'object' && body !== null && 'details' in body) {
    const details: unknown = body.details;
    if (
      typeof details === 'object' &&
      details !== null &&
      'remainingAttempts' in details &&
      typeof details.remainingAttempts === 'number' &&
      Number.isSafeInteger(details.remainingAttempts) &&
      details.remainingAttempts > 0
    ) {
      return { status: error.status, code, remainingAttempts: details.remainingAttempts };
    }
  }

  return { status: error.status, code };
}
