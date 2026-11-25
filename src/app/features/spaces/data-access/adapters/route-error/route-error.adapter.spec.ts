import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import {
  AccessDeniedRouteError,
  NotFoundRouteError,
  UnavailableRouteError,
} from '@shared/route-errors';

import { toRouteError } from './route-error.adapter';

/**
 * Function problem
 *
 * @description
 * An HTTP failure carrying a problem code and a request reference.
 *
 * @param {number} status - HTTP status.
 * @param {string} code - Problem code.
 * @returns {HttpErrorResponse} The failure.
 */
function problem(status: number, code: string): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    error: { type: 'about:blank', title: 'x', status, code },
    headers: new HttpHeaders({ 'X-Request-Id': 'req-1' }),
  });
}

describe('toRouteError', () => {
  it('reads a hidden or deleted space or list as access denied', () => {
    const space: Error = toRouteError(problem(404, 'space.not-found'), 'space', 'sp-1');
    const list: Error = toRouteError(problem(404, 'list.not-found'), 'list', 'l-1');

    expect(space).toBeInstanceOf(AccessDeniedRouteError);
    expect((space as AccessDeniedRouteError).resource).toEqual({
      kind: 'space',
      id: 'sp-1',
      name: null,
      ownerName: null,
    });
    expect((list as AccessDeniedRouteError).resource.kind).toBe('list');
  });

  it('reads another 404 and a malformed id as not found', () => {
    expect(toRouteError(problem(404, 'organization.not-found'), 'list', 'l')).toBeInstanceOf(
      NotFoundRouteError,
    );
    expect(toRouteError(problem(400, 'request.invalid'), 'list', 'x')).toBeInstanceOf(
      NotFoundRouteError,
    );
  });

  it('reads anything else as unavailable and keeps a non-HTTP failure', () => {
    const unavailable: Error = toRouteError(problem(503, 'service.unavailable'), 'space', 's');
    const script: Error = new TypeError('boom');

    expect(unavailable).toBeInstanceOf(UnavailableRouteError);
    expect((unavailable as UnavailableRouteError).status).toBe(503);
    expect(toRouteError(script, 'space', 's')).toBe(script);
  });
});
