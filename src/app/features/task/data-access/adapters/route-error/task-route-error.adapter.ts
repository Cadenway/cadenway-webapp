import { type ApiProblem, readProblem } from '@core/api';
import {
  DeletedTaskRouteError,
  NotFoundRouteError,
  UnavailableRouteError,
} from '@shared/route-errors';

/**
 * Function toTaskRouteError
 *
 * @description
 * Maps a failed read of one task (`getTask`) to the typed route error the error boundary renders:
 * `404 task.trashed` is the deleted task (with its trash entry, for `Restore the task`); any other
 * `404` (a missing task, or one the caller does not see: the gateway never tells them apart) and a
 * `400` (malformed key) are not found; any other answer, offline included, is unavailable with its
 * status and reference (`Retry`). A failure without an HTTP answer is passed on, which the boundary
 * renders as unavailable.
 *
 * @param {unknown} error - Why the read failed.
 * @returns {Error} The error to render.
 */
export function toTaskRouteError(error: unknown): Error {
  const problem: ApiProblem | null = readProblem(error);
  if (!problem) return error instanceof Error ? error : new Error(String(error));
  if (problem.status === 404 && problem.code === 'task.trashed') {
    const key: unknown = problem.details?.['key'];
    const name: unknown = problem.details?.['name'];
    const entryId: unknown = problem.details?.['entryId'];
    if (typeof key === 'string' && typeof entryId === 'string') {
      return new DeletedTaskRouteError(
        { key, name: typeof name === 'string' ? name : key },
        entryId,
      );
    }
  }
  if (problem.status === 404 || problem.status === 400) return new NotFoundRouteError();
  return new UnavailableRouteError(problem.status, problem.requestId);
}
