import {
  type HttpEvent,
  type HttpHandlerFn,
  type HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { type Observable, of, tap } from 'rxjs';

import { RecentReads } from './recent-reads.service';
import { RECORD_READ, REUSE_READ_WITHIN_MS } from './recent-read.token';

/**
 * Function recentReadInterceptor
 *
 * @description
 * Lets two readers of the same address share one answer during a screen load. A `GET` marked
 * `RECORD_READ` keeps its successful answer; a `GET` marked `REUSE_READ_WITHIN_MS` takes a kept
 * answer of the same address and parameters no older than that, and asks the gateway otherwise.
 * Any other method forgets every kept answer first, since a write may change what a read answers.
 *
 * @param {HttpRequest<unknown>} request - The outgoing request.
 * @param {HttpHandlerFn} next - The next handler.
 * @returns {Observable<HttpEvent<unknown>>} The response events.
 */
export function recentReadInterceptor(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  const reads: RecentReads = inject(RecentReads);
  if (request.method !== 'GET') {
    reads.clear();
    return next(request);
  }
  const key: string = request.urlWithParams;
  const within: number = request.context.get(REUSE_READ_WITHIN_MS);
  const kept: HttpResponse<unknown> | null = within > 0 ? reads.take(key, within) : null;
  if (kept !== null) return of(kept);
  if (!request.context.get(RECORD_READ)) return next(request);
  return next(request).pipe(
    tap((event: HttpEvent<unknown>): void => {
      if (event instanceof HttpResponse && event.ok) reads.keep(key, event);
    }),
  );
}
