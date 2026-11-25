import { type ApiProblem, readProblem } from '@core/api';
import {
  AccessDeniedRouteError,
  NotFoundRouteError,
  UnavailableRouteError,
} from '@shared/route-errors';

/**
 * Function toRouteError
 *
 * @description
 * Turns the failure of a page's primary read into the typed state of the route boundary. The
 * gateway answers `404 space.not-found` or `list.not-found` both for a deleted resource and for a
 * private one the caller does not see, and never tells them apart: that answer is « Accès refusé »
 * with « Demander l’accès » (an access request never reveals whether the target exists). Any other
 * `404` or a malformed identifier (`400`) is not found; anything else is unavailable with its
 * status and request reference.
 *
 * @param {unknown} error - Failure of the read.
 * @param {'space' | 'list'} kind - What was read.
 * @param {string} id - Identifier of what was read.
 * @returns {Error} The typed route error, or the original failure when it is not an HTTP one.
 */
export function toRouteError(error: unknown, kind: 'space' | 'list', id: string): Error {
  const problem: ApiProblem | null = readProblem(error);
  if (!problem) return error instanceof Error ? error : new Error(String(error));
  if (problem.status === 404 && problem.code === `${kind}.not-found`) {
    return new AccessDeniedRouteError({ kind, id, name: null, ownerName: null });
  }
  if (problem.status === 404 || problem.status === 400) return new NotFoundRouteError();
  return new UnavailableRouteError(problem.status, problem.requestId);
}
