import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { HttpErrorResponse } from '@angular/common/http';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { TaskSectionsApi } from '../../data-access/services/task-sections-api/task-sections-api.service';
import type { TaskDetailTask } from '../../models/task-detail/task-detail.interface';
import { TaskDetailStore } from '../task-detail/task-detail.store';
import {
  DESCRIPTION_DRAFT_PREFIX,
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

  /**
   * Function create
   *
   * @description
   * Provides and starts the store over the current fakes, signed in as a user.
   *
   * @param {string} [userId] - The signed-in user, Camille Martin by default.
   * @returns {TaskDetailSectionsStoreInstance} The store.
   */
  function create(userId: string = 'u1'): TaskDetailSectionsStoreInstance {
    TestBed.configureTestingModule({
      providers: [
        TaskDetailSectionsStore,
        { provide: TaskDetailStore, useValue: detail },
        { provide: TaskSectionsApi, useValue: api },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: {
            organization: signal({ id: 'o1', slug: 'atelier-nord' }),
            user: signal({ id: userId }),
          },
        },
        { provide: CwToastService, useValue: toasts },
      ],
    });
    return TestBed.inject(TaskDetailSectionsStore);
  }

  beforeEach(() => {
    localStorage.clear();
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
        {
          provide: WORKSPACE_CONTEXT,
          useValue: {
            organization: signal({ id: 'o1', slug: 'atelier-nord' }),
            user: signal({ id: 'u1' }),
          },
        },
        { provide: CwToastService, useValue: toasts },
      ],
    });
    store = TestBed.inject(TaskDetailSectionsStore);
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
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
    expect(detail['update']).toHaveBeenCalledWith(
      { description: 'Newer', descriptionMentions: [] },
      { key: 'CAD-482', draftKept: true },
    );
  });

  it('sends the mention spans of the description with it', () => {
    store.editDescription('Ask @[Hugo Dubois](u2) to review');
    store.flushDescription();

    expect(detail['update']).toHaveBeenCalledWith(
      {
        description: 'Ask @[Hugo Dubois](u2) to review',
        descriptionMentions: [{ userId: 'u2', start: 4, end: 22 }],
      },
      { key: 'CAD-482', draftKept: true },
    );
  });

  it('saves a description typed before the task switched to its own task, not the new one', async () => {
    vi.useFakeTimers();
    store.editDescription('Typed in CAD-482');
    (detail['taskKey'] as WritableSignal<string>).set('CAD-490');
    task.set({ ...TASK, id: 'CAD-490', key: 'CAD-490', version: 9, description: 'Other' });

    await vi.advanceTimersByTimeAsync(DESCRIPTION_SAVE_MS);

    expect(detail['update']).toHaveBeenCalledExactlyOnceWith(
      { description: 'Typed in CAD-482', descriptionMentions: [] },
      { key: 'CAD-482', draftKept: true },
    );
  });

  it('saves the waiting draft of the previous task on destroy after a switch', () => {
    store.editDescription('Typed in CAD-482');
    (detail['taskKey'] as WritableSignal<string>).set('CAD-490');
    task.set({ ...TASK, id: 'CAD-490', key: 'CAD-490', version: 9, description: 'Other' });

    TestBed.resetTestingModule();

    expect(detail['update']).toHaveBeenCalledExactlyOnceWith(
      { description: 'Typed in CAD-482', descriptionMentions: [] },
      { key: 'CAD-482', draftKept: true },
    );
  });

  it('sends a text reverted while a save is in flight after that save', async () => {
    let answer: (saved: boolean) => void = () => undefined;
    (detail['update'] as Mock).mockReturnValueOnce(
      new Promise<boolean>((resolve: (saved: boolean) => void) => {
        answer = resolve;
      }),
    );
    store.editDescription('Changed');
    store.flushDescription();

    store.editDescription('Old');
    store.flushDescription();

    expect(detail['update']).toHaveBeenNthCalledWith(
      1,
      { description: 'Changed', descriptionMentions: [] },
      { key: 'CAD-482', draftKept: true },
    );
    expect(detail['update']).toHaveBeenNthCalledWith(
      2,
      { description: 'Old', descriptionMentions: [] },
      { key: 'CAD-482', draftKept: true },
    );
    answer(true);
    await Promise.resolve();

    store.editDescription('Old');
    store.flushDescription();
    expect(detail['update']).toHaveBeenCalledTimes(2);
  });

  it('saves a waiting description when flushed, and clears an emptied one', () => {
    store.editDescription('   ');
    store.flushDescription();

    expect(detail['update']).toHaveBeenCalledWith(
      { description: null },
      { key: 'CAD-482', draftKept: true },
    );
  });

  it('keeps a draft whose save failed on the device and restores it when the task opens again', async () => {
    vi.useFakeTimers();
    (detail['update'] as Mock).mockResolvedValueOnce(false);
    store.editDescription('Typed in CAD-482');
    (detail['taskKey'] as WritableSignal<string>).set('CAD-490');
    task.set({ ...TASK, id: 'CAD-490', key: 'CAD-490', version: 9, description: 'Other' });
    await vi.advanceTimersByTimeAsync(DESCRIPTION_SAVE_MS);
    expect(localStorage.getItem(`${DESCRIPTION_DRAFT_PREFIX}.o1.u1.CAD-482`)).not.toBeNull();

    TestBed.resetTestingModule();
    (detail['taskKey'] as WritableSignal<string>).set('CAD-482');
    task.set(TASK);
    (detail['update'] as Mock).mockClear();
    const reopened: TaskDetailSectionsStoreInstance = create();
    TestBed.tick();

    expect(reopened.restoredDraft()).toBe('Typed in CAD-482');
    await vi.advanceTimersByTimeAsync(DESCRIPTION_SAVE_MS);
    expect(detail['update']).toHaveBeenCalledExactlyOnceWith(
      { description: 'Typed in CAD-482', descriptionMentions: [] },
      { key: 'CAD-482', draftKept: true },
    );
    expect(reopened.restoredDraft()).toBeNull();
    expect(localStorage.getItem(`${DESCRIPTION_DRAFT_PREFIX}.o1.u1.CAD-482`)).toBeNull();
  });

  it('discards a restored draft without saving it', async () => {
    vi.useFakeTimers();
    localStorage.setItem(
      `${DESCRIPTION_DRAFT_PREFIX}.o1.u1.CAD-482`,
      JSON.stringify({ markdown: 'Kept text', base: 'Old' }),
    );
    TestBed.resetTestingModule();
    const reopened: TaskDetailSectionsStoreInstance = create();
    TestBed.tick();
    expect(reopened.restoredDraft()).toBe('Kept text');

    reopened.discardDraft();
    await vi.advanceTimersByTimeAsync(DESCRIPTION_SAVE_MS);

    expect(reopened.restoredDraft()).toBeNull();
    expect(detail['update']).not.toHaveBeenCalled();
    expect(localStorage.getItem(`${DESCRIPTION_DRAFT_PREFIX}.o1.u1.CAD-482`)).toBeNull();
  });

  it('saves nothing by itself for a draft typed over a description changed since', async () => {
    vi.useFakeTimers();
    localStorage.setItem(
      `${DESCRIPTION_DRAFT_PREFIX}.o1.u1.CAD-482`,
      JSON.stringify({ markdown: 'Mine', base: 'Old' }),
    );
    task.set({ ...TASK, version: 6, description: 'Theirs' });
    TestBed.resetTestingModule();
    const reopened: TaskDetailSectionsStoreInstance = create();
    TestBed.tick();

    expect(reopened.restoredDraft()).toBe('Mine');
    expect(reopened.restoredChanged()).toBe(true);
    await vi.advanceTimersByTimeAsync(DESCRIPTION_SAVE_MS * 2);
    expect(detail['update']).not.toHaveBeenCalled();

    reopened.keepDraft();

    expect(detail['update']).toHaveBeenCalledExactlyOnceWith(
      { description: 'Mine', descriptionMentions: [] },
      { key: 'CAD-482', draftKept: true },
    );
    await vi.waitFor(() => {
      expect(reopened.restoredDraft()).toBeNull();
    });
    expect(localStorage.getItem(`${DESCRIPTION_DRAFT_PREFIX}.o1.u1.CAD-482`)).toBeNull();
  });

  it('discards a draft typed over a description changed since', async () => {
    vi.useFakeTimers();
    localStorage.setItem(
      `${DESCRIPTION_DRAFT_PREFIX}.o1.u1.CAD-482`,
      JSON.stringify({ markdown: 'Mine', base: 'Old' }),
    );
    task.set({ ...TASK, version: 6, description: 'Theirs' });
    TestBed.resetTestingModule();
    const reopened: TaskDetailSectionsStoreInstance = create();
    TestBed.tick();

    reopened.discardDraft();
    await vi.advanceTimersByTimeAsync(DESCRIPTION_SAVE_MS * 2);

    expect(reopened.restoredDraft()).toBeNull();
    expect(reopened.restoredChanged()).toBe(false);
    expect(detail['update']).not.toHaveBeenCalled();
    expect(localStorage.getItem(`${DESCRIPTION_DRAFT_PREFIX}.o1.u1.CAD-482`)).toBeNull();
  });

  it('never restores the draft of another user of the device', () => {
    localStorage.setItem(
      `${DESCRIPTION_DRAFT_PREFIX}.o1.u1.CAD-482`,
      JSON.stringify({ markdown: 'Kept text', base: 'Old' }),
    );
    TestBed.resetTestingModule();
    const other: TaskDetailSectionsStoreInstance = create('u2');
    TestBed.tick();

    expect(other.restoredDraft()).toBeNull();
    expect(localStorage.getItem(`${DESCRIPTION_DRAFT_PREFIX}.o1.u1.CAD-482`)).not.toBeNull();
  });

  it('forgets a stored draft the confirmed description already carries', () => {
    localStorage.setItem(
      `${DESCRIPTION_DRAFT_PREFIX}.o1.u1.CAD-482`,
      JSON.stringify({ markdown: 'Old', base: '' }),
    );
    TestBed.resetTestingModule();
    const reopened: TaskDetailSectionsStoreInstance = create();
    TestBed.tick();

    expect(reopened.restoredDraft()).toBeNull();
    expect(localStorage.getItem(`${DESCRIPTION_DRAFT_PREFIX}.o1.u1.CAD-482`)).toBeNull();
  });

  it('shows a draft whose save failed again in the open task', async () => {
    (detail['update'] as Mock).mockResolvedValueOnce(false);
    store.editDescription('Typed again');
    store.flushDescription();

    await vi.waitFor(() => {
      expect(store.restoredDraft()).toBe('Typed again');
    });
    expect(localStorage.getItem(`${DESCRIPTION_DRAFT_PREFIX}.o1.u1.CAD-482`)).not.toBeNull();
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
