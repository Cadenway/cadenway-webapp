import { type ApiProblem, readProblem } from '@core/api';
import { NotFoundRouteError, UnavailableRouteError } from '@shared/route-errors';

/**
 * Function toDocumentRouteError
 *
 * @description
 * Turns a failed read of a document into the route boundary's state: `404 document.not-found`
 * (a missing, deleted or invisible document, since documents answer 404 for the ones the caller
 * may not read) and a malformed id (`400`) are the not found page; anything else is unavailable,
 * with the status and request id the gateway gave.
 *
 * @param {unknown} error - The failure of the read.
 * @returns {Error} The error the route's boundary renders.
 */
export function toDocumentRouteError(error: unknown): Error {
  const problem: ApiProblem | null = readProblem(error);
  if (!problem) return error instanceof Error ? error : new Error(String(error));
  if ((problem.status === 404 && problem.code === 'document.not-found') || problem.status === 400) {
    return new NotFoundRouteError();
  }
  return new UnavailableRouteError(problem.status, problem.requestId);
}
