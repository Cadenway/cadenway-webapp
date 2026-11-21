import type { AuthProblem } from '../models/auth/auth.interface';

/**
 * Function accessDestination
 *
 * @description
 * Gives the caller a local route to recover a missing session or organization.
 *
 * @param {AuthProblem} problem - Refusal of the current-organization read.
 * @returns {string | null} Recovery route when the caller can correct the refusal.
 */
export function accessDestination(problem: AuthProblem): string | null {
  if (problem.status === 401) {
    return '/connexion';
  }

  if (
    problem.status === 404 ||
    problem.code === 'organization.not-selected' ||
    problem.code === 'organization.mfa-required'
  ) {
    return '/organisations';
  }

  return null;
}
