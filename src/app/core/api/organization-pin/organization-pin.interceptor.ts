import {
  HttpErrorResponse,
  type HttpEvent,
  type HttpHandlerFn,
  type HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, type Observable, throwError } from 'rxjs';

import { RuntimeConfigStore } from '@core/config';

import { hasProblemCode } from '../utils/problem/problem.utils';
import { ORGANIZATION_PIN_OPERATIONS } from './organization-pin-operations.constant';
import { OrganizationPin } from './organization-pin.service';
import { OrganizationSwitchPendingError } from './organization-switch-pending.error';
import { PASSIVE_REQUEST, SKIP_ORGANIZATION_PIN } from './organization-pin.token';

/**
 * Function organizationPinInterceptor
 *
 * @description
 * Pins only operations that declare the precondition, and reports context mismatches while
 * preserving the original failure for the caller.
 *
 * @param {HttpRequest<unknown>} request - The configured gateway request.
 * @param {HttpHandlerFn} next - The next transport handler.
 * @returns {Observable<HttpEvent<unknown>>} The gateway response.
 */
export function organizationPinInterceptor(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  const pin: OrganizationPin = inject(OrganizationPin);
  const organizationId: string | null = pin.current();
  const revision: number = pin.revision();
  if (!organizationId || request.context.get(SKIP_ORGANIZATION_PIN)) return next(request);
  const gateway: URL = new URL(inject(RuntimeConfigStore).config().apiUrl);
  const url: URL = new URL(request.url, gateway);
  const path: string = url.pathname;
  const supported: boolean =
    url.origin === gateway.origin &&
    ORGANIZATION_PIN_OPERATIONS.some(
      ([method, pattern]: readonly [string, RegExp]) =>
        method === request.method && pattern.test(path),
    );
  if (supported && (pin.isSwitching() || (request.context.get(PASSIVE_REQUEST) && pin.stale())))
    return throwError(() => new OrganizationSwitchPendingError());
  const outgoing: HttpRequest<unknown> =
    organizationId && supported
      ? request.clone({ setHeaders: { 'If-Organization-Match': organizationId } })
      : request;
  return next(outgoing).pipe(
    catchError((error: unknown) => {
      if (
        organizationId &&
        supported &&
        error instanceof HttpErrorResponse &&
        error.status === 412 &&
        hasProblemCode(error, 'organization.context-changed')
      ) {
        if (request.context.get(PASSIVE_REQUEST)) {
          if (revision === pin.revision()) pin.markStale();
        } else pin.notifyContextChanged();
      }
      return throwError(() => error);
    }),
  );
}
