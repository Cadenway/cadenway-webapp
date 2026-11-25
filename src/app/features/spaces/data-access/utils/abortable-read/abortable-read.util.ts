import { firstValueFrom, fromEvent, type Observable, takeUntil } from 'rxjs';

/**
 * Function abortableRead
 *
 * @description
 * Subscribes to a gateway read until its resource is superseded or destroyed.
 *
 * @param {Observable<T>} source - Gateway read.
 * @param {AbortSignal | undefined} signal - Resource cancellation signal.
 * @returns {Promise<T>} The first response.
 */
export function abortableRead<T>(source: Observable<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  return firstValueFrom(signal ? source.pipe(takeUntil(fromEvent(signal, 'abort'))) : source);
}
