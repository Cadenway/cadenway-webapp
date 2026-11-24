import {
  DestroyRef,
  inject,
  Service,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subject, type Subscription } from 'rxjs';
import { io, type Socket } from 'socket.io-client';

import { type ApiProblem, OrganizationPin, readProblem } from '@core/api';
import { RuntimeConfigStore } from '@core/config';

import { heartbeatInterval, parseChange, parsePresence } from './realtime-protocol.util';
import {
  REALTIME_ORGANIZATION,
  REALTIME_TERMINAL_FAILURE,
  REALTIME_TICKET_SOURCE,
} from './realtime.token';
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
   * @type {WritableSignal<PresenceStatus | null>}
   * @readonly
   */
  private readonly preference: WritableSignal<PresenceStatus | null> =
    signal<PresenceStatus | null>(null);

  /**
   * Property pin
   *
   * @description
   * Reports a gateway admission for the wrong organization.
   *
   * @type {OrganizationPin}
   * @readonly
   */
  private readonly pin: OrganizationPin = inject(OrganizationPin);

  /**
   * Property terminalFailure
   *
   * @description
   * Workspace-owned navigation after session or membership rejection.
   *
   * @type {((status: 401 | 403) => void) | null}
   * @readonly
   */
  private readonly terminalFailure: ((status: 401 | 403) => void) | null = inject(
    REALTIME_TERMINAL_FAILURE,
    { optional: true },
  );

  /**
   * Property boundOrganization
   *
   * @description
   * Organization associated with the current or most recent connection attempt.
   *
   * @type {string | null}
   */
  private boundOrganization: string | null = null;

  /**
   * Property terminal
   *
   * @description
   * Whether a terminal ticket rejection stopped reconnection.
   *
   * @type {boolean}
   */
  private terminal: boolean = false;

  /**
   * Property ticketTimer
   *
   * @description
   * Deadline for the current ticket request.
   *
   * @type {ReturnType<typeof setTimeout> | undefined}
   */
  private ticketTimer: ReturnType<typeof setTimeout> | undefined = undefined;

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
   * Property roomQueue
   *
   * @description
   * Serializes gateway room changes on the current socket.
   *
   * @type {Promise<void>}
   */
  private roomQueue: Promise<void> = Promise.resolve();

  /**
   * Property presencePending
   *
   * @description
   * Serializes user presence changes on the current socket.
   *
   * @type {Promise<void> | undefined}
   */
  private presencePending: Promise<void> | undefined = undefined;

  /**
   * Property confirmedPresence
   *
   * @description
   * Last status acknowledged for this tab.
   *
   * @type {PresenceStatus | null}
   */
  private confirmedPresence: PresenceStatus | null = null;

  /**
   * Property presenceHandledVersion
   *
   * @description
   * Latest choice whose acknowledgement or final refusal has been processed.
   *
   * @type {number}
   */
  private presenceHandledVersion: number = 0;

  /**
   * Property presenceVersion
   *
   * @description
   * Distinguishes a new choice from an earlier pending one.
   *
   * @type {number}
   */
  private presenceVersion: number = 0;

  /**
   * Property waits
   *
   * @description
   * Cancellable retry delays for the current socket.
   *
   * @type {Map<ReturnType<typeof setTimeout>, () => void>}
   */
  private waits: Map<ReturnType<typeof setTimeout>, () => void> = new Map<
    ReturnType<typeof setTimeout>,
    () => void
  >();

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
   * @type {Signal<PresenceStatus | null>}
   * @readonly
   */
  public readonly ownStatus: Signal<PresenceStatus | null> = this.preference.asReadonly();

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
    const commits: Subscription = this.pin.organizationChanges.subscribe(() => {
      this.organizationChanged(this.organization());
    });
    this.destroyRef.onDestroy(() => {
      commits.unsubscribe();
    });
    const organizations: Subscription = toObservable(this.organization).subscribe(
      (organization: string | null) => {
        this.organizationChanged(organization);
      },
    );
    this.destroyRef.onDestroy(() => {
      organizations.unsubscribe();
    });
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
        if (this.heartbeat && this.socket)
          void this.queueRoom(key, entry, this.socket, this.generation);
      }
      entry.count++;
      const current: RoomEntry = entry;
      const subscription: Subscription = current.changes.subscribe(subscriber);
      this.start();
      return () => {
        subscription.unsubscribe();
        current.count--;
        if (current.count === 0 && this.rooms.get(key) === current) {
          if (this.heartbeat && this.socket) {
            void this.queueRoom(key, current, this.socket, this.generation);
          } else {
            this.rooms.delete(key);
            current.changes.complete();
          }
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
    this.presenceVersion++;
    if (!this.url) return;
    this.start();
    if (this.heartbeat && this.socket) void this.syncPresence(this.socket, this.generation);
  }

  /**
   * Method organizationChanged
   *
   * @description
   * Invalidates the old socket and reconnects watched rooms for the new workspace organization.
   *
   * @param {string | null} organization - Newly committed organization.
   */
  private organizationChanged(organization: string | null): void {
    if (this.destroyed || !this.started || this.terminal || organization === this.boundOrganization)
      return;
    this.boundOrganization = organization;
    this.generation++;
    clearTimeout(this.retryTimer);
    this.closeSocket();
    this.seen.clear();
    this.confirmedPresence = null;
    for (const [key, entry] of this.rooms) {
      entry.joined = false;
      if (entry.count === 0) {
        this.rooms.delete(key);
        entry.changes.complete();
      }
    }
    this.attempt = 0;
    if (organization) {
      this.state.set('reconnecting');
      void this.connect();
    } else this.state.set('disabled');
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
    this.boundOrganization = this.organization();
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
      const token: string = await Promise.race([
        this.ticket(),
        new Promise<string>((_resolve, reject) => {
          this.ticketTimer = setTimeout(() => {
            reject(new Error('Realtime ticket timeout.'));
          }, 10000);
        }),
      ]);
      if (this.destroyed || generation !== this.generation || !this.url) return;
      clearTimeout(this.ticketTimer);
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
    } catch (error: unknown) {
      if (generation !== this.generation || this.destroyed) return;
      clearTimeout(this.ticketTimer);
      const problem: ApiProblem | null = readProblem(error);
      if (
        problem?.status === 401 ||
        problem?.status === 403 ||
        problem?.code === 'member.not-found' ||
        problem?.code === 'organization.not-found'
      ) {
        this.terminal = true;
        this.generation++;
        this.closeSocket();
        this.state.set('disabled');
        this.terminalFailure?.(problem.status === 401 ? 401 : 403);
        return;
      }
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
      if (
        hello &&
        typeof hello === 'object' &&
        'data' in hello &&
        hello.data &&
        typeof hello.data === 'object' &&
        'organizationId' in hello.data &&
        typeof hello.data.organizationId === 'string' &&
        this.organization() &&
        hello.data.organizationId.toLowerCase() !== this.organization()?.toLowerCase()
      ) {
        this.generation++;
        this.closeSocket();
        this.state.set('disabled');
        this.pin.notifyContextChanged();
        return;
      }
      this.failed(generation);
      return;
    }
    clearTimeout(this.admissionTimer);
    this.heartbeat = setInterval(() => socket.volatile.emit('presence:heartbeat', {}), cadence);
    const presence: Promise<void> = this.syncPresence(socket, generation);
    while (generation === this.generation) {
      const pending: [string, RoomEntry][] = [...this.rooms].filter(
        ([, entry]: [string, RoomEntry]) => !entry.joined,
      );
      if (pending.length === 0) break;
      await Promise.all(
        pending.map(([key, entry]: [string, RoomEntry]) =>
          this.queueRoom(key, entry, socket, generation),
        ),
      );
    }
    if (generation !== this.generation) return;
    await presence;
    if (generation !== this.generation) return;
    this.state.set('connected');
    this.attempt = 0;
    if (this.everConnected) this.reconnects.next();
    this.everConnected = true;
  }

  /**
   * Method queueRoom
   *
   * @description
   * Serializes reconciliation of one room with all other room mutations on this socket.
   *
   * @param {string} key - Local room key.
   * @param {RoomEntry} entry - Reference-counted room state.
   * @param {Socket} socket - Current transport.
   * @param {number} generation - Identity of the connection attempt.
   * @returns {Promise<void>} Completion of the queued reconciliation.
   */
  private queueRoom(
    key: string,
    entry: RoomEntry,
    socket: Socket,
    generation: number,
  ): Promise<void> {
    const queued: Promise<void> = this.roomQueue.then(() =>
      this.reconcileRoom(key, entry, socket, generation),
    );
    this.roomQueue = queued;
    return queued;
  }

  /**
   * Method reconcileRoom
   *
   * @description
   * Retries transient failures and retains an unacknowledged leave in the local room count.
   *
   * @param {string} key - Local room key.
   * @param {RoomEntry} entry - Reference-counted room state.
   * @param {Socket} socket - Current transport.
   * @param {number} generation - Identity of the connection attempt.
   * @returns {Promise<void>} Completion of this reconciliation.
   */
  private async reconcileRoom(
    key: string,
    entry: RoomEntry,
    socket: Socket,
    generation: number,
  ): Promise<void> {
    let operation: boolean | null = null;
    while (generation === this.generation && !this.destroyed && this.rooms.get(key) === entry) {
      if (operation === null && entry.count === 0 && !entry.joined) {
        this.rooms.delete(key);
        entry.changes.complete();
        return;
      }
      if (operation === null && entry.count > 0 && entry.joined) return;
      const joining: boolean = operation ?? entry.count > 0;
      operation = joining;
      try {
        await this.ack(socket, joining ? 'room:join' : 'room:leave', entry.room);
        if (generation !== this.generation) return;
        entry.joined = joining;
        operation = null;
      } catch (error: unknown) {
        if (generation !== this.generation) return;
        if (
          joining &&
          error instanceof Error &&
          ['room.not-found', 'request.invalid', 'room.limit-reached'].includes(error.message)
        ) {
          this.rooms.delete(key);
          entry.changes.error(error);
          return;
        }
        await this.wait(1000);
      }
    }
  }

  /**
   * Method syncPresence
   *
   * @description
   * Sends a chosen preference once at a time, retries transient refusals and rolls back final ones.
   *
   * @param {Socket} socket - Admitted transport.
   * @param {number} generation - Identity of the connection attempt.
   * @returns {Promise<void>} Completion of pending preference changes.
   */
  private syncPresence(socket: Socket, generation: number): Promise<void> {
    if (this.presencePending) return this.presencePending;
    if (this.preference() === null) return Promise.resolve();
    const pending: Promise<void> = this.applyPresence(socket, generation);
    this.presencePending = pending;
    void pending.then(() => {
      if (this.presencePending === pending) {
        this.presencePending = undefined;
        if (
          generation === this.generation &&
          !this.destroyed &&
          this.preference() !== null &&
          this.presenceVersion !== this.presenceHandledVersion
        )
          void this.syncPresence(socket, generation);
      }
    });
    return pending;
  }

  /**
   * Method applyPresence
   *
   * @description
   * Applies the latest choice while preserving a confirmed value across retries.
   *
   * @param {Socket} socket - Admitted transport.
   * @param {number} generation - Identity of the connection attempt.
   * @returns {Promise<void>} Completion of the latest presence change.
   */
  private async applyPresence(socket: Socket, generation: number): Promise<void> {
    while (generation === this.generation && !this.destroyed) {
      const status: PresenceStatus | null = this.preference();
      if (status === null) return;
      const version: number = this.presenceVersion;
      try {
        await this.ack(socket, 'presence:set', { status });
        if (generation !== this.generation) return;
        this.confirmedPresence = status;
      } catch (error: unknown) {
        if (generation !== this.generation) return;
        if (!(error instanceof Error) || error.message === 'realtime.unavailable') {
          await this.wait(1000);
          continue;
        }
        if (version === this.presenceVersion) this.preference.set(this.confirmedPresence);
      }
      if (version === this.presenceVersion) {
        this.presenceHandledVersion = version;
        return;
      }
    }
  }

  /**
   * Method wait
   *
   * @description
   * Delays a retry and can be released immediately when the connection closes.
   *
   * @param {number} milliseconds - Delay before retry.
   * @returns {Promise<void>} Completion or cancellation of the delay.
   */
  private wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
        this.waits.delete(timer);
        resolve();
      }, milliseconds);
      this.waits.set(timer, resolve);
    });
  }

  /**
   * Method ack
   *
   * @description
   * Waits at most five seconds for a gateway acknowledgement.
   *
   * @param {Socket} socket - Current transport.
   * @param {string} event - Client event name.
   * @param {unknown} payload - Client event payload.
   * @returns {Promise<void>} Completion or acknowledgement failure.
   */
  private ack(socket: Socket, event: string, payload: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      socket.timeout(5000).emit(event, payload, (error: Error | null, ack: unknown) => {
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
    if (generation !== this.generation) return;
    this.generation++;
    this.closeSocket();
    for (const [key, entry] of this.rooms) {
      entry.joined = false;
      if (entry.count === 0) {
        this.rooms.delete(key);
        entry.changes.complete();
      }
    }
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
    clearTimeout(this.ticketTimer);
    clearInterval(this.heartbeat);
    this.heartbeat = undefined;
    for (const [timer, resolve] of this.waits) {
      clearTimeout(timer);
      resolve();
    }
    this.waits.clear();
    this.roomQueue = Promise.resolve();
    this.presencePending = undefined;
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
