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
