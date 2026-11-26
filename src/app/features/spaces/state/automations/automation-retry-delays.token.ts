import { InjectionToken } from '@angular/core';

/**
 * Constant AUTOMATION_RETRY_DELAYS
 *
 * @description
 * The waits, in milliseconds, before each resend of a write whose answer was lost: three
 * resends over about 6.5 s by default.
 *
 * @type {InjectionToken<readonly number[]>}
 */
export const AUTOMATION_RETRY_DELAYS: InjectionToken<readonly number[]> = new InjectionToken<
  readonly number[]
>('AUTOMATION_RETRY_DELAYS', { factory: (): readonly number[] => [500, 1500, 4500] });
