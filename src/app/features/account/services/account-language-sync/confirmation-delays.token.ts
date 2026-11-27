import { InjectionToken } from '@angular/core';

/**
 * Constant CONFIRMATION_DELAYS
 *
 * @description
 * Waits before the fencing attempts that follow a write or read without an answer, in
 * milliseconds; their count bounds the attempts. 2, 4
 * and 8 s by default. Specs provide shorter ones.
 *
 * @type {InjectionToken<readonly number[]>}
 */
export const CONFIRMATION_DELAYS: InjectionToken<readonly number[]> = new InjectionToken<
  readonly number[]
>('CONFIRMATION_DELAYS', { factory: (): readonly number[] => [2000, 4000, 8000] });
