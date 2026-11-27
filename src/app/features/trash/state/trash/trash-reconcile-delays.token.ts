import { InjectionToken } from '@angular/core';

/**
 * Constant TRASH_RECONCILE_DELAYS
 *
 * @description
 * Delays, in milliseconds, before each read that decides a write without an answer (as Task's
 * `ROW_RECONCILE_DELAYS_MS`): one read right after a timeout or a `5xx` proves nothing, since the
 * write may still be running. Specs provide shorter delays.
 *
 * @type {InjectionToken<readonly number[]>}
 */
export const TRASH_RECONCILE_DELAYS: InjectionToken<readonly number[]> = new InjectionToken<
  readonly number[]
>('TRASH_RECONCILE_DELAYS', { providedIn: 'root', factory: () => [2_000, 4_000, 8_000] });
