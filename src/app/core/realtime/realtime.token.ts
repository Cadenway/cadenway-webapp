import { InjectionToken, type Signal } from '@angular/core';

/**
 * Constant REALTIME_TICKET_SOURCE
 *
 * @description
 * Supplies a fresh single-use ticket for every connection attempt.
 *
 * @type {InjectionToken<() => Promise<string>>}
 */
export const REALTIME_TICKET_SOURCE: InjectionToken<() => Promise<string>> = new InjectionToken<
  () => Promise<string>
>('REALTIME_TICKET_SOURCE');

/**
 * Constant REALTIME_ORGANIZATION
 *
 * @description
 * Expected organization of the authenticated workspace connection.
 *
 * @type {InjectionToken<Signal<string | null>>}
 */
export const REALTIME_ORGANIZATION: InjectionToken<Signal<string | null>> = new InjectionToken<
  Signal<string | null>
>('REALTIME_ORGANIZATION');
/**
 * Constant REALTIME_TERMINAL_FAILURE
 *
 * @description
 * Reports a terminal ticket failure to the workspace that owns navigation.
 *
 * @type {InjectionToken<(status: 401 | 403) => void>}
 */
export const REALTIME_TERMINAL_FAILURE: InjectionToken<(status: 401 | 403) => void> =
  new InjectionToken<(status: 401 | 403) => void>('REALTIME_TERMINAL_FAILURE');
