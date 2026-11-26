import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwToastService, type CwToastOptions } from '@cadenway/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { TaskTimeApi } from '../../data-access/services/task-time-api/task-time-api.service';
import type { TaskTimeEntry, TaskTimeLog } from '../../models/task-time/task-time.interface';
import { TaskDetailStore } from '../task-detail/task-detail.store';
import {
  TIMER_STOP_SUFFIX,
  TIMER_STORAGE_PREFIX,
  TaskTimeStore,
  type TaskTimeStoreInstance,
} from './task-time.store';

/**
 * Constant entry
 *
 * @description
 * 45 minutes Camille Martin recorded on CAD-482.
 *
 * @type {TaskTimeEntry}
 */
const entry: TaskTimeEntry = {
  id: 'e1',
  authorId: 'u1',
  minutes: 45,
  workDate: '2026-11-08',
  note: 'Domain detection',
  createdAt: '2026-11-08T09:05:00Z',
};

/**
 * Constant log
 *
 * @description
 * The entries of CAD-482.
 *
 * @type {TaskTimeLog}
 */
const log: TaskTimeLog = { entries: [entry], totalMinutes: 45 };

/**
 * Constant storageKey
 *
 * @description
 * Device storage key of the timer of CAD-482 in Atelier Nord.
 *
 * @type {string}
 */
const storageKey: string = `${TIMER_STORAGE_PREFIX}.o1.CAD-482`;

/**
 * Function settle
 *
 * @description
 * Lets the pending promises of the store run.
 *
 * @returns {Promise<void>} Resolves after the wait.
 */
async function settle(): Promise<void> {
  await new Promise<void>((resolve: () => void) => setTimeout(resolve, 0));
  TestBed.tick();
}

describe('TaskTimeStore', () => {
  let store: TaskTimeStoreInstance;
  let api: { log: Mock; record: Mock; remove: Mock };
  let toasts: { show: Mock; error: Mock };
  let taskKey: WritableSignal<string | null>;

  /**
   * Function create
   *
   * @description
   * Provides and starts the store for CAD-482.
   */
  function create(): void {
    taskKey = signal<string | null>('CAD-482');
    TestBed.configureTestingModule({
      providers: [
        TaskTimeStore,
        {
          provide: TaskDetailStore,
          useValue: {
            taskKey,
            ready: signal(true),
            task: signal({ key: 'CAD-482', estimateMinutes: 240 }),
          },
        },
        { provide: TaskTimeApi, useValue: api },
        { provide: CwToastService, useValue: toasts },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: { organization: signal({ id: 'o1', slug: 'atelier-nord' }) },
        },
      ],
    });
    store = TestBed.inject(TaskTimeStore);
    TestBed.tick();
  }

  beforeEach(() => {
    localStorage.clear();
    api = {
      log: vi.fn(() => Promise.resolve(log)),
      record: vi.fn((_key: string, draft: { minutes: number; note: string }, workDate: string) =>
        Promise.resolve({ ...entry, id: 'e2', minutes: draft.minutes, note: draft.note, workDate }),
      ),
      remove: vi.fn(() => Promise.resolve()),
    };
    toasts = { show: vi.fn(), error: vi.fn() };
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('reads the entries of the open task, and a failure apart from an empty log', async () => {
    api.log.mockRejectedValueOnce(new Error('offline'));
    create();
    await settle();

    expect(store.failed()).toBe(true);
    expect(store.log()).toBeNull();

    await store.reload();

    expect(store.log()).toEqual(log);
    expect(store.totalMinutes()).toBe(45);
  });

  it('records time and its toast Undo deletes the entry', async () => {
    create();
    await settle();

    expect(await store.add({ minutes: 90, note: 'OAuth buttons' })).toBe(true);
    expect(store.totalMinutes()).toBe(135);
    const [title, options]: [string, CwToastOptions] = toasts.show.mock.calls[0] as [
      string,
      CwToastOptions,
    ];

    expect(title).toBe('1 h 30 added to CAD-482');
    expect(options.description).toBe('Total: 2 h 15 of 4 h estimated');
    options.undo?.();
    await settle();

    expect(api.remove).toHaveBeenCalledWith('CAD-482', 'e2');
    expect(store.totalMinutes()).toBe(45);
  });

  it('puts an entry back when its deletion is refused', async () => {
    create();
    await settle();
    api.remove.mockRejectedValueOnce(new Error('refused'));

    expect(await store.remove(entry)).toBe(false);
    expect(store.log()).toEqual(log);
    expect(toasts.error).toHaveBeenCalledWith('Could not change the time spent', expect.anything());
  });

  it('deletes an entry and its toast Undo records the same time again', async () => {
    create();
    await settle();

    expect(await store.remove(entry)).toBe(true);
    expect(store.totalMinutes()).toBe(0);
    const [title, options]: [string, CwToastOptions] = toasts.show.mock.calls[0] as [
      string,
      CwToastOptions,
    ];

    expect(title).toBe('Entry deleted');
    options.undo?.();
    await settle();

    expect(api.record).toHaveBeenCalledWith(
      'CAD-482',
      { minutes: 45, note: 'Domain detection' },
      '2026-11-08',
      expect.any(String),
    );
  });

  it('keeps the timer on the device and records one minute at least with the note Timer', async () => {
    create();
    await settle();
    store.startTimer();
    const startedAt: number | null = store.timerStartedAt();

    expect(startedAt).not.toBeNull();
    expect(localStorage.getItem(storageKey)).toBe(String(startedAt));

    expect(await store.stopTimer((startedAt ?? 0) + 10_000)).toBe(true);
    expect(api.record).toHaveBeenCalledWith(
      'CAD-482',
      { minutes: 1, note: 'Timer' },
      expect.any(String),
      expect.any(String),
    );
    expect(store.timerStartedAt()).toBeNull();
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it('keeps the timer and its key when the stop cannot be recorded, then retries', async () => {
    create();
    await settle();
    store.startTimer();
    const startedAt: number = store.timerStartedAt() ?? 0;
    api.record.mockRejectedValueOnce(new Error('offline'));

    expect(await store.stopTimer(startedAt + 25 * 60_000)).toBe(false);

    expect(store.timerStartedAt()).toBe(startedAt);
    expect(localStorage.getItem(storageKey)).toBe(String(startedAt));
    expect(toasts.error).toHaveBeenCalledWith('Could not change the time spent', expect.anything());

    expect(await store.stopTimer(startedAt + 27 * 60_000)).toBe(true);

    const calls: unknown[][] = api.record.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1][1]).toEqual({ minutes: 25, note: 'Timer' });
    expect(calls[1][3]).toBe(calls[0][3]);
    expect(store.timerStartedAt()).toBeNull();
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it('sends the same entry again under the same idempotency key after a failure', async () => {
    create();
    await settle();
    api.record.mockRejectedValueOnce(new Error('offline'));

    expect(await store.add({ minutes: 90, note: 'OAuth buttons' })).toBe(false);
    expect(await store.add({ minutes: 90, note: 'OAuth buttons' })).toBe(true);
    expect(await store.add({ minutes: 90, note: 'OAuth buttons' })).toBe(true);

    const keys: unknown[] = api.record.mock.calls.map((call: unknown[]) => call[3]);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[1]);
  });

  it('runs the Undo of an added entry against its task once another task is open', async () => {
    create();
    await settle();
    await store.add({ minutes: 90, note: 'OAuth buttons' });
    const options: CwToastOptions = toasts.show.mock.calls[0][1] as CwToastOptions;
    taskKey.set('CAD-490');
    await settle();
    const shown: TaskTimeLog | null = store.log();

    options.undo?.();
    await settle();

    expect(api.remove).toHaveBeenCalledWith('CAD-482', 'e2');
    expect(store.log()).toEqual(shown);
  });

  it('runs the Undo of a deleted entry against its task once another task is open', async () => {
    create();
    await settle();
    await store.remove(entry);
    const options: CwToastOptions = toasts.show.mock.calls[0][1] as CwToastOptions;
    taskKey.set('CAD-490');
    await settle();
    const shown: TaskTimeLog | null = store.log();

    options.undo?.();
    await settle();

    expect(api.record).toHaveBeenCalledWith(
      'CAD-482',
      { minutes: 45, note: 'Domain detection' },
      '2026-11-08',
      expect.any(String),
    );
    expect(store.log()).toEqual(shown);
  });

  it('sends a stop whose answer was lost again with its key after the detail reopens', async () => {
    create();
    await settle();
    store.startTimer();
    const startedAt: number = store.timerStartedAt() ?? 0;
    api.record.mockRejectedValueOnce(new Error('offline'));
    expect(await store.stopTimer(startedAt + 25 * 60_000)).toBe(false);
    expect(localStorage.getItem(`${storageKey}.${TIMER_STOP_SUFFIX}`)).not.toBeNull();

    taskKey.set('CAD-490');
    await settle();
    taskKey.set('CAD-482');
    await settle();
    expect(await store.stopTimer(startedAt + 40 * 60_000)).toBe(true);

    const calls: unknown[][] = api.record.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1][1]).toEqual({ minutes: 25, note: 'Timer' });
    expect(calls[1][2]).toBe(calls[0][2]);
    expect(calls[1][3]).toBe(calls[0][3]);
    expect(localStorage.getItem(storageKey)).toBeNull();
    expect(localStorage.getItem(`${storageKey}.${TIMER_STOP_SUFFIX}`)).toBeNull();
  });

  it('sends a stop whose answer was lost again with its key after a reload', async () => {
    create();
    await settle();
    store.startTimer();
    const startedAt: number = store.timerStartedAt() ?? 0;
    api.record.mockRejectedValueOnce(new Error('offline'));
    await store.stopTimer(startedAt + 25 * 60_000);
    const first: unknown[] = api.record.mock.calls[0];

    TestBed.resetTestingModule();
    create();
    await settle();
    expect(store.timerStartedAt()).toBe(startedAt);
    expect(await store.stopTimer(startedAt + 90 * 60_000)).toBe(true);

    const second: unknown[] = api.record.mock.calls[1];
    expect(second[1]).toEqual({ minutes: 25, note: 'Timer' });
    expect(second[3]).toBe(first[3]);
  });

  it('ignores a stored stop of another timer start', async () => {
    localStorage.setItem(storageKey, '1762592400000');
    localStorage.setItem(
      `${storageKey}.${TIMER_STOP_SUFFIX}`,
      JSON.stringify({
        startedAt: 1762500000000,
        minutes: 5,
        workDate: '2026-11-07',
        note: 'Timer',
        idempotencyKey: 'old-key',
      }),
    );
    create();
    await settle();

    await store.stopTimer(1762592400000 + 10 * 60_000);

    expect(api.record.mock.calls[0][1]).toEqual({ minutes: 10, note: 'Timer' });
    expect(api.record.mock.calls[0][3]).not.toBe('old-key');
  });

  it('drops a read of the entries that began before a confirmed write, and reads again', async () => {
    create();
    await settle();
    let answer: (read: TaskTimeLog) => void = () => undefined;
    api.log.mockReturnValueOnce(
      new Promise<TaskTimeLog>((resolve: (read: TaskTimeLog) => void) => {
        answer = resolve;
      }),
    );
    const read: Promise<void> = store.reload();
    await store.add({ minutes: 90, note: 'OAuth buttons' });
    expect(store.totalMinutes()).toBe(135);
    const fresh: TaskTimeLog = {
      entries: [{ ...entry, id: 'e2', minutes: 90, note: 'OAuth buttons' }, entry],
      totalMinutes: 135,
    };
    api.log.mockResolvedValueOnce(fresh);

    answer(log);
    await read;

    expect(api.log).toHaveBeenCalledTimes(3);
    expect(store.log()).toEqual(fresh);
    expect(store.totalMinutes()).toBe(135);
  });

  it('finds a running timer when the task opens again', async () => {
    localStorage.setItem(storageKey, '1762592400000');
    create();
    await settle();

    expect(store.timerStartedAt()).toBe(1762592400000);
  });
});
