import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Subscription } from 'rxjs';
import { io, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { HttpErrorResponse } from '@angular/common/http';

import { OrganizationPin } from '@core/api';
import { RuntimeConfigStore } from '@core/config';

import {
  provideRealtime,
  REALTIME_ORGANIZATION,
  REALTIME_TERMINAL_FAILURE,
  REALTIME_TICKET_SOURCE,
  RealtimeConnection,
} from './index';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));

/**
 * Class FakeSocket
 *
 * @description
 * Controllable transport with asynchronous acknowledgements and single-flight room changes.
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
    (name: string, _data: unknown, callback?: (error: Error | null, ack: unknown) => void) => {
      if (!callback) return;
      const room: boolean = name === 'room:join' || name === 'room:leave';
      if (room && this.roomBusy) {
        void Promise.resolve().then(() => {
          callback(null, { ok: false, code: 'realtime.unavailable' });
        });
        return;
      }
      if (room) this.roomBusy = true;
      const timeout: ReturnType<typeof setTimeout> = setTimeout(() => {
        callback(new Error('timeout'), undefined);
      }, 5000);
      const complete: (ack: unknown) => void = (ack: unknown) => {
        clearTimeout(timeout);
        if (room) this.roomBusy = false;
        callback(null, ack);
      };
      this.pending.push({ name, complete });
      if (this.automatic)
        void Promise.resolve().then(() => {
          this.respond(
            name,
            name === 'presence:list'
              ? { ok: true, status: 'online', members: [], nextCursor: null }
              : { ok: true },
          );
        });
    },
  );

  /**
   * Property automatic
   *
   * @description
   * Automatically acknowledges requests in a microtask when enabled.
   *
   * @type {boolean}
   */
  public automatic: boolean = true;

  /**
   * Property roomBusy
   *
   * @description
   * Whether a room operation is in flight at the fake gateway.
   *
   * @type {boolean}
   */
  public roomBusy: boolean = false;

  /**
   * Property pending
   *
   * @description
   * In-flight requests awaiting a fake gateway response.
   *
   * @type {{ name: string; complete: (ack: unknown) => void }[]}
   * @readonly
   */
  public readonly pending: { name: string; complete: (ack: unknown) => void }[] = [];

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
    this.handlers.set(name, (data: unknown) => {
      this.handlers.delete(name);
      handler(data);
    });
  }

  /**
   * Method respond
   *
   * @description
   * Completes the oldest matching acknowledgement asynchronously.
   *
   * @param {string} name - Client event name.
   * @param {unknown} ack - Gateway response.
   */
  public respond(name: string, ack: unknown = { ok: true }): void {
    const index: number = this.pending.findIndex((entry: { name: string }) => entry.name === name);
    if (index < 0) return;
    const entry: { name: string; complete: (ack: unknown) => void } | undefined =
      this.pending.splice(index, 1)[0];
    entry.complete(ack);
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
  organizationSignal: WritableSignal<string | null>;
  terminal: Mock;
} {
  const organizationSignal: WritableSignal<string | null> = signal(organization);
  const terminal: Mock = vi.fn();
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
      { provide: REALTIME_ORGANIZATION, useValue: organizationSignal },
      { provide: REALTIME_TERMINAL_FAILURE, useValue: terminal },
    ],
  });
  return {
    connection: TestBed.inject(RealtimeConnection),
    sockets,
    ticket,
    organizationSignal,
    terminal,
  };
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
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
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
    await flush();
    expect(
      socket.emit.mock.calls.filter((args: unknown[]) => args[0] === 'room:leave'),
    ).toHaveLength(1);
  });

  it('reconnects with a new ticket, rejoins, and adopts the saved presence', async () => {
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
    expect(second.emit).not.toHaveBeenCalledWith(
      'presence:set',
      expect.anything(),
      expect.anything(),
    );
    expect(connection.ownStatus()).toBe('online');
    expect(second.emit).toHaveBeenCalledWith(
      'room:join',
      { kind: 'list', listId: 'list' },
      expect.any(Function),
    );
    expect(reconnected).toHaveBeenCalledOnce();
    expect(second.emit.mock.invocationCallOrder[1]).toBeLessThan(
      reconnected.mock.invocationCallOrder[0],
    );
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
    expect(connection.status()).toBe('disabled');
    expect(socket.disconnect).toHaveBeenCalledOnce();
  });

  it('errors watchers with a failed join acknowledgement', async () => {
    const { connection, sockets }: { connection: RealtimeConnection; sockets: FakeSocket[] } =
      setup();
    const error: Mock = vi.fn();
    connection.watch({ kind: 'task', taskKey: 'CAD-1' }).subscribe({ error });
    await flush();
    const socket: FakeSocket = sockets[0];
    socket.automatic = false;
    socket.trigger('hello', hello);
    await flush();
    socket.respond('room:join', { ok: false, code: 'room.not-found' });
    await flush();
    expect(error).toHaveBeenCalledWith(new Error('room.not-found'));
  });

  it('reconciles paginated presence after notices and retains a busy cursor', async () => {
    const { connection, sockets }: { connection: RealtimeConnection; sockets: FakeSocket[] } =
      setup();
    connection.presenceChanges.subscribe();
    await flush();
    const socket: FakeSocket = sockets[0];
    socket.automatic = false;
    socket.trigger('hello', hello);
    await flush();
    socket.respond('presence:list', {
      ok: true,
      status: 'away',
      members: [{ memberId: organization, status: 'online' }],
      nextCursor: 'next',
    });
    await flush();
    socket.trigger('change', {
      ...change,
      type: 'user.status-changed.v1',
      data: { memberId: organization, status: 'offline' },
    });
    socket.respond('presence:list', { ok: false, code: 'realtime.unavailable' });
    await flush();
    await vi.advanceTimersByTimeAsync(6000);
    expect(
      socket.emit.mock.calls
        .filter((args: unknown[]) => args[0] === 'presence:list')
        .map((args: unknown[]) => args[1]),
    ).toEqual([{}, { cursor: 'next' }, { cursor: 'next' }]);
    socket.respond('presence:list', {
      ok: true,
      status: 'away',
      members: [{ memberId: organization, status: 'do-not-disturb' }],
      nextCursor: null,
    });
    await flush();
    expect(connection.presences().has(organization)).toBe(false);
    expect(connection.ownStatus()).toBe('away');
  });

  it('restarts invalid cursors no sooner than five seconds and preserves a local choice', async () => {
    const { connection, sockets }: { connection: RealtimeConnection; sockets: FakeSocket[] } =
      setup();
    connection.presenceChanges.subscribe();
    await flush();
    const socket: FakeSocket = sockets[0];
    socket.automatic = false;
    socket.trigger('hello', hello);
    await flush();
    connection.setPresence('invisible');
    socket.respond('presence:list', { ok: false, code: 'request.invalid' });
    await flush();
    await vi.advanceTimersByTimeAsync(4999);
    expect(
      socket.emit.mock.calls.filter((args: unknown[]) => args[0] === 'presence:list'),
    ).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1001);
    expect(
      socket.emit.mock.calls.filter((args: unknown[]) => args[0] === 'presence:list'),
    ).toHaveLength(2);
    socket.respond('presence:list', { ok: true, status: 'away', members: [], nextCursor: null });
    await flush();
    expect(connection.ownStatus()).toBe('invisible');
  });

  it('keeps live changes during repeated failures and reconciles the last change per member', async () => {
    const { connection, sockets }: { connection: RealtimeConnection; sockets: FakeSocket[] } =
      setup();
    connection.presenceChanges.subscribe();
    await flush();
    const socket: FakeSocket = sockets[0];
    socket.automatic = false;
    socket.trigger('hello', hello);
    await flush();
    for (let i: number = 0; i < 20; i++) {
      socket.trigger('change', {
        ...change,
        id: `019a7005-6f7a-7b8c-9d0e-${String(i).padStart(12, '0')}`,
        type: 'user.status-changed.v1',
        data: { memberId: organization, status: i === 19 ? 'away' : 'online' },
      });
    }
    expect(connection.presences().get(organization)).toBe('away');
    expect(
      (connection as unknown as { snapshotNotices: Map<string, unknown> }).snapshotNotices.size,
    ).toBe(1);
    socket.respond('presence:list', { ok: false, code: 'realtime.unavailable' });
    await flush();
    await vi.advanceTimersByTimeAsync(4999);
    expect(
      socket.emit.mock.calls.filter((args: unknown[]) => args[0] === 'presence:list'),
    ).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(1);
    socket.respond('presence:list', {
      ok: true,
      status: 'online',
      members: [{ memberId: organization, status: 'online' }],
      nextCursor: null,
    });
    await flush();
    expect(connection.presences().get(organization)).toBe('away');
    expect(connection.ownStatus()).toBe('online');
  });

  it('uses first-page acknowledgement time for cooldown and increases retry delay', async () => {
    const { connection, sockets }: { connection: RealtimeConnection; sockets: FakeSocket[] } =
      setup();
    connection.presenceChanges.subscribe();
    await flush();
    const socket: FakeSocket = sockets[0];
    socket.automatic = false;
    socket.trigger('hello', hello);
    await vi.advanceTimersByTimeAsync(4000);
    socket.respond('presence:list', { ok: false, code: 'request.invalid' });
    await flush();
    await vi.advanceTimersByTimeAsync(4999);
    expect(
      socket.emit.mock.calls.filter((args: unknown[]) => args[0] === 'presence:list'),
    ).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2);
    expect(
      socket.emit.mock.calls.filter((args: unknown[]) => args[0] === 'presence:list'),
    ).toHaveLength(2);
    socket.respond('presence:list', { ok: false, code: 'request.invalid' });
    await flush();
    await vi.advanceTimersByTimeAsync(9999);
    expect(
      socket.emit.mock.calls.filter((args: unknown[]) => args[0] === 'presence:list'),
    ).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(2);
    expect(
      socket.emit.mock.calls.filter((args: unknown[]) => args[0] === 'presence:list'),
    ).toHaveLength(3);
  });

  it('does not let an older snapshot overwrite an acknowledged choice', async () => {
    const { connection, sockets }: { connection: RealtimeConnection; sockets: FakeSocket[] } =
      setup();
    connection.presenceChanges.subscribe();
    await flush();
    const socket: FakeSocket = sockets[0];
    socket.automatic = false;
    socket.trigger('hello', hello);
    await flush();
    connection.setPresence('away');
    socket.respond('presence:set');
    await flush();
    socket.respond('presence:list', { ok: true, status: 'online', members: [], nextCursor: null });
    await flush();
    expect(connection.ownStatus()).toBe('away');
  });

  it('rolls an early refused choice back to the snapshot preference', async () => {
    const { connection, sockets }: { connection: RealtimeConnection; sockets: FakeSocket[] } =
      setup();
    connection.setPresence('invisible');
    await flush();
    const socket: FakeSocket = sockets[0];
    socket.automatic = false;
    socket.trigger('hello', hello);
    await flush();
    socket.respond('presence:list', { ok: true, status: 'away', members: [], nextCursor: null });
    await flush();
    expect(connection.ownStatus()).toBe('invisible');
    socket.respond('presence:set', { ok: false, code: 'request.invalid' });
    await flush();
    expect(connection.ownStatus()).toBe('away');
  });

  it('resends an unacknowledged choice on reconnect and resets on organization change', async () => {
    const {
      connection,
      sockets,
      organizationSignal,
    }: {
      connection: RealtimeConnection;
      sockets: FakeSocket[];
      organizationSignal: WritableSignal<string | null>;
    } = setup();
    connection.setPresence('away');
    await flush();
    sockets[0].automatic = false;
    sockets[0].trigger('hello', hello);
    await flush();
    sockets[0].trigger('disconnect');
    await vi.advanceTimersByTimeAsync(1000);
    await flush();
    const second: FakeSocket = sockets[1];
    second.automatic = false;
    second.trigger('hello', hello);
    await flush();
    expect(second.emit).toHaveBeenCalledWith(
      'presence:set',
      { status: 'away' },
      expect.any(Function),
    );
    organizationSignal.set('019a7002-3c4d-7e5f-8a6b-7c8d9e0f1a23');
    TestBed.tick();
    await flush();
    expect(connection.ownStatus()).toBeNull();
    expect(sockets[2].emit).not.toHaveBeenCalledWith(
      'presence:set',
      expect.anything(),
      expect.anything(),
    );
  });

  it('ignores a snapshot completion after teardown', async () => {
    const { connection, sockets }: { connection: RealtimeConnection; sockets: FakeSocket[] } =
      setup();
    connection.presenceChanges.subscribe();
    await flush();
    const socket: FakeSocket = sockets[0];
    socket.automatic = false;
    socket.trigger('hello', hello);
    await flush();
    TestBed.resetTestingModule();
    socket.respond('presence:list', { ok: true, status: 'away', members: [], nextCursor: null });
    await flush();
    expect(connection.ownStatus()).toBeNull();
  });

  it('validates and deduplicates personal notices by envelope id', async () => {
    const { connection, sockets }: { connection: RealtimeConnection; sockets: FakeSocket[] } =
      setup();
    const notices: Mock = vi.fn();
    connection.personalNotices.subscribe(notices);
    await flush();
    const socket: FakeSocket = sockets[0];
    socket.trigger('hello', hello);
    await flush();
    const notification: object = { ...change, type: 'notification.created.v1', data: {} };
    socket.trigger('change', notification);
    socket.trigger('change', notification);
    socket.trigger('change', {
      ...change,
      id: '019a7005-6f7a-7b8c-9d0e-1f2a3b4c5d50',
      type: 'reminder.due.v1',
      data: { reminderId: organization, taskId: organization },
    });
    socket.trigger('change', {
      ...change,
      id: '019a7005-6f7a-7b8c-9d0e-1f2a3b4c5d51',
      type: 'reminder.due.v1',
      data: { reminderId: 'invalid', taskId: organization },
    });
    socket.trigger('change', {
      ...change,
      id: '019a7005-6f7a-7b8c-9d0e-1f2a3b4c5d52',
      type: 'notification.created.v1',
      data: { unread: 2 },
    });
    expect(notices.mock.calls).toEqual([
      [{ type: 'notification.created.v1' }],
      [{ type: 'reminder.due.v1', reminderId: organization, taskId: organization }],
    ]);
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

  it('serializes simultaneous room joins and rejoins before notifying', async () => {
    const { connection, sockets }: { connection: RealtimeConnection; sockets: FakeSocket[] } =
      setup();
    connection.watch({ kind: 'task', taskKey: 'CAD-1' }).subscribe();
    connection.watch({ kind: 'task', taskKey: 'CAD-2' }).subscribe();
    const notified: Mock = vi.fn();
    connection.reconnected.subscribe(notified);
    await flush();
    const first: FakeSocket = sockets[0];
    first.automatic = false;
    first.trigger('hello', hello);
    await flush();
    expect(
      first.pending.filter((entry) => entry.name !== 'presence:list').map((entry) => entry.name),
    ).toEqual(['room:join']);
    first.respond('room:join');
    await flush();
    expect(
      first.pending.filter((entry) => entry.name !== 'presence:list').map((entry) => entry.name),
    ).toEqual(['room:join']);
    first.respond('room:join');
    await flush();
    expect(connection.status()).toBe('connected');
    first.trigger('disconnect');
    await vi.advanceTimersByTimeAsync(1000);
    await flush();
    const second: FakeSocket = sockets[1];
    second.automatic = false;
    second.trigger('hello', hello);
    await flush();
    second.respond('room:join');
    await flush();
    expect(notified).not.toHaveBeenCalled();
    second.respond('room:join');
    await flush();
    expect(notified).toHaveBeenCalledOnce();
    expect(second.emit.mock.invocationCallOrder[1]).toBeLessThan(
      notified.mock.invocationCallOrder[0],
    );
  });

  it('leaves a room after a pending join and retries a refused leave', async () => {
    const { connection, sockets }: { connection: RealtimeConnection; sockets: FakeSocket[] } =
      setup();
    const watch: Subscription = connection.watch({ kind: 'task', taskKey: 'CAD-1' }).subscribe();
    await flush();
    const socket: FakeSocket = sockets[0];
    socket.automatic = false;
    socket.trigger('hello', hello);
    await flush();
    watch.unsubscribe();
    socket.respond('room:join');
    await flush();
    expect(
      socket.pending.filter((entry) => entry.name !== 'presence:list').map((entry) => entry.name),
    ).toEqual(['room:leave']);
    socket.respond('room:leave', { ok: false, code: 'realtime.unavailable' });
    await vi.advanceTimersByTimeAsync(1000);
    await flush();
    expect(
      socket.pending.filter((entry) => entry.name !== 'presence:list').map((entry) => entry.name),
    ).toEqual(['room:leave']);
    socket.respond('room:leave');
    await flush();
    expect(socket.roomBusy).toBe(false);
  });

  it('does not send a presence preference until the user chooses one', async () => {
    const { connection, sockets }: { connection: RealtimeConnection; sockets: FakeSocket[] } =
      setup();
    expect(connection.ownStatus()).toBeNull();
    connection.presenceChanges.subscribe();
    await flush();
    const socket: FakeSocket = sockets[0];
    socket.trigger('hello', hello);
    await flush();
    expect(socket.emit).not.toHaveBeenCalledWith(
      'presence:set',
      expect.anything(),
      expect.anything(),
    );
    expect(connection.ownStatus()).toBe('online');
  });

  it('retries a transient presence refusal and rolls back a final refusal', async () => {
    const { connection, sockets }: { connection: RealtimeConnection; sockets: FakeSocket[] } =
      setup();
    connection.presenceChanges.subscribe();
    await flush();
    const socket: FakeSocket = sockets[0];
    socket.automatic = false;
    socket.trigger('hello', hello);
    await flush();
    connection.setPresence('away');
    socket.respond('presence:set', { ok: false, code: 'realtime.unavailable' });
    await vi.advanceTimersByTimeAsync(1000);
    await flush();
    expect(
      socket.emit.mock.calls.filter((args: unknown[]) => args[0] === 'presence:set'),
    ).toHaveLength(2);
    socket.respond('presence:set');
    await flush();
    connection.setPresence('invisible');
    socket.respond('presence:set', { ok: false, code: 'request.invalid' });
    await flush();
    expect(connection.ownStatus()).toBe('away');
  });

  it('stops retrying room operations when destroyed during backoff', async () => {
    const { connection, sockets }: { connection: RealtimeConnection; sockets: FakeSocket[] } =
      setup();
    connection.watch({ kind: 'task', taskKey: 'CAD-1' }).subscribe();
    await flush();
    const socket: FakeSocket = sockets[0];
    socket.automatic = false;
    socket.trigger('hello', hello);
    await flush();
    socket.respond('room:join', { ok: false, code: 'realtime.unavailable' });
    await flush();
    TestBed.resetTestingModule();
    await vi.advanceTimersByTimeAsync(2000);
    expect(
      socket.emit.mock.calls.filter((args: unknown[]) => args[0] === 'room:join'),
    ).toHaveLength(1);
    expect(socket.disconnect).toHaveBeenCalledOnce();
  });

  it('retries a refused ticket with a fresh request', async () => {
    const {
      connection,
      ticket,
      sockets,
    }: { connection: RealtimeConnection; ticket: Mock; sockets: FakeSocket[] } = setup();
    ticket.mockRejectedValueOnce(new Error('unavailable'));
    connection.presenceChanges.subscribe();
    await flush();
    expect(connection.status()).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(1000);
    await flush();
    expect(ticket).toHaveBeenCalledTimes(2);
    expect(sockets).toHaveLength(1);
  });

  it('retries when hello does not arrive before the admission timeout', async () => {
    const {
      connection,
      ticket,
      sockets,
    }: { connection: RealtimeConnection; ticket: Mock; sockets: FakeSocket[] } = setup();
    connection.presenceChanges.subscribe();
    await flush();
    await vi.advanceTimersByTimeAsync(8000);
    expect(sockets[0].disconnect).toHaveBeenCalledOnce();
    expect(connection.status()).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(1000);
    await flush();
    expect(ticket).toHaveBeenCalledTimes(2);
  });

  it('accepts case-insensitive organizations and notices with RFC 3339 offsets', async () => {
    const { connection, sockets }: { connection: RealtimeConnection; sockets: FakeSocket[] } =
      setup();
    const observer: Mock = vi.fn();
    connection.watch({ kind: 'task', taskKey: 'CAD-1' }).subscribe(observer);
    await flush();
    const socket: FakeSocket = sockets[0];
    socket.trigger('hello', {
      ...hello,
      data: {
        organizationId: organization.toUpperCase(),
        sessionExpiresAt: '2026-11-08T11:00:00Z',
        heartbeatIntervalSeconds: 10,
      },
    });
    await flush();
    socket.trigger('change', { ...change, at: '2026-11-08T11:40:00+01:00' });
    expect(connection.status()).toBe('connected');
    expect(observer).toHaveBeenCalledOnce();
  });

  it('retries an unacknowledged join even when the subscriber leaves', async () => {
    const { connection, sockets }: { connection: RealtimeConnection; sockets: FakeSocket[] } =
      setup();
    const watch: Subscription = connection.watch({ kind: 'task', taskKey: 'CAD-1' }).subscribe();
    await flush();
    const socket: FakeSocket = sockets[0];
    socket.automatic = false;
    socket.trigger('hello', hello);
    await flush();
    watch.unsubscribe();
    await vi.advanceTimersByTimeAsync(5000);
    await flush();
    socket.respond('room:join');
    await vi.advanceTimersByTimeAsync(1000);
    await flush();
    expect(
      socket.pending.filter((entry) => entry.name !== 'presence:list').map((entry) => entry.name),
    ).toEqual(['room:join']);
    socket.respond('room:join');
    await flush();
    expect(
      socket.pending.filter((entry) => entry.name !== 'presence:list').map((entry) => entry.name),
    ).toEqual(['room:leave']);
    socket.respond('room:leave');
    await flush();
    expect(connection.status()).toBe('connected');
  });

  it('keeps a slot reserved until a refused leave is acknowledged', async () => {
    const { connection, sockets }: { connection: RealtimeConnection; sockets: FakeSocket[] } =
      setup();
    const subscriptions: Subscription[] = [];
    for (let i: number = 1; i <= 32; i++)
      subscriptions.push(
        connection.watch({ kind: 'task', taskKey: `CAD-${String(i)}` }).subscribe(),
      );
    await flush();
    const socket: FakeSocket = sockets[0];
    socket.trigger('hello', hello);
    for (let i: number = 0; i < 20; i++) await flush();
    expect(connection.status()).toBe('connected');
    socket.automatic = false;
    subscriptions[0].unsubscribe();
    await flush();
    socket.respond('room:leave', { ok: false, code: 'realtime.unavailable' });
    await flush();
    const error: Mock = vi.fn();
    connection.watch({ kind: 'task', taskKey: 'CAD-33' }).subscribe({ error });
    expect(error).toHaveBeenCalledWith(new Error('room.limit-reached'));
    await vi.advanceTimersByTimeAsync(1000);
    await flush();
    socket.respond('room:leave');
    await flush();
    const nextError: Mock = vi.fn();
    connection.watch({ kind: 'task', taskKey: 'CAD-33' }).subscribe({ error: nextError });
    expect(nextError).not.toHaveBeenCalled();
  });

  it('reconnects active watches after the workspace organization changes', async () => {
    const {
      connection,
      sockets,
      ticket,
      organizationSignal,
    }: {
      connection: RealtimeConnection;
      sockets: FakeSocket[];
      ticket: Mock;
      organizationSignal: WritableSignal<string | null>;
    } = setup();
    const observer: Mock = vi.fn();
    connection.watch({ kind: 'task', taskKey: 'CAD-1' }).subscribe(observer);
    await flush();
    const oldSocket: FakeSocket = sockets[0];
    oldSocket.trigger('hello', hello);
    await flush();
    oldSocket.trigger('change', change);
    expect(observer).toHaveBeenCalledOnce();
    const next: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1c40';
    organizationSignal.set(next);
    TestBed.tick();
    await flush();
    expect(oldSocket.disconnect).toHaveBeenCalledOnce();
    expect(ticket).toHaveBeenCalledTimes(2);
    const socket: FakeSocket = sockets[1];
    socket.trigger('hello', {
      ...hello,
      data: {
        organizationId: next,
        sessionExpiresAt: '2026-11-08T11:00:00Z',
        heartbeatIntervalSeconds: 10,
      },
    });
    await flush();
    expect(socket.emit).toHaveBeenCalledWith(
      'room:join',
      { kind: 'task', taskKey: 'CAD-1' },
      expect.any(Function),
    );
    socket.trigger('change', change);
    expect(observer).toHaveBeenCalledTimes(2);
  });

  it('times out a hung ticket and ignores its late completion', async () => {
    const {
      connection,
      sockets,
      ticket,
    }: { connection: RealtimeConnection; sockets: FakeSocket[]; ticket: Mock } = setup();
    let resolveTicket: (token: string) => void = () => undefined;
    ticket.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveTicket = resolve;
      }),
    );
    connection.presenceChanges.subscribe();
    await vi.advanceTimersByTimeAsync(10000);
    expect(connection.status()).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(1000);
    await flush();
    resolveTicket('late');
    await flush();
    expect(ticket).toHaveBeenCalledTimes(2);
    expect(sockets).toHaveLength(1);
  });

  it('keeps the new ticket deadline when an old organization ticket resolves', async () => {
    const {
      connection,
      ticket,
      organizationSignal,
    }: {
      connection: RealtimeConnection;
      ticket: Mock;
      organizationSignal: WritableSignal<string | null>;
    } = setup();
    let resolveOld: (token: string) => void = () => undefined;
    ticket.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveOld = resolve;
      }),
    );
    ticket.mockReturnValueOnce(new Promise<string>(() => undefined));
    connection.presenceChanges.subscribe();
    await flush();
    organizationSignal.set('019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1c40');
    TestBed.tick();
    await flush();
    resolveOld('old-ticket');
    await flush();
    await vi.advanceTimersByTimeAsync(10000);
    expect(connection.status()).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(1000);
    await flush();
    expect(ticket).toHaveBeenCalledTimes(3);
  });

  it.each([401, 403, 404])('stops on terminal ticket status %s', async (status: number) => {
    const {
      connection,
      sockets,
      ticket,
      terminal,
    }: { connection: RealtimeConnection; sockets: FakeSocket[]; ticket: Mock; terminal: Mock } =
      setup();
    ticket.mockRejectedValueOnce(
      new HttpErrorResponse({ status, error: status === 404 ? { code: 'member.not-found' } : {} }),
    );
    connection.presenceChanges.subscribe();
    await flush();
    expect(connection.status()).toBe('disabled');
    expect(terminal).toHaveBeenCalledWith(status === 401 ? 401 : 403);
    await vi.advanceTimersByTimeAsync(60000);
    expect(ticket).toHaveBeenCalledOnce();
    expect(sockets).toHaveLength(0);
  });

  it('stops after a revoked socket receives a 401 ticket rejection', async () => {
    const {
      connection,
      sockets,
      ticket,
      terminal,
    }: { connection: RealtimeConnection; sockets: FakeSocket[]; ticket: Mock; terminal: Mock } =
      setup();
    connection.presenceChanges.subscribe();
    await flush();
    sockets[0].trigger('hello', hello);
    await flush();
    ticket.mockRejectedValueOnce(new HttpErrorResponse({ status: 401 }));
    sockets[0].trigger('disconnect', 'io server disconnect');
    await vi.advanceTimersByTimeAsync(1000);
    await flush();
    expect(connection.status()).toBe('disabled');
    expect(terminal).toHaveBeenCalledWith(401);
    await vi.advanceTimersByTimeAsync(60000);
    expect(ticket).toHaveBeenCalledTimes(2);
  });

  it('reports an unexpected hello organization once without retrying', async () => {
    const {
      connection,
      sockets,
      ticket,
    }: { connection: RealtimeConnection; sockets: FakeSocket[]; ticket: Mock } = setup();
    const changed: Mock = vi.fn();
    TestBed.inject(OrganizationPin).contextChanged.subscribe(changed);
    connection.presenceChanges.subscribe();
    await flush();
    sockets[0].trigger('hello', {
      ...hello,
      data: {
        organizationId: 'other',
        sessionExpiresAt: '2026-11-08T11:00:00Z',
        heartbeatIntervalSeconds: 10,
      },
    });
    await vi.advanceTimersByTimeAsync(60000);
    expect(changed).toHaveBeenCalledOnce();
    expect(ticket).toHaveBeenCalledOnce();
    expect(connection.status()).toBe('disabled');
  });
});
