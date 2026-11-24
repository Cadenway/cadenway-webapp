import { HttpErrorResponse } from '@angular/common/http';

/**
 * Interface ApiProblem
 *
 * @description
 * Validated problem fields from an HTTP failure.
 */
export interface ApiProblem {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * Field returned by the gateway, when available.
   *
   * @type {number}
   */
  status: number;

  /**
   * Property code
   *
   * @description
   * Field returned by the gateway, when available.
   *
   * @type {string | null}
   */
  code: string | null;

  /**
   * Property title
   *
   * @description
   * Field returned by the gateway, when available.
   *
   * @type {string | null}
   */
  title: string | null;

  /**
   * Property detail
   *
   * @description
   * Field returned by the gateway, when available.
   *
   * @type {string | null}
   */
  detail: string | null;

  /**
   * Property details
   *
   * @description
   * Field returned by the gateway, when available.
   *
   * @type {Readonly<Record<string, unknown>> | null}
   */
  details: Readonly<Record<string, unknown>> | null;

  /**
   * Property requestId
   *
   * @description
   * Field returned by the gateway, when available.
   *
   * @type {string | null}
   */
  requestId: string | null;
  // #endregion
}

/**
 * Function readProblem
 *
 * @description
 * Reads supported problem fields without trusting the response body.
 * @param {unknown} error - Failure to inspect.
 * @returns {ApiProblem | null} Problem for an HTTP failure, otherwise null.
 */
export function readProblem(error: unknown): ApiProblem | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const body: unknown = error.status === 0 ? null : error.error;
  const value: Record<string, unknown> =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const details: unknown = value['details'];
  return {
    status: error.status,
    code: typeof value['code'] === 'string' ? value['code'] : null,
    title: typeof value['title'] === 'string' ? value['title'] : null,
    detail: typeof value['detail'] === 'string' ? value['detail'] : null,
    details:
      typeof details === 'object' && details !== null && !Array.isArray(details)
        ? (details as Record<string, unknown>)
        : null,
    requestId: error.status === 0 ? null : error.headers.get('X-Request-Id'),
  };
}

/**
 * Function hasProblemCode
 *
 * @description
 * Checks a failure against a gateway problem code.
 * @param {unknown} error - Failure to inspect.
 * @param {string} code - Expected code.
 * @returns {boolean} Whether the code matches.
 */
export function hasProblemCode(error: unknown, code: string): boolean {
  return readProblem(error)?.code === code;
}
