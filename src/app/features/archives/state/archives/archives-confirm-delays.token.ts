import { InjectionToken } from '@angular/core';

/**
 * Constant ARCHIVES_CONFIRM_DELAYS_MS
 *
 * @description
 * Waits, in milliseconds, before each read of the item that settles an unknown restore outcome:
 * 2, 4 then 8 s after the write failed, 14 s in all. Specs provide shorter ones.
 *
 * @type {InjectionToken<readonly number[]>}
 */
export const ARCHIVES_CONFIRM_DELAYS_MS: InjectionToken<readonly number[]> = new InjectionToken<
  readonly number[]
>('ARCHIVES_CONFIRM_DELAYS_MS', { factory: (): readonly number[] => [2_000, 4_000, 8_000] });
