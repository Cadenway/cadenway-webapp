import { InjectionToken } from '@angular/core';

/**
 * Constant CHECKOUT_CONFIRM_DELAYS_MS
 *
 * @description
 * Waits, in milliseconds, before each read of the subscription after Stripe's successful return,
 * until the plan is no longer Free: 2, 4 then 8 s, 14 s in all. Specs provide shorter ones.
 *
 * @type {InjectionToken<readonly number[]>}
 */
export const CHECKOUT_CONFIRM_DELAYS_MS: InjectionToken<readonly number[]> = new InjectionToken<
  readonly number[]
>('CHECKOUT_CONFIRM_DELAYS_MS', { factory: (): readonly number[] => [2_000, 4_000, 8_000] });
