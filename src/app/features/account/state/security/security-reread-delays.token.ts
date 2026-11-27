import { InjectionToken } from '@angular/core';

/**
 * Constant SECURITY_REREAD_DELAYS_MS
 *
 * @description
 * When a security write whose answer was lost is checked by reading the section again, in
 * milliseconds before each read: at once, then 2, 4 and 8 seconds later, since a write that timed
 * out may still be applied after the first read.
 *
 * @type {readonly number[]}
 */
export const SECURITY_REREAD_DELAYS_MS: readonly number[] = [0, 2000, 4000, 8000];

/**
 * Constant SECURITY_REREAD_DELAYS
 *
 * @description
 * The delays `SecurityStore` waits before each read that settles a lost answer; specs provide
 * shorter ones.
 *
 * @type {InjectionToken<readonly number[]>}
 */
export const SECURITY_REREAD_DELAYS: InjectionToken<readonly number[]> = new InjectionToken<
  readonly number[]
>('SECURITY_REREAD_DELAYS', { factory: (): readonly number[] => SECURITY_REREAD_DELAYS_MS });
