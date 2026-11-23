import { firstValueFrom, fromEvent, Observable, takeUntil, timeout } from 'rxjs';

/**
 * Constant SESSION_LOCK
 *
 * @description
 * Shared by all cooperating tabs using the browser's session cookie.
 *
 * @type {string}
 */
const SESSION_LOCK: string = 'cadenway-gateway-session';

/**
 * Function withSessionLock
 *
 * @description
 * Coordinates cookie changes and dependent requests across tabs. Shared reads can run together
 * and release their lock on cancellation or after eight seconds. A dispatched exclusive request
 * retains its lock until the response settles, even if the initiating view unsubscribes.
 *
 * @template T
 * @param {(signal: AbortSignal) => Observable<T>} operation - The single-response operation under the lock.
 * @param {LockMode} mode - Shared for cancellable reads, exclusive for cookie changes and writes.
 * @returns {Observable<T>} The response, or an error when browser coordination is unavailable.
 */
export function withSessionLock<T>(
  operation: (signal: AbortSignal) => Observable<T>,
  mode: LockMode = 'exclusive',
): Observable<T> {
  return new Observable<T>((subscriber) => {
    const environment: { navigator?: { locks?: LockManager } } = globalThis;
    const locks: LockManager | undefined = environment.navigator?.locks;
    if (!locks) {
      subscriber.error(new Error('Browser session coordination is unavailable.'));
      return;
    }

    const controller: AbortController = new AbortController();
    void locks
      .request(SESSION_LOCK, { mode, signal: controller.signal }, async () => {
        if (controller.signal.aborted) return;

        const response: Observable<T> = operation(controller.signal);
        const result: T = await firstValueFrom(
          mode === 'shared'
            ? response.pipe(
                takeUntil(fromEvent(controller.signal, 'abort')),
                timeout({ first: 8_000 }),
              )
            : response,
        );
        subscriber.next(result);
        subscriber.complete();
      })
      .catch((error: unknown) => {
        subscriber.error(error);
      });

    return () => {
      controller.abort();
    };
  });
}
