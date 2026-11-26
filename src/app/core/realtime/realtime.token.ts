import { InjectionToken, type Signal } from '@angular/core';
import { io, type ManagerOptions, type Socket, type SocketOptions } from 'socket.io-client';

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

/**
 * Type RealtimeSocketFactory
 *
 * @description
 * Opens a Socket.IO client for a gateway origin with the connection options of an attempt.
 *
 * @type {(url: string, options: Partial<ManagerOptions & SocketOptions>) => Socket}
 */
export type RealtimeSocketFactory = (
  url: string,
  options: Partial<ManagerOptions & SocketOptions>,
) => Socket;

/**
 * Constant REALTIME_SOCKET_FACTORY
 *
 * @description
 * Creates the transport of each connection attempt; `socket.io-client`'s `io` by default. Specs
 * provide a fake through the injector rather than mocking the module, which a non-isolated run
 * may have loaded already for another spec.
 *
 * @type {InjectionToken<RealtimeSocketFactory>}
 */
export const REALTIME_SOCKET_FACTORY: InjectionToken<RealtimeSocketFactory> =
  new InjectionToken<RealtimeSocketFactory>('REALTIME_SOCKET_FACTORY', {
    factory: (): RealtimeSocketFactory => io,
  });
