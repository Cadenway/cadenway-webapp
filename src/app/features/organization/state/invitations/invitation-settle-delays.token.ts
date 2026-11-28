import { InjectionToken } from '@angular/core';

/**
 * Constant INVITATION_SETTLE_DELAYS_MS
 *
 * @description
 * Waits, in milliseconds, before each attempt to settle a resend or a cancellation whose outcome
 * is unknown: 2, 4 then 8 s, 14 s in all. A cancellation is sent again after each wait (revoking
 * again answers `204`, and the invitation is read once if they leave it unknown); a resend is never
 * sent again, the invitation is read on its own (`getInvitation`) after each wait instead.
 * Specs provide shorter ones.
 *
 * @type {InjectionToken<readonly number[]>}
 */
export const INVITATION_SETTLE_DELAYS_MS: InjectionToken<readonly number[]> = new InjectionToken<
  readonly number[]
>('INVITATION_SETTLE_DELAYS_MS', { factory: (): readonly number[] => [2_000, 4_000, 8_000] });
