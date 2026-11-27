import { InjectionToken } from '@angular/core';

/**
 * Constant DELETION_CHECK_DELAYS_MS
 *
 * @description
 * Waits, in milliseconds, before each read that checks a deletion whose answer was lost (2, 4 then
 * 8 s). A read that still finds the document proves nothing while the original request may still
 * run, so the deletion stays pending until a read finds it gone or the last one is done. Specs
 * provide shorter waits.
 *
 * @type {InjectionToken<readonly number[]>}
 */
export const DELETION_CHECK_DELAYS_MS: InjectionToken<readonly number[]> = new InjectionToken<
  readonly number[]
>('DELETION_CHECK_DELAYS_MS', { factory: (): readonly number[] => [2_000, 4_000, 8_000] });
