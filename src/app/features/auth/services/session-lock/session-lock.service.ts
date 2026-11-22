import { firstValueFrom, Observable } from 'rxjs';

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
 * Serializes cookie changes and dependent requests across tabs. Cancellation removes a queued
 * request or prevents a later HTTP operation. A dispatched request retains its lock until the
 * response settles even if the initiating view unsubscribes.
 *
 * @template T
 * @param {(signal: AbortSignal) => Observable<T>} operation - The single-response operation under the lock.
 * @returns {Observable<T>} The response, or an error when browser coordination is unavailable.
 */
export function withSessionLock<T>(
  operation: (signal: AbortSignal) => Observable<T>,
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
      .request(SESSION_LOCK, { signal: controller.signal }, async () => {
        if (controller.signal.aborted) return;

        const result: T = await firstValueFrom(operation(controller.signal));
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
