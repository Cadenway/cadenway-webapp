import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwToastService, type CwToastOptions } from '@cadenway/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { TaskTimeApi } from '../../data-access/services/task-time-api/task-time-api.service';
import type { TaskTimeEntry, TaskTimeLog } from '../../models/task-time/task-time.interface';
import { TaskDetailStore } from '../task-detail/task-detail.store';
import { TIMER_STORAGE_PREFIX, TaskTimeStore, type TaskTimeStoreInstance } from './task-time.store';

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

  it('finds a running timer when the task opens again', async () => {
    localStorage.setItem(storageKey, '1762592400000');
    create();
    await settle();

    expect(store.timerStartedAt()).toBe(1762592400000);
  });
});
