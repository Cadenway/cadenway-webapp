import type { HttpEvent, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { RuntimeConfigStore } from '@core/config';

/**
 * Function apiClientInterceptor
 *
 * @description
 * Sends the generated client's relative API requests to the configured gateway with the session
 * cookie. Asset requests and other HTTP destinations keep their original credential policy.
 *
 * @param {HttpRequest<unknown>} request - The request from Angular's configured transport.
 * @param {HttpHandlerFn} next - The next handler in the transport.
 * @returns {Observable<HttpEvent<unknown>>} The gateway or local asset response.
 */
export function apiClientInterceptor(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  if (!request.url.startsWith('/v1/')) {
    return next(request);
  }

  const gateway: URL = new URL(inject(RuntimeConfigStore).config().apiUrl);
  if (!['http:', 'https:'].includes(gateway.protocol) || gateway.username || gateway.password) {
    throw new TypeError('The API gateway must use an HTTP origin without credentials.');
  }

  return next(
    request.clone({
      url: new URL(request.url, gateway).href,
      withCredentials: true,
    }),
  );
}
