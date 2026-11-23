import { defer, Observable, retry, switchMap } from 'rxjs';
import { io, type Socket } from 'socket.io-client';

/**
 * Constant TASK_NOTICES
 *
 * @description
 * Browser protocol notices that can invalidate the detail of a joined task.
 *
 * @type {ReadonlySet<string>}
 */
const TASK_NOTICES: ReadonlySet<string> = new Set([
  'task.updated.v1',
  'task.status-changed.v1',
  'comment.created.v1',
  'git.links-changed.v1',
]);

/**
 * Function observeTaskRoom
 *
 * @description
 * Emits refresh signals after subscription and on new notices. Each reconnect obtains a fresh
 * ticket and joins again. Packet payloads never enter business state.
 *
 * @param {URL} origin - The configured Realtime origin.
 * @param {string} organizationId - The organization already bound to the browser route.
 * @param {string} taskKey - The key resolved by the Realtime authority on each join.
 * @param {() => Observable<string>} ticket - Loads one single-use handshake credential.
 * @returns {Observable<void>} A connection scoped to the caller's subscription.
 */
export function observeTaskRoom(
  origin: URL,
  organizationId: string,
  taskKey: string,
  ticket: () => Observable<string>,
): Observable<void> {
  return defer(ticket).pipe(
    switchMap(
      (token) =>
        new Observable<void>((subscriber) => {
          const socket: Socket = io(origin.origin, {
            auth: { token },
            autoConnect: false,
            forceNew: true,
            reconnection: false,
            timeout: 8_000,
            transports: ['websocket'],
          });
          const fail: () => void = () => {
            subscriber.error(new Error('Realtime transport closed.'));
          };
          const admission: ReturnType<typeof setTimeout> = setTimeout(fail, 8_000);
          let heartbeat: ReturnType<typeof setInterval> | undefined;
          let joined: boolean = false;
          const seen: Set<string> = new Set<string>();

          socket.once('connect_error', fail);
          socket.once('disconnect', fail);
          socket.once('hello', (hello: unknown) => {
            if (
              !hello ||
              typeof hello !== 'object' ||
              !('type' in hello) ||
              hello.type !== 'connection.ready.v1' ||
              !('data' in hello)
            ) {
              subscriber.complete();
              return;
            }
            const data: unknown = hello.data;
            if (
              !data ||
              typeof data !== 'object' ||
              !('organizationId' in data) ||
              data.organizationId !== organizationId ||
              !('heartbeatIntervalSeconds' in data) ||
              typeof data.heartbeatIntervalSeconds !== 'number' ||
              !Number.isSafeInteger(data.heartbeatIntervalSeconds) ||
              data.heartbeatIntervalSeconds < 1 ||
              data.heartbeatIntervalSeconds > 3_600
            ) {
              subscriber.complete();
              return;
            }
            const cadence: number = data.heartbeatIntervalSeconds * 500;
            heartbeat = setInterval(() => socket.volatile.emit('presence:heartbeat', {}), cadence);
            socket
              .timeout(5_000)
              .emit('room:join', { kind: 'task', taskKey }, (error: Error | null, ack: unknown) => {
                if (subscriber.closed) return;
                clearTimeout(admission);
                if (
                  error ||
                  (ack &&
                    typeof ack === 'object' &&
                    'code' in ack &&
                    ack.code === 'realtime.unavailable')
                ) {
                  fail();
                  return;
                }
                if (!ack || typeof ack !== 'object' || !('ok' in ack) || ack.ok !== true) {
                  subscriber.complete();
                  return;
                }
                joined = true;
                subscriber.next();
              });
          });
          socket.on('change', (notice: unknown) => {
            if (!joined || !notice || typeof notice !== 'object') return;
            if (
              !('type' in notice) ||
              typeof notice.type !== 'string' ||
              !TASK_NOTICES.has(notice.type) ||
              !('id' in notice) ||
              typeof notice.id !== 'string' ||
              notice.id.length > 100 ||
              seen.has(notice.id)
            ) {
              return;
            }
            if (seen.size === 128) seen.clear();
            seen.add(notice.id);
            subscriber.next();
          });
          socket.connect();
          return () => {
            clearTimeout(admission);
            clearInterval(heartbeat);
            socket.removeAllListeners();
            socket.disconnect();
          };
        }),
    ),
    retry({ delay: 30_000 }),
  );
}
