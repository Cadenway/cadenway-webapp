import { InjectionToken } from '@angular/core';

/**
 * Constant GOAL_EDIT_BURST_MS
 *
 * @description
 * Quiet time, in milliseconds, after the last click on a key result before its value enters the
 * goal's write queue, so a burst of `−`/`+` clicks sends one value. 300 ms by default.
 *
 * @type {InjectionToken<number>}
 */
export const GOAL_EDIT_BURST_MS: InjectionToken<number> = new InjectionToken<number>(
  'GOAL_EDIT_BURST_MS',
  { factory: (): number => 300 },
);

/**
 * Constant GOAL_SETTLE_BACKOFF_MS
 *
 * @description
 * Waits, in milliseconds, before each new read of a goal that settles a change of unknown outcome
 * after the first read failed; 2, 4 and 8 s by default.
 *
 * @type {InjectionToken<readonly number[]>}
 */
export const GOAL_SETTLE_BACKOFF_MS: InjectionToken<readonly number[]> = new InjectionToken<
  readonly number[]
>('GOAL_SETTLE_BACKOFF_MS', { factory: (): readonly number[] => [2000, 4000, 8000] });
