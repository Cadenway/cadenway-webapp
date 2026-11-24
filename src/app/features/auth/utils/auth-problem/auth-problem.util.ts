import { type ApiProblem, readProblem } from '@core/api';

import type { AuthProblem } from '../../models/auth-problem/auth-problem.interface';

/**
 * Function authProblem
 *
 * @description
 * Keeps the status, the stable code and a positive whole `details.remainingAttempts` of a failure.
 * Anything that is not an HTTP failure (a refused lock, an unexpected answer, a cancelled WebAuthn
 * ceremony) becomes status zero without a code.
 *
 * @param {unknown} error - The failure of a data-access call.
 * @returns {AuthProblem} Presentation-safe information about the failure.
 */
export function authProblem(error: unknown): AuthProblem {
  const problem: ApiProblem | null = readProblem(error);
  if (problem === null) return { status: 0, code: null, remainingAttempts: null };
  const attempts: unknown = problem.details?.['remainingAttempts'];
  return {
    status: problem.status,
    code: problem.code,
    remainingAttempts:
      typeof attempts === 'number' && Number.isSafeInteger(attempts) && attempts > 0
        ? attempts
        : null,
  };
}
