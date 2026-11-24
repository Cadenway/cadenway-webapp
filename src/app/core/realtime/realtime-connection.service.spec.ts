import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Subscription } from 'rxjs';
import { io, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { RuntimeConfigStore } from '@core/config';

import {
  provideRealtime,
  REALTIME_ORGANIZATION,
  REALTIME_TICKET_SOURCE,
  RealtimeConnection,
} from './index';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));

/**
 * Class FakeSocket
 *
 * @description
 * Controllable transport with immediate successful room acknowledgements.
 */
class FakeSocket {
  // #region Properties
  /**
   * Property handlers
   *
   * @description
   * Registered gateway event handlers.
   *
   * @type {Map<string, (data: unknown) => void>}
   * @readonly
   */
  public readonly handlers: Map<string, (data: unknown) => void> = new Map<
    string,
    (data: unknown) => void
  >();

  /**
   * Property emit
   *
   * @description
   * Captures presence and room events, acknowledging room operations.
   *
   * @type {Mock}
   * @readonly
   */
  public readonly emit: Mock = vi.fn(
    (_name: string, _data: unknown, callback?: (error: null, ack: unknown) => void) =>
      callback?.(null, { ok: true }),
  );

  /**
   * Property volatile
   *
   * @description
   * Captures heartbeat events.
   *
   * @type {{ emit: Mock }}
   * @readonly
   */
  public readonly volatile: { emit: Mock } = { emit: vi.fn() };

  /**
   * Property connect
   *
   * @description
   * Captures connection attempts.
   *
   * @type {Mock}
   * @readonly
   */
  public readonly connect: Mock = vi.fn();

  /**
   * Property disconnect
   *
   * @description
   * Captures transport cleanup.
   *
   * @type {Mock}
   * @readonly
   */
  public readonly disconnect: Mock = vi.fn();
  // #endregion
  // #region Methods
  /**
   * Method once
   *
   * @description
   * Registers a gateway handler.
   *
   * @param {string} name - Event name.
   * @param {(data: unknown) => void} handler - Listener.
   */
  public once(name: string, handler: (data: unknown) => void): void {
    this.handlers.set(name, handler);
  }

  /**
   * Method on
   *
   * @description
   * Registers a gateway handler.
   *
   * @param {string} name - Event name.
   * @param {(data: unknown) => void} handler - Listener.
   */
  public on(name: string, handler: (data: unknown) => void): void {
    this.handlers.set(name, handler);
  }

  /**
   * Method timeout
   *
   * @description
   * Captures acknowledgement operations.
   *
   * @returns {FakeSocket} This fake transport.
   */
  public timeout(): this {
    return this;
  }

  /**
   * Method removeAllListeners
   *
   * @description
   * Removes registered callbacks on cleanup.
   */
  public removeAllListeners(): void {
    this.handlers.clear();
  }

  /**
   * Method trigger
   *
   * @description
   * Delivers a server event to the registered listener.
   *
   * @param {string} name - Event name.
   * @param {unknown} data - Packet payload.
   */
  public trigger(name: string, data?: unknown): void {
    this.handlers.get(name)?.(data);
  }
  // #endregion
}

/**
 * Constant organization
 *
 * @description
 * Expected organization in handshake fixtures.
 *
 * @type {string}
 */
const organization: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';
/**
 * Constant hello
 *
 * @description
 * Valid gateway admission packet.
 *
 * @type {object}
 */
const hello: object = {
  id: '019a7005-6f7a-7b8c-9d0e-1f2a3b4c5d4f',
  type: 'connection.ready.v1',
  at: '2026-11-08T10:40:00Z',
  version: 1,
  data: {
    organizationId: organization,
    sessionExpiresAt: '2026-11-08T11:00:00Z',
    heartbeatIntervalSeconds: 10,
  },
};
/**
 * Constant change
 *
 * @description
 * A valid task invalidation.
 *
 * @type {object}
 */
const change: object = {
  id: '019a7005-6f7a-7b8c-9d0e-1f2a3b4c5d4d',
  type: 'task.updated.v1',
  at: '2026-11-08T10:40:00Z',
  version: 1,
  data: { taskId: '019a7002-3c4d-7e5f-8a6b-7c8d9e0f1a23', changed: ['status'] },
};

/**
 * Function setup
 *
 * @description
 * Provides a connection and captures each new fake socket.
 *
 * @param {boolean} enabled - Whether the runtime enables realtime.
 * @returns {{ connection: RealtimeConnection; sockets: FakeSocket[]; ticket: Mock }} Test collaborators.
 */
function setup(enabled: boolean = true): {
  connection: RealtimeConnection;
  sockets: FakeSocket[];
  ticket: Mock;
} {
  const sockets: FakeSocket[] = [];
  const ticket: Mock = vi.fn().mockResolvedValue('ticket');
  vi.mocked(io).mockImplementation(() => {
    const socket: FakeSocket = new FakeSocket();
    sockets.push(socket);
    return socket as unknown as Socket;
  });
  TestBed.configureTestingModule({
    providers: [
      provideRealtime(),
      {
        provide: RuntimeConfigStore,
        useValue: {
          config: () => ({ realtimeUrl: enabled ? 'https://realtime.example.test' : undefined }),
        },
      },
      { provide: REALTIME_TICKET_SOURCE, useValue: ticket },
      { provide: REALTIME_ORGANIZATION, useValue: signal(organization) },
    ],
  });
  return { connection: TestBed.inject(RealtimeConnection), sockets, ticket };
}

/**
 * Function flush
 *
 * @description
 * Settles ticket and acknowledgement microtasks.
 *
 * @returns {Promise<void>} Completion of queued promise callbacks.
 */
async function flush(): Promise<void> {
  for (let i: number = 0; i < 8; i++) await Promise.resolve();
}

describe('RealtimeConnection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('is disabled without a gateway and completes both streams', () => {
    const { connection, ticket }: { connection: RealtimeConnection; ticket: Mock } = setup(false);
    const complete: Mock = vi.fn();
    connection.watch({ kind: 'task', taskKey: 'CAD-1' }).subscribe({ complete });
    connection.presenceChanges.subscribe({ complete });
    connection.setPresence('away');
    expect(connection.status()).toBe('disabled');
    expect(complete).toHaveBeenCalledTimes(2);
    expect(ticket).not.toHaveBeenCalled();
  });

  it('shares rooms, broadcasts valid changes once, and leaves after the final subscriber', async () => {
    const {
      connection,
      sockets,
      ticket,
    }: { connection: RealtimeConnection; sockets: FakeSocket[]; ticket: Mock } = setup();
    expect(ticket).not.toHaveBeenCalled();
    const first: Mock = vi.fn();
    const second: Mock = vi.fn();
    const a: Subscription = connection.watch({ kind: 'task', taskKey: 'CAD-1' }).subscribe(first);
    const b: Subscription = connection.watch({ kind: 'task', taskKey: 'CAD-1' }).subscribe(second);
    await flush();
    const socket: FakeSocket = sockets[0];
    socket.trigger('hello', hello);
    await flush();
    expect(connection.status()).toBe('connected');
    expect(
      socket.emit.mock.calls.filter((args: unknown[]) => args[0] === 'room:join'),
    ).toHaveLength(1);
    socket.trigger('change', change);
    socket.trigger('change', change);
    socket.trigger('change', { ...change, id: 'bad' });
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    a.unsubscribe();
    expect(
      socket.emit.mock.calls.filter((args: unknown[]) => args[0] === 'room:leave'),
    ).toHaveLength(0);
    b.unsubscribe();
    expect(
      socket.emit.mock.calls.filter((args: unknown[]) => args[0] === 'room:leave'),
    ).toHaveLength(1);
  });

  it('reconnects with a new ticket, rejoins, and restores presence before notifying', async () => {
    const {
      connection,
      sockets,
      ticket,
    }: { connection: RealtimeConnection; sockets: FakeSocket[]; ticket: Mock } = setup();
    const reconnected: Mock = vi.fn();
    connection.reconnected.subscribe(reconnected);
    connection.setPresence('away');
    connection.watch({ kind: 'list', listId: 'list' }).subscribe();
    await flush();
    const first: FakeSocket = sockets[0];
    first.trigger('hello', hello);
    await flush();
    await vi.advanceTimersByTimeAsync(5000);
    expect(first.volatile.emit).toHaveBeenCalledWith('presence:heartbeat', {});
    first.trigger('disconnect');
    expect(connection.status()).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(1000);
    await flush();
    const second: FakeSocket = sockets[1];
    second.trigger('hello', hello);
    await flush();
    expect(ticket).toHaveBeenCalledTimes(2);
    expect(second.emit).toHaveBeenCalledWith('presence:set', { status: 'away' });
    expect(second.emit).toHaveBeenCalledWith(
      'room:join',
      { kind: 'list', listId: 'list' },
      expect.any(Function),
    );
    expect(reconnected).toHaveBeenCalledOnce();
  });

  it('rejects an unexpected organization and limits resource rooms', async () => {
    const { connection, sockets }: { connection: RealtimeConnection; sockets: FakeSocket[] } =
      setup();
    for (let i: number = 0; i < 32; i++)
      connection.watch({ kind: 'task', taskKey: `CAD-${String(i + 1)}` }).subscribe();
    const error: Mock = vi.fn();
    connection.watch({ kind: 'task', taskKey: 'CAD-33' }).subscribe({ error });
    expect(error.mock.calls[0]?.[0]).toEqual(new Error('room.limit-reached'));
    await flush();
    const socket: FakeSocket = sockets[0];
    socket.trigger('hello', {
      ...hello,
      data: {
        organizationId: 'other',
        sessionExpiresAt: '2026-11-08T11:00:00Z',
        heartbeatIntervalSeconds: 10,
      },
    });
    expect(connection.status()).toBe('reconnecting');
    expect(socket.disconnect).toHaveBeenCalledOnce();
  });

  it('errors watchers with a failed join acknowledgement', async () => {
    const { connection, sockets }: { connection: RealtimeConnection; sockets: FakeSocket[] } =
      setup();
    const error: Mock = vi.fn();
    connection.watch({ kind: 'task', taskKey: 'CAD-1' }).subscribe({ error });
    await flush();
    const socket: FakeSocket = sockets[0];
    socket.emit.mockImplementation(
      (name: string, _data: unknown, callback?: (failure: null, ack: unknown) => void) => {
        if (name === 'room:join') callback?.(null, { ok: false, code: 'room.not-found' });
      },
    );
    socket.trigger('hello', hello);
    await flush();
    expect(error).toHaveBeenCalledWith(new Error('room.not-found'));
  });

  it('emits validated presence notices and broadcasts to distinct watched rooms', async () => {
    const { connection, sockets }: { connection: RealtimeConnection; sockets: FakeSocket[] } =
      setup();
    const presence: Mock = vi.fn();
    const first: Mock = vi.fn();
    const second: Mock = vi.fn();
    connection.presenceChanges.subscribe(presence);
    connection.watch({ kind: 'task', taskKey: 'CAD-1' }).subscribe(first);
    connection.watch({ kind: 'list', listId: 'list' }).subscribe(second);
    await flush();
    const socket: FakeSocket = sockets[0];
    socket.trigger('hello', hello);
    await flush();
    socket.trigger('change', change);
    socket.trigger('change', {
      ...change,
      id: '019a7005-6f7a-7b8c-9d0e-1f2a3b4c5d50',
      type: 'user.status-changed.v1',
      data: { memberId: organization, status: 'offline' },
    });
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(presence).toHaveBeenCalledWith({ memberId: organization, status: 'offline' });
  });
});
