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
   * HTTP response status, including zero for a network failure.
   *
   * @type {number}
   */
  status: number;

  /**
   * Property code
   *
   * @description
   * Problem code from the response body, when it is a string.
   *
   * @type {string | null}
   */
  code: string | null;

  /**
   * Property title
   *
   * @description
   * Problem title from the response body, when it is a string.
   *
   * @type {string | null}
   */
  title: string | null;

  /**
   * Property detail
   *
   * @description
   * Problem detail from the response body, when it is a string.
   *
   * @type {string | null}
   */
  detail: string | null;

  /**
   * Property details
   *
   * @description
   * Structured details from the response body, when it is an object.
   *
   * @type {Readonly<Record<string, unknown>> | null}
   */
  details: Readonly<Record<string, unknown>> | null;

  /**
   * Property requestId
   *
   * @description
   * Request identifier from the response header, or null for a network failure.
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
  let body: unknown = error.status === 0 ? null : error.error;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body) as unknown;
    } catch {
      body = null;
    }
  }
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
 * Function readProblemAsync
 *
 * @description
 * Reads problem fields, including JSON delivered as a Blob.
 * @param {unknown} error - Failure to inspect.
 * @returns {Promise<ApiProblem | null>} Parsed HTTP problem or null for another failure.
 */
export async function readProblemAsync(error: unknown): Promise<ApiProblem | null> {
  if (!(error instanceof HttpErrorResponse) || error.status === 0 || !(error.error instanceof Blob))
    return readProblem(error);
  try {
    const body: string = await error.error.text();
    return readProblem(
      new HttpErrorResponse({ error: body, status: error.status, headers: error.headers }),
    );
  } catch {
    return readProblem(error);
  }
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
