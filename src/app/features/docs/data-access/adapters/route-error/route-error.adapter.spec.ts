import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { NotFoundRouteError, UnavailableRouteError } from '@shared/route-errors';

import { toDocumentRouteError } from './route-error.adapter';

describe('toDocumentRouteError', () => {
  it('turns a missing document and a malformed id into the not found page', () => {
    expect(
      toDocumentRouteError(
        new HttpErrorResponse({ status: 404, error: { code: 'document.not-found' } }),
      ),
    ).toBeInstanceOf(NotFoundRouteError);
    expect(
      toDocumentRouteError(
        new HttpErrorResponse({ status: 400, error: { code: 'request.invalid' } }),
      ),
    ).toBeInstanceOf(NotFoundRouteError);
  });

  it('turns any other answer into the unavailable state with its request id', () => {
    const error: Error = toDocumentRouteError(
      new HttpErrorResponse({
        status: 503,
        error: { code: 'document.unavailable' },
        headers: new HttpHeaders({ 'X-Request-Id': 'req-7f3a' }),
      }),
    );

    expect(error).toBeInstanceOf(UnavailableRouteError);
    expect((error as UnavailableRouteError).requestId).toBe('req-7f3a');
    expect(
      toDocumentRouteError(
        new HttpErrorResponse({ status: 404, error: { code: 'organization.not-found' } }),
      ),
    ).toBeInstanceOf(UnavailableRouteError);
  });

  it('keeps an error that is not an HTTP answer', () => {
    const aborted: Error = new Error('aborted');

    expect(toDocumentRouteError(aborted)).toBe(aborted);
  });
});
