import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { HttpErrorResponse } from '@angular/common/http';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { TaskSectionsApi } from '../../data-access/services/task-sections-api/task-sections-api.service';
import type { TaskDetailTask } from '../../models/task-detail/task-detail.interface';
import { TaskDetailStore } from '../task-detail/task-detail.store';
import {
  DESCRIPTION_SAVE_MS,
  TaskDetailSectionsStore,
  type TaskDetailSectionsStoreInstance,
} from './task-detail-sections.store';

/**
 * Constant TASK
 *
 * @description
 * CAD-482 of Sprint 14, with a two-item checklist.
 *
 * @type {TaskDetailTask}
 */
const TASK: TaskDetailTask = {
  id: 'CAD-482',
  key: 'CAD-482',
  name: 'Redesign the SSO sign-in screen',
  status: 'progress',
  cancelReason: null,
  priority: 'haute',
  assigneeIds: ['u1'],
  due: null,
  start: null,
  labels: [],
  subtasks: { closed: 0, total: 0 },
  checklist: { closed: 1, total: 2 },
  comments: null,
  parentKey: 'CAD-470',
  milestone: false,
  recurrence: 'none',
  listId: 'sprint-14',
  spaceId: 'product',
  version: 4,
  description: 'Old',
  cancelNote: null,
  estimateMinutes: null,
  checklistItems: [
    { id: 'i1', text: 'Mockup approved', done: true },
    { id: 'i2', text: 'Test on Safari', done: false },
  ],
  createdAt: '2026-11-02T09:00:00Z',
  createdBy: { type: 'user', id: 'u1' },
  updatedAt: '2026-11-06T09:00:00Z',
  archivedAt: null,
};

describe('TaskDetailSectionsStore', () => {
  let task: WritableSignal<TaskDetailTask>;
  let detail: Record<string, unknown>;
  let api: Record<string, Mock>;
  let toasts: { success: Mock; error: Mock };
  let store: TaskDetailSectionsStoreInstance;

  beforeEach(() => {
    task = signal(TASK);
    detail = {
      taskKey: signal('CAD-482'),
      task,
      confirmedTask: task,
      subtasks: signal([]),
      update: vi.fn(() => Promise.resolve(true)),
      accept: vi.fn((saved: TaskDetailTask) => {
        task.set(saved);
      }),
      reload: vi.fn(() => Promise.resolve()),
      write: vi.fn((_key: string, send: (version: number) => Promise<unknown>, fallback?: number) =>
        send(fallback ?? 4),
      ),
    };
    api = {
      people: vi.fn(() =>
        Promise.resolve([{ id: 'u1', name: 'Camille Martin', initials: 'CM', avatar: null }]),
      ),
      parentOf: vi.fn(() => Promise.resolve('CAD-400')),
      setChecklistItem: vi.fn(),
      addChecklistItem: vi.fn(),
      createSubtask: vi.fn(),
    };
    toasts = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        TaskDetailSectionsStore,
        { provide: TaskDetailStore, useValue: detail },
        { provide: TaskSectionsApi, useValue: api },
        { provide: CwToastService, useValue: toasts },
      ],
    });
    store = TestBed.inject(TaskDetailSectionsStore);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('names people from the member directory and reads the depth from the parent', async () => {
    await vi.waitFor(() => {
      expect(store.peopleById().get('u1')?.name).toBe('Camille Martin');
    });
    await vi.waitFor(() => {
      expect(store.subtaskLimit()).toBe('depth');
    });
    expect(api['parentOf']).toHaveBeenCalledWith('CAD-470');
  });

  it('ticks an item at once, then puts the confirmed tick back with a toast when refused', async () => {
    let refuse: (error: unknown) => void = () => undefined;
    api['setChecklistItem'].mockReturnValue(
      new Promise((_resolve: unknown, reject: (error: unknown) => void) => {
        refuse = reject;
      }),
    );

    const toggled: Promise<void> = store.toggleItem(TASK.checklistItems[1]);

    expect(store.checklist()[1].done).toBe(true);
    refuse(new HttpErrorResponse({ status: 500 }));
    await toggled;
    expect(store.checklist()[1].done).toBe(false);
    expect(toasts.error).toHaveBeenCalled();
  });

  it('confirms the task a tick answers', async () => {
    const saved: TaskDetailTask = {
      ...TASK,
      version: 5,
      checklistItems: [TASK.checklistItems[0], { ...TASK.checklistItems[1], done: true }],
    };
    api['setChecklistItem'].mockResolvedValue(saved);

    await store.toggleItem(TASK.checklistItems[1]);

    expect(api['setChecklistItem']).toHaveBeenCalledWith('CAD-482', 'i2', true);
    expect(detail['accept']).toHaveBeenCalledWith(saved);
    expect(store.checklist()[1].done).toBe(true);
  });

  it('sends the checklist writes through the task write path and adopts their answer there', async () => {
    const order: string[] = [];
    (detail['write'] as Mock).mockImplementation(
      async (key: string, send: (version: number) => Promise<unknown>, fallback?: number) => {
        order.push(`write ${key} ${String(fallback)}`);
        const result: unknown = await send(fallback ?? 4);
        order.push('settled');
        return result;
      },
    );
    (detail['accept'] as Mock).mockImplementation((saved: TaskDetailTask) => {
      order.push(`accept ${String(saved.version)}`);
      task.set(saved);
    });
    api['setChecklistItem'].mockResolvedValue({ ...TASK, version: 5 });
    api['addChecklistItem'].mockResolvedValue({ ...TASK, version: 6 });

    await store.toggleItem(TASK.checklistItems[1]);
    await expect(store.addItem(' Check Firefox ')).resolves.toBe(true);

    expect(api['setChecklistItem']).toHaveBeenCalledWith('CAD-482', 'i2', true);
    expect(api['addChecklistItem']).toHaveBeenCalledWith('CAD-482', 'Check Firefox');
    expect(order).toEqual([
      'write CAD-482 0',
      'accept 5',
      'settled',
      'write CAD-482 0',
      'accept 6',
      'settled',
    ]);
  });

  it('saves the description once after the pause, with its last text', async () => {
    vi.useFakeTimers();
    store.editDescription('New');
    store.editDescription('Newer');

    await vi.advanceTimersByTimeAsync(DESCRIPTION_SAVE_MS);

    expect(detail['update']).toHaveBeenCalledTimes(1);
    expect(detail['update']).toHaveBeenCalledWith({
      description: 'Newer',
      descriptionMentions: [],
    });
  });

  it('sends the mention spans of the description with it', () => {
    store.editDescription('Ask @[Hugo Dubois](u2) to review');
    store.flushDescription();

    expect(detail['update']).toHaveBeenCalledWith({
      description: 'Ask @[Hugo Dubois](u2) to review',
      descriptionMentions: [{ userId: 'u2', start: 4, end: 22 }],
    });
  });

  it('saves a waiting description when flushed, and clears an emptied one', () => {
    store.editDescription('   ');
    store.flushDescription();

    expect(detail['update']).toHaveBeenCalledWith({ description: null });
  });

  it('shows the limit a refused creation names', async () => {
    api['createSubtask'].mockRejectedValue(
      new HttpErrorResponse({
        status: 422,
        error: { code: 'task.subtask-limit-reached' },
      }),
    );

    await expect(store.createSubtask('Write the tests')).resolves.toBe(false);

    expect(store.subtaskLimit()).toBe('count');
  });

  it('reads the depth again and drops a refused limit when the parent changes', async () => {
    await vi.waitFor(() => {
      expect(store.subtaskLimit()).toBe('depth');
    });
    api['createSubtask'].mockRejectedValue(
      new HttpErrorResponse({ status: 422, error: { code: 'task.subtask-depth-exceeded' } }),
    );
    await store.createSubtask('Write the tests');
    api['parentOf'].mockResolvedValue(null);

    task.set({ ...TASK, parentKey: 'CAD-300' });
    TestBed.tick();

    await vi.waitFor(() => {
      expect(store.subtaskLimit()).toBeNull();
    });
    expect(api['parentOf']).toHaveBeenLastCalledWith('CAD-300');
  });

  it('drops a refused count limit once the subtask count changes', async () => {
    api['createSubtask'].mockRejectedValue(
      new HttpErrorResponse({ status: 422, error: { code: 'task.subtask-limit-reached' } }),
    );
    api['parentOf'].mockResolvedValue(null);
    TestBed.tick();
    await store.createSubtask('Write the tests');
    expect(store.subtaskLimit()).toBe('count');

    (detail['subtasks'] as WritableSignal<readonly unknown[]>).set([{ key: 'CAD-483' }]);
    TestBed.tick();

    expect(store.subtaskLimit()).toBeNull();
  });

  it('creates a subtask sent again after a failure under the same idempotency key', async () => {
    api['createSubtask']
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ key: 'CAD-733', name: 'Write the tests' });

    await expect(store.createSubtask('Write the tests')).resolves.toBe(false);
    await expect(store.createSubtask('Write the tests')).resolves.toBe(true);
    await expect(store.createSubtask('Write the tests')).resolves.toBe(true);

    const keys: unknown[] = api['createSubtask'].mock.calls.map((call: unknown[]) => call[2]);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[1]);
  });

  it('creates a subtask, toasts it and reads the detail again', async () => {
    api['createSubtask'].mockResolvedValue({ key: 'CAD-733', name: 'Write the tests' });

    await expect(store.createSubtask(' Write the tests ')).resolves.toBe(true);

    expect(api['createSubtask']).toHaveBeenCalledWith(
      'CAD-482',
      'Write the tests',
      expect.any(String),
    );
    expect(toasts.success).toHaveBeenCalledWith('Subtask CAD-733 created', {
      description: 'In CAD-482 · Redesign the SSO sign-in screen',
    });
    expect(detail['reload']).toHaveBeenCalled();
  });
});
