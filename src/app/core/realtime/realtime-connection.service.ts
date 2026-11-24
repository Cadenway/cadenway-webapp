import {
  DestroyRef,
  inject,
  Service,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { EMPTY, Observable, Subject, type Subscription } from 'rxjs';
import { io, type Socket } from 'socket.io-client';

import { RuntimeConfigStore } from '@core/config';

import { heartbeatInterval, parseChange, parsePresence } from './realtime-protocol.util';
import { REALTIME_ORGANIZATION, REALTIME_TICKET_SOURCE } from './realtime.token';
import {
  type MemberPresenceChange,
  type PresenceStatus,
  type RealtimeChange,
  type RealtimeRoom,
} from './realtime.types';

/**
 * Interface RoomEntry
 *
 * @description
 * A shared subscription and its current gateway admission.
 *
 */
interface RoomEntry {
  // #region Properties
  /**
   * Property room
   *
   * @description
   * Resource selection.
   *
   * @type {RealtimeRoom}
   */
  room: RealtimeRoom;

  /**
   * Property changes
   *
   * @description
   * Subscribers to invalidations.
   *
   * @type {Subject<RealtimeChange>}
   */
  changes: Subject<RealtimeChange>;

  /**
   * Property count
   *
   * @description
   * Active subscriber count.
   *
   * @type {number}
   */
  count: number;

  /**
   * Property joined
   *
   * @description
   * Whether this connection has joined.
   *
   * @type {boolean}
   */
  joined: boolean;
  // #endregion
}

/**
 * Service RealtimeConnection
 *
 * @description
 * Shares one authenticated Socket.IO connection and its resource subscriptions within a workspace.
 */
@Service({ autoProvided: false })
export class RealtimeConnection {
  // #region Properties
  /**
   * Property config
   *
   * @description
   * Runtime configuration determines whether realtime is enabled.
   *
   * @type {RuntimeConfigStore}
   * @readonly
   */
  private readonly config: InstanceType<typeof RuntimeConfigStore> = inject(RuntimeConfigStore);

  /**
   * Property ticket
   *
   * @description
   * Supplies a fresh credential for each attempt.
   *
   * @type {() => Promise<string>}
   * @readonly
   */
  private readonly ticket: () => Promise<string> = inject(REALTIME_TICKET_SOURCE);

  /**
   * Property organization
   *
   * @description
   * Expected organization of an admitted socket.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  private readonly organization: Signal<string | null> = inject(REALTIME_ORGANIZATION);

  /**
   * Property destroyRef
   *
   * @description
   * Owns connection cleanup.
   *
   * @type {DestroyRef}
   * @readonly
   */
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /**
   * Property url
   *
   * @description
   * Configured gateway origin, or undefined when disabled.
   *
   * @type {string | undefined}
   * @readonly
   */
  private readonly url: string | undefined = this.config.config().realtimeUrl;

  /**
   * Property state
   *
   * @description
   * Current connection state.
   *
   * @type {WritableSignal<'disabled' | 'connecting' | 'connected' | 'reconnecting'>}
   * @readonly
   */
  private readonly state: WritableSignal<'disabled' | 'connecting' | 'connected' | 'reconnecting'> =
    signal(this.url ? 'connecting' : 'disabled');

  /**
   * Property preference
   *
   * @description
   * Presence retained across reconnects.
   *
   * @type {WritableSignal<PresenceStatus>}
   * @readonly
   */
  private readonly preference: WritableSignal<PresenceStatus> = signal<PresenceStatus>('online');

  /**
   * Property rooms
   *
   * @description
   * Reference-counted room registrations.
   *
   * @type {Map<string, RoomEntry>}
   * @readonly
   */
  private readonly rooms: Map<string, RoomEntry> = new Map<string, RoomEntry>();

  /**
   * Property presence
   *
   * @description
   * Validated organization presence notices.
   *
   * @type {Subject<MemberPresenceChange>}
   * @readonly
   */
  private readonly presence: Subject<MemberPresenceChange> = new Subject<MemberPresenceChange>();

  /**
   * Property reconnects
   *
   * @description
   * Completed reconnection notifications.
   *
   * @type {Subject<void>}
   * @readonly
   */
  private readonly reconnects: Subject<void> = new Subject<void>();

  /**
   * Property seen
   *
   * @description
   * Most recent browser notice IDs.
   *
   * @type {Set<string>}
   * @readonly
   */
  private readonly seen: Set<string> = new Set<string>();

  /**
   * Property socket
   *
   * @description
   * Current transport, if an attempt has started.
   *
   * @type {Socket | undefined}
   */
  private socket: Socket | undefined = undefined;

  /**
   * Property retryTimer
   *
   * @description
   * Scheduled reconnection attempt.
   *
   * @type {ReturnType<typeof setTimeout> | undefined}
   */
  private retryTimer: ReturnType<typeof setTimeout> | undefined = undefined;

  /**
   * Property admissionTimer
   *
   * @description
   * Deadline for gateway hello.
   *
   * @type {ReturnType<typeof setTimeout> | undefined}
   */
  private admissionTimer: ReturnType<typeof setTimeout> | undefined = undefined;

  /**
   * Property heartbeat
   *
   * @description
   * Presence lease refresh timer.
   *
   * @type {ReturnType<typeof setInterval> | undefined}
   */
  private heartbeat: ReturnType<typeof setInterval> | undefined = undefined;

  /**
   * Property attempt
   *
   * @description
   * Consecutive failed connection attempts.
   *
   * @type {number}
   */
  private attempt: number = 0;

  /**
   * Property generation
   *
   * @description
   * Invalidates callbacks from obsolete attempts.
   *
   * @type {number}
   */
  private generation: number = 0;

  /**
   * Property started
   *
   * @description
   * Whether lazy connection has been requested.
   *
   * @type {boolean}
   */
  private started: boolean = false;

  /**
   * Property destroyed
   *
   * @description
   * Whether the owning injector was destroyed.
   *
   * @type {boolean}
   */
  private destroyed: boolean = false;

  /**
   * Property everConnected
   *
   * @description
   * Whether an earlier connection completed admission.
   *
   * @type {boolean}
   */
  private everConnected: boolean = false;

  /**
   * Property status
   *
   * @description
   * Connection status; disabled when no gateway is configured.
   *
   * @type {Signal<'disabled' | 'connecting' | 'connected' | 'reconnecting'>}
   * @readonly
   */
  public readonly status: Signal<'disabled' | 'connecting' | 'connected' | 'reconnecting'> =
    this.state.asReadonly();

  /**
   * Property ownStatus
   *
   * @description
   * Current local presence preference.
   *
   * @type {Signal<PresenceStatus>}
   * @readonly
   */
  public readonly ownStatus: Signal<PresenceStatus> = this.preference.asReadonly();

  /**
   * Property reconnected
   *
   * @description
   * Emits after reconnection and room re-admission.
   *
   * @type {Observable<void>}
   * @readonly
   */
  public readonly reconnected: Observable<void> = this.reconnects.asObservable();

  /**
   * Property presenceChanges
   *
   * @description
   * Organization presence changes; subscribing starts the connection.
   *
   * @type {Observable<MemberPresenceChange>}
   * @readonly
   */
  public readonly presenceChanges: Observable<MemberPresenceChange> = this.url
    ? new Observable((subscriber) => {
        this.start();
        return this.presence.subscribe(subscriber);
      })
    : EMPTY;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Registers teardown with the workspace injector.
   *
   * @constructor
   */
  public constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroy();
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method watch
   *
   * @description
   * Joins a resource while subscribed. Notices are broadcast to all active watches: the gateway
   * envelope does not identify the delivering room, so consumers must filter or refetch.
   * A failed join errors subscribers with the gateway acknowledgement code.
   *
   * @param {RealtimeRoom} room - Resource selection to join.
   * @returns {Observable<RealtimeChange>} Deduplicated browser invalidations.
   */
  public watch(room: RealtimeRoom): Observable<RealtimeChange> {
    if (!this.url) return EMPTY;
    return new Observable((subscriber) => {
      const key: string = room.kind === 'task' ? `task:${room.taskKey}` : `list:${room.listId}`;
      let entry: RoomEntry | undefined = this.rooms.get(key);
      if (!entry) {
        if (this.rooms.size >= 32) {
          subscriber.error(new Error('room.limit-reached'));
          return undefined;
        }
        entry = { room, changes: new Subject<RealtimeChange>(), count: 0, joined: false };
        this.rooms.set(key, entry);
        if (this.state() === 'connected' && this.socket)
          void this.join(key, entry, this.socket, this.generation);
      }
      entry.count++;
      const current: RoomEntry = entry;
      const subscription: Subscription = current.changes.subscribe(subscriber);
      this.start();
      return () => {
        subscription.unsubscribe();
        current.count--;
        if (current.count === 0 && this.rooms.get(key) === current) {
          this.rooms.delete(key);
          if (current.joined && this.socket)
            void this.ack(this.socket, 'room:leave', current.room).catch(() => undefined);
          current.changes.complete();
        }
      };
    });
  }

  /**
   * Method setPresence
   *
   * @description
   * Stores the preference and sends it now or after admission.
   *
   * @param {PresenceStatus} status - Desired private presence.
   */
  public setPresence(status: PresenceStatus): void {
    this.preference.set(status);
    if (!this.url) return;
    this.start();
    if (this.state() === 'connected' && this.socket) this.socket.emit('presence:set', { status });
  }

  /**
   * Method start
   *
   * @description
   * Starts the first connection once, on demand.
   */
  private start(): void {
    if (this.started || this.destroyed || !this.url) return;
    this.started = true;
    void this.connect();
  }

  /**
   * Method connect
   *
   * @description
   * Obtains a new ticket and begins one bounded handshake attempt.
   *
   * @returns {Promise<void>} Completion of ticket acquisition and socket setup.
   */
  private async connect(): Promise<void> {
    const generation: number = ++this.generation;
    try {
      const token: string = await this.ticket();
      if (this.destroyed || generation !== this.generation || !this.url) return;
      const socket: Socket = io(new URL(this.url).origin, {
        auth: { token },
        autoConnect: false,
        forceNew: true,
        reconnection: false,
        timeout: 8000,
        transports: ['websocket'],
      });
      this.socket = socket;
      const fail: () => void = () => {
        this.failed(generation);
      };
      this.admissionTimer = setTimeout(fail, 8000);
      socket.once('connect_error', fail);
      socket.once('disconnect', fail);
      socket.once('hello', (hello: unknown) => {
        void this.admit(socket, generation, hello);
      });
      socket.on('change', (notice: unknown) => {
        if (generation === this.generation && this.heartbeat) this.receive(notice);
      });
      socket.connect();
    } catch {
      this.failed(generation);
    }
  }

  /**
   * Method admit
   *
   * @description
   * Validates hello, starts heartbeats, restores presence and rejoins watched rooms.
   *
   * @param {Socket} socket - Socket awaiting admission.
   * @param {number} generation - Identity of the connection attempt.
   * @param {unknown} hello - Untrusted gateway hello.
   * @returns {Promise<void>} Completion of room admissions.
   */
  private async admit(socket: Socket, generation: number, hello: unknown): Promise<void> {
    const cadence: number | null = heartbeatInterval(hello, this.organization());
    if (cadence === null) {
      this.failed(generation);
      return;
    }
    clearTimeout(this.admissionTimer);
    this.heartbeat = setInterval(() => socket.volatile.emit('presence:heartbeat', {}), cadence);
    socket.emit('presence:set', { status: this.preference() });
    while (generation === this.generation) {
      const pending: [string, RoomEntry][] = [...this.rooms].filter(
        ([, entry]: [string, RoomEntry]) => !entry.joined,
      );
      if (pending.length === 0) break;
      await Promise.all(
        pending.map(([key, entry]: [string, RoomEntry]) =>
          this.join(key, entry, socket, generation),
        ),
      );
    }
    if (generation !== this.generation || this.destroyed) return;
    socket.emit('presence:set', { status: this.preference() });
    this.state.set('connected');
    this.attempt = 0;
    if (this.everConnected) this.reconnects.next();
    this.everConnected = true;
  }

  /**
   * Method join
   *
   * @description
   * Joins a room and rejects its observers if the gateway refuses it.
   *
   * @param {string} key - Local room key.
   * @param {RoomEntry} entry - Shared room state.
   * @param {Socket} socket - Current transport.
   * @param {number} generation - Identity of the connection attempt.
   * @returns {Promise<void>} Completion of the join acknowledgement.
   */
  private async join(
    key: string,
    entry: RoomEntry,
    socket: Socket,
    generation: number,
  ): Promise<void> {
    try {
      await this.ack(socket, 'room:join', entry.room);
      if (generation !== this.generation) return;
      if (this.rooms.get(key) !== entry) {
        if (!this.rooms.has(key))
          void this.ack(socket, 'room:leave', entry.room).catch(() => undefined);
        return;
      }
      entry.joined = true;
    } catch (error: unknown) {
      if (generation !== this.generation || this.rooms.get(key) !== entry) return;
      this.rooms.delete(key);
      entry.changes.error(error);
    }
  }

  /**
   * Method ack
   *
   * @description
   * Waits at most five seconds for a gateway acknowledgement.
   *
   * @param {Socket} socket - Current transport.
   * @param {string} event - Client event name.
   * @param {RealtimeRoom} room - Room selection.
   * @returns {Promise<void>} Completion or acknowledgement failure.
   */
  private ack(socket: Socket, event: string, room: RealtimeRoom): Promise<void> {
    return new Promise((resolve, reject) => {
      socket.timeout(5000).emit(event, room, (error: Error | null, ack: unknown) => {
        if (error) {
          reject(new Error('realtime.unavailable'));
          return;
        }
        if (ack && typeof ack === 'object' && 'ok' in ack && ack.ok === true) {
          resolve();
          return;
        }
        const code: unknown =
          ack && typeof ack === 'object' && 'code' in ack ? ack.code : undefined;
        reject(new Error(typeof code === 'string' ? code : 'realtime.unavailable'));
      });
    });
  }

  /**
   * Method receive
   *
   * @description
   * Validates and deduplicates notices before broadcasting to subscribers.
   *
   * @param {unknown} notice - Untrusted gateway packet.
   */
  private receive(notice: unknown): void {
    const change: RealtimeChange | null = parseChange(notice);
    const presence: MemberPresenceChange | null = parsePresence(notice);
    if (
      (!change && !presence) ||
      !notice ||
      typeof notice !== 'object' ||
      !('id' in notice) ||
      typeof notice.id !== 'string' ||
      this.seen.has(notice.id)
    )
      return;
    if (this.seen.size === 128) this.seen.delete(this.seen.values().next().value ?? '');
    this.seen.add(notice.id);
    if (presence) this.presence.next(presence);
    if (change) for (const entry of this.rooms.values()) entry.changes.next(change);
  }

  /**
   * Method failed
   *
   * @description
   * Tears down a failed attempt and schedules the next fresh-ticket attempt.
   *
   * @param {number} generation - Identity of the failed attempt.
   */
  private failed(generation: number): void {
    if (generation !== this.generation || this.destroyed) return;
    this.generation++;
    this.closeSocket();
    for (const entry of this.rooms.values()) entry.joined = false;
    this.state.set('reconnecting');
    const delays: readonly number[] = [1000, 2000, 5000, 10000, 30000];
    const delay: number = delays[Math.min(this.attempt++, delays.length - 1)] ?? 30000;
    this.retryTimer = setTimeout(() => {
      void this.connect();
    }, delay);
  }

  /**
   * Method closeSocket
   *
   * @description
   * Clears timers and removes transport listeners before disconnecting.
   */
  private closeSocket(): void {
    clearTimeout(this.admissionTimer);
    clearInterval(this.heartbeat);
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = undefined;
  }

  /**
   * Method destroy
   *
   * @description
   * Stops retry and completes every observer when the workspace is destroyed.
   */
  private destroy(): void {
    this.destroyed = true;
    this.generation++;
    clearTimeout(this.retryTimer);
    this.closeSocket();
    for (const entry of this.rooms.values()) entry.changes.complete();
    this.rooms.clear();
    this.presence.complete();
    this.reconnects.complete();
  }
  // #endregion
}
