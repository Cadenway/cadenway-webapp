import { type Observable, of, type Subscription } from 'rxjs';
import { io, type Socket } from 'socket.io-client';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

import { observeTaskRoom } from './task-room.adapter';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));

describe('observeTaskRoom', () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it('accepts only the expected organization and rejoins with a fresh ticket after disconnect', async () => {
    vi.useFakeTimers();
    const events: EventTarget[] = [];
    const join: Mock<(action: string, room: unknown) => void> = vi.fn();
    const disconnect: Mock<() => void> = vi.fn();
    vi.mocked(io).mockImplementation(() => {
      const transport: EventTarget = new EventTarget();
      events.push(transport);
      const listen: (name: string, handler: (data: unknown) => void, once?: boolean) => void = (
        name,
        handler,
        once,
      ) => {
        transport.addEventListener(
          name,
          (event: Event) => {
            handler((event as CustomEvent<unknown>).detail);
          },
          { once },
        );
      };
      return {
        once: (name: string, handler: (data: unknown) => void) => {
          listen(name, handler, true);
        },
        on: listen,
        connect: vi.fn(),
        disconnect,
        removeAllListeners: vi.fn(),
        timeout: () => ({
          emit: (
            action: string,
            room: unknown,
            acknowledge: (error: Error | null, response: unknown) => void,
          ) => {
            join(action, room);
            acknowledge(null, { ok: true });
          },
        }),
        volatile: { emit: vi.fn() },
      } as unknown as Socket;
    });
    const ticket: ReturnType<typeof vi.fn<() => Observable<string>>> = vi
      .fn<() => Observable<string>>()
      .mockReturnValueOnce(of('first-ticket'))
      .mockReturnValueOnce(of('second-ticket'));
    const refresh: Mock<() => void> = vi.fn();
    const subscription: Subscription = observeTaskRoom(
      new URL('https://realtime.example.test'),
      'organization-a',
      'CAD-482',
      ticket,
    ).subscribe(refresh);

    try {
      events[0]?.dispatchEvent(
        new CustomEvent('hello', {
          detail: {
            type: 'connection.ready.v1',
            data: { organizationId: 'organization-a', heartbeatIntervalSeconds: 10 },
          },
        }),
      );
      expect(join).toHaveBeenCalledExactlyOnceWith('room:join', {
        kind: 'task',
        taskKey: 'CAD-482',
      });
      const notice: { type: string; id: string } = { type: 'task.updated.v1', id: 'notice-id' };
      events[0]?.dispatchEvent(new CustomEvent('change', { detail: notice }));
      events[0]?.dispatchEvent(new CustomEvent('change', { detail: notice }));
      expect(refresh).toHaveBeenCalledTimes(2);

      events[0]?.dispatchEvent(new Event('disconnect'));
      await vi.advanceTimersByTimeAsync(30_000);
      expect(vi.mocked(io)).toHaveBeenLastCalledWith(
        'https://realtime.example.test',
        expect.objectContaining({ auth: { token: 'second-ticket' }, reconnection: false }),
      );

      events[1]?.dispatchEvent(
        new CustomEvent('hello', {
          detail: {
            type: 'connection.ready.v1',
            data: { organizationId: 'organization-b', heartbeatIntervalSeconds: 10 },
          },
        }),
      );
      expect(join).toHaveBeenCalledTimes(1);
      expect(disconnect).toHaveBeenCalledTimes(2);
      expect(subscription.closed).toBe(true);
    } finally {
      subscription.unsubscribe();
    }
  });
});
