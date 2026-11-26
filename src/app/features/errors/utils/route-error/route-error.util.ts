import { type ApiProblem, readProblem } from '@core/api';
import { isRouteError, type KnownRouteError } from '@shared/route-errors';

/**
 * Function findRouteError
 *
 * @description
 * Finds the typed route error a failure carries. The router's boundary receives what the page
 * threw: a resource read in its error state throws an error whose `cause` is what the loader
 * rejected with, so the `cause` chain is followed.
 *
 * @param {unknown} error - Failure caught by the boundary, or given by route `data`.
 * @returns {KnownRouteError | null} The typed error, or null for any other failure.
 */
export function findRouteError(error: unknown): KnownRouteError | null {
  let current: unknown = error;
  for (let depth: number = 0; depth < 5 && current !== undefined; depth++) {
    if (isRouteError(current)) return current;
    current = current instanceof Error ? current.cause : undefined;
  }
  return null;
}

/**
 * Function findProblem
 *
 * @description
 * Finds the HTTP problem of a failure that is not a typed route error, through its `cause` chain.
 *
 * @param {unknown} error - Failure caught by the boundary.
 * @returns {ApiProblem | null} The problem, or null when no HTTP response is involved.
 */
export function findProblem(error: unknown): ApiProblem | null {
  let current: unknown = error;
  for (let depth: number = 0; depth < 5 && current !== undefined; depth++) {
    const problem: ApiProblem | null = readProblem(current);
    if (problem) return problem;
    current = current instanceof Error ? current.cause : undefined;
  }
  return null;
}
