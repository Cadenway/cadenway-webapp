import { HttpErrorResponse } from '@angular/common/http';
import { type Provider, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { StatusKey } from '@cadenway/contracts';
import { CwToastService, type CwToastOptions } from '@cadenway/ui/components/toast';
import { of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { type RealtimeChange, RealtimeConnection } from '@core/realtime';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';
import { DeletedTaskRouteError } from '@shared/route-errors';

import { TaskApi } from '../../data-access/services/task-api/task-api.service';
import { TaskDetailApi } from '../../data-access/services/task-detail-api/task-detail-api.service';
import type {
  TaskCommentPage,
  TaskDetail,
  TaskDetailPatch,
  TaskDetailTask,
  TaskReminder,
  TaskTrashEntry,
} from '../../models/task-detail/task-detail.interface';
import { TaskVersionConflict } from '../../models/task-write-error/task-write-error.model';
import { TaskDetailOpener } from '../../services/task-detail-opener/task-detail-opener.service';
import { defaultStatusOptions } from '../../utils/task-status/task-status.util';
import { TASK_WRITE_LANE } from '../../ports/task-write-lane';
import {
  STATUS_SETTLE_MS,
  type TaskStatusChangesInstance,
  TaskStatusChangesStore,
} from '../task-status-changes/task-status-changes.store';
import {
  NOTICE_WINDOW_MS,
  TaskDetailStore,
  type TaskDetailStoreInstance,
} from './task-detail.store';

/**
 * Constant workspace
 *
 * @description
 * Camille Martin in Atelier Nord.
 *
 * @type {WorkspaceContextPort}
 */
const workspace: WorkspaceContextPort = {
  user: signal({
    id: 'u1',
    name: 'Camille Martin',
    firstName: 'Camille',
    displayName: null,
    email: 'camille.martin@ateliernord.fr',
    initials: 'CM',
  }),
  organization: signal({
    id: 'o1',
    slug: 'atelier-nord',
    name: 'Atelier Nord',
    initials: 'AN',
    role: 'owner',
    plan: 'team',
  }),
  role: signal('owner'),
  can: () => true,
};

/**
 * Function taskAt
 *
 * @description
 * CAD-482 of Sprint 14 at a version, with optional changes.
 *
 * @param {number} version - Its version.
 * @param {Partial<TaskDetailTask>} [changes] - Changed fields.
 * @returns {TaskDetailTask} The task.
 */
function taskAt(version: number, changes: Partial<TaskDetailTask> = {}): TaskDetailTask {
  return {
    id: 'CAD-482',
    key: 'CAD-482',
    name: 'Redesign the SSO sign-in screen',
    status: 'progress',
    cancelReason: null,
    priority: 'haute',
    assigneeIds: ['u1'],
    due: '2026-11-12',
    start: null,
    labels: ['Front'],
    subtasks: { closed: 1, total: 3 },
    checklist: { closed: 0, total: 0 },
    comments: null,
    parentKey: null,
    milestone: false,
    recurrence: 'none',
    listId: 'sprint-14',
    spaceId: 'product',
    version,
    description: null,
    cancelNote: null,
    estimateMinutes: null,
    checklistItems: [],
    createdAt: '2026-11-02T09:00:00Z',
    createdBy: { type: 'user', id: 'u1' },
    updatedAt: '2026-11-06T09:00:00Z',
    archivedAt: null,
    ...changes,
  };
}

/**
 * Constant comments
 *
 * @description
 * One comment by Inès Robert.
 *
 * @type {TaskCommentPage}
 */
const comments: TaskCommentPage = {
  items: [
    {
      id: 'c1',
      author: { type: 'user', id: 'u2' },
      body: 'Ready for review.',
      createdAt: '2026-11-06T10:00:00Z',
      editedAt: null,
      version: 1,
      replyToCommentId: null,
    },
  ],
  total: 1,
  nextCursor: null,
};

/**
 * Function detailAt
 *
 * @description
 * The detail of CAD-482 at a version.
 *
 * @param {number} version - Task version.
 * @param {Partial<TaskDetail>} [changes] - Changed parts.
 * @returns {TaskDetail} The detail.
 */
function detailAt(version: number, changes: Partial<TaskDetail> = {}): TaskDetail {
  return {
    task: taskAt(version),
    space: { id: 'product', name: 'Product', statuses: defaultStatusOptions() },
    list: {
      id: 'sprint-14',
      name: 'Sprint 14',
      spaceId: 'product',
      canEdit: true,
      canComment: true,
    },
    parent: null,
    subtasks: [],
    comments,
    development: { items: [], nextCursor: null },
    partial: [],
    ...changes,
  };
}

describe('TaskDetailStore', () => {
  let read: Mock<(key: string) => Promise<TaskDetail>>;
  let update: Mock<
    (key: string, version: number, patch: TaskDetailPatch) => Promise<TaskDetailTask>
  >;
  let readComments: Mock<(key: string) => Promise<TaskCommentPage>>;
  let follow: Mock<(key: string, userId: string, following: boolean) => Promise<number | null>>;
  let notices: Subject<RealtimeChange>;
  let reconnected: Subject<void>;
  let duplicate: Mock<
    (key: string, version: number, idempotencyKey: string) => Promise<TaskDetailTask>
  >;
  let archive: Mock<(key: string, version: number) => Promise<void>>;
  let unarchive: Mock<(key: string) => Promise<void>>;
  let trash: Mock<(key: string, version: number) => Promise<TaskTrashEntry>>;
  let restore: Mock<(entryId: string) => Promise<void>>;
  let setReminder: Mock<(key: string, at: Date, note: string) => Promise<TaskReminder>>;
  let saveReminderNote: Mock<(reminderId: string, note: string) => Promise<TaskReminder>>;
  let reminderRead: Mock<() => Promise<TaskReminder | null>>;
  let notifyChanged: Mock<(key: string) => void>;
  let openedKey: WritableSignal<string | null>;
  let openTask: Mock<(key: string, preview?: unknown) => Promise<boolean>>;
  let watch: Mock<() => Subject<RealtimeChange>>;
  let show: Mock<(title: string, options?: CwToastOptions) => string>;
  let error: Mock<(title: string, options?: CwToastOptions) => string>;
  let warning: Mock<(title: string, options?: CwToastOptions) => string>;

  /**
   * Function setup
   *
   * @description
   * Provides the store with the faked data access, realtime and toasts, and opens CAD-482.
   *
   * @param {Provider[]} [extra] - More providers (the status changes on the detail's lane).
   * @returns {Promise<TaskDetailStoreInstance>} The store, once the first read settled.
   */
  async function setup(extra: Provider[] = []): Promise<TaskDetailStoreInstance> {
    TestBed.configureTestingModule({
      providers: [
        ...extra,
        TaskDetailStore,
        {
          provide: TaskDetailApi,
          useValue: {
            read,
            update,
            readComments,
            follow,
            duplicate,
            archive,
            unarchive,
            trash,
            restore,
            setReminder,
            saveReminderNote,
            watchers: () => Promise.resolve({ total: 2, following: false }),
            reminder: reminderRead,
          },
        },
        { provide: RealtimeConnection, useValue: { watch, reconnected } },
        {
          provide: TaskDetailOpener,
          useValue: { open: openTask, notifyChanged, taskKey: openedKey },
        },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
        { provide: CwToastService, useValue: { show, error, warning, dismiss: vi.fn() } },
      ],
    });
    const store: TaskDetailStoreInstance = TestBed.inject(TaskDetailStore);
    store.open('CAD-482', null);
    await vi.waitFor(() => {
      expect(store.ready()).toBe(true);
    });
    return store;
  }

  beforeEach(() => {
    read = vi.fn(() => Promise.resolve(detailAt(4)));
    update = vi.fn((_key: string, version: number, patch: TaskDetailPatch) =>
      Promise.resolve(taskAt(version + 1, { ...patch })),
    );
    readComments = vi.fn(() => Promise.resolve(comments));
    follow = vi.fn(() => Promise.resolve(5));
    notices = new Subject<RealtimeChange>();
    reconnected = new Subject<void>();
    duplicate = vi.fn(() =>
      Promise.resolve(taskAt(1, { id: 'CAD-495', key: 'CAD-495', name: 'Redesign (copy)' })),
    );
    archive = vi.fn(() => Promise.resolve());
    unarchive = vi.fn(() => Promise.resolve());
    trash = vi.fn(() => Promise.resolve({ id: 'entry-1', subtaskCount: 3 }));
    restore = vi.fn(() => Promise.resolve());
    setReminder = vi.fn((_key: string, at: Date, note: string) =>
      Promise.resolve({ id: 'r1', at: at.toISOString(), note, fired: false }),
    );
    saveReminderNote = vi.fn((reminderId: string, note: string) =>
      Promise.resolve({ id: reminderId, at: '2026-11-09T08:00:00Z', note, fired: false }),
    );
    reminderRead = vi.fn(() => Promise.resolve(null));
    notifyChanged = vi.fn();
    openedKey = signal<string | null>('CAD-482');
    openTask = vi.fn(() => Promise.resolve(true));
    watch = vi.fn(() => notices);
    show = vi.fn(() => 't1');
    error = vi.fn(() => 't2');
    warning = vi.fn(() => 't3');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the skeleton and the preview while the detail is read', () => {
    const pending: Promise<TaskDetail> = new Promise<TaskDetail>(() => undefined);
    read.mockReturnValueOnce(pending);
    TestBed.configureTestingModule({
      providers: [
        TaskDetailStore,
        {
          provide: TaskDetailApi,
          useValue: {
            read,
            watchers: () => Promise.resolve({ total: 2, following: false }),
            reminder: () => Promise.resolve(null),
          },
        },
        {
          provide: TaskDetailOpener,
          useValue: { open: vi.fn(), notifyChanged: vi.fn(), taskKey: signal('CAD-482') },
        },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
        { provide: CwToastService, useValue: { show, error, warning } },
      ],
    });
    const store: TaskDetailStoreInstance = TestBed.inject(TaskDetailStore);

    store.open('CAD-482', {
      key: 'CAD-482',
      name: 'Redesign the SSO sign-in screen',
      status: 'todo',
      milestone: false,
    });

    expect(store.loading()).toBe(true);
    expect(store.ready()).toBe(false);
    expect(store.header()).toEqual({
      key: 'CAD-482',
      name: 'Redesign the SSO sign-in screen',
      status: 'todo',
      milestone: false,
    });
    expect(store.hasPreview()).toBe(true);
  });

  it('reads the detail with its parts, the watchers and no reminder', async () => {
    const store: TaskDetailStoreInstance = await setup();

    expect(read).toHaveBeenCalledWith('CAD-482');
    expect(store.task()?.version).toBe(4);
    expect(store.list()?.name).toBe('Sprint 14');
    expect(store.comments()?.total).toBe(1);
    expect(store.commentsFailed()).toBe(false);
    expect(store.canEdit()).toBe(true);
    await vi.waitFor(() => {
      expect(store.watchers()).toEqual({ total: 2, following: false });
    });
    expect(store.reminder()).toBeNull();
    expect(watch).toHaveBeenCalledWith({ kind: 'task', taskKey: 'CAD-482' });
  });

  it('keeps the typed route error of a failed read, and reads again on retry', async () => {
    read.mockRejectedValueOnce(
      new DeletedTaskRouteError({ key: 'CAD-482', name: 'Old sign-in screen' }, 'entry-1'),
    );
    TestBed.configureTestingModule({
      providers: [
        TaskDetailStore,
        {
          provide: TaskDetailApi,
          useValue: {
            read,
            watchers: () => Promise.resolve({ total: 0, following: false }),
            reminder: () => Promise.resolve(null),
          },
        },
        {
          provide: TaskDetailOpener,
          useValue: { open: vi.fn(), notifyChanged: vi.fn(), taskKey: signal('CAD-482') },
        },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
        { provide: CwToastService, useValue: { show, error, warning } },
      ],
    });
    const store: TaskDetailStoreInstance = TestBed.inject(TaskDetailStore);
    store.open('CAD-482', null);

    await vi.waitFor(() => {
      expect(store.error()).toBeInstanceOf(DeletedTaskRouteError);
    });
    expect(store.ready()).toBe(false);
    expect(store.loading()).toBe(false);

    await store.reload();

    expect(read).toHaveBeenCalledTimes(2);
    expect(store.error()).toBeNull();
    expect(store.ready()).toBe(true);
  });

  it('shows the parts of a partial detail and reads the missing comments on retry', async () => {
    read.mockResolvedValueOnce(detailAt(4, { comments: null, partial: ['comments'] }));
    const store: TaskDetailStoreInstance = await setup();

    expect(store.task()?.name).toBe('Redesign the SSO sign-in screen');
    expect(store.comments()).toBeNull();
    expect(store.commentsFailed()).toBe(true);
    expect(store.partial()).toEqual(['comments']);

    await store.reloadComments();

    expect(readComments).toHaveBeenCalledWith('CAD-482');
    expect(store.comments()?.total).toBe(1);
    expect(store.commentsFailed()).toBe(false);
    expect(store.partial()).toEqual([]);
  });

  it('shows a change at once and confirms the saved task with its new version', async () => {
    let resolve: (task: TaskDetailTask) => void = () => undefined;
    update.mockReturnValueOnce(
      new Promise<TaskDetailTask>((done: (task: TaskDetailTask) => void) => {
        resolve = done;
      }),
    );
    const store: TaskDetailStoreInstance = await setup();

    const saved: Promise<boolean> = store.update({ priority: 'urgente' });

    expect(store.task()?.priority).toBe('urgente');
    expect(store.isPending('priority')).toBe(true);
    expect(store.pendingFields()).toEqual(['priority']);
    await vi.waitFor(() => {
      expect(update).toHaveBeenCalledWith('CAD-482', 4, { priority: 'urgente' });
    });
    resolve(taskAt(5, { priority: 'urgente' }));

    await expect(saved).resolves.toBe(true);
    expect(store.isPending('priority')).toBe(false);
    expect(store.task()?.priority).toBe('urgente');
    expect(store.confirmedTask()?.version).toBe(5);
  });

  it('sends the writes one after the other, each against the newest version', async () => {
    const store: TaskDetailStoreInstance = await setup();

    const first: Promise<boolean> = store.update({ name: 'Redesign the SSO screen' });
    const second: Promise<boolean> = store.update({ priority: 'basse' });

    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(update.mock.calls.map((call: unknown[]) => call[1])).toEqual([4, 5]);
    expect(store.confirmedTask()?.version).toBe(6);
  });

  it('puts the confirmed status back and shows the failure toast when a write is refused', async () => {
    update.mockRejectedValueOnce(new HttpErrorResponse({ status: 500 }));
    const store: TaskDetailStoreInstance = await setup();

    const saved: Promise<boolean> = store.update({ status: 'review' });

    expect(store.task()?.status).toBe('review');
    expect(store.header()?.status).toBe('review');
    await expect(saved).resolves.toBe(false);
    expect(store.task()?.status).toBe('progress');
    expect(store.header()?.status).toBe('progress');
    expect(store.isPending('status')).toBe(false);
    expect(error).toHaveBeenCalledWith('Could not save the change', {
      description: 'The server did not answer. Try again in a moment.',
    });
  });

  it('says a description draft is kept when its write conflicts or fails', async () => {
    update
      .mockRejectedValueOnce(new TaskVersionConflict('CAD-482'))
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    const store: TaskDetailStoreInstance = await setup();

    await expect(
      store.update({ description: 'Draft' }, { key: 'CAD-482', draftKept: true }),
    ).resolves.toBe(false);
    expect(warning).toHaveBeenCalledWith('CAD-482 changed elsewhere', {
      description: 'Its latest version is shown; your description is kept as a draft.',
    });

    await expect(
      store.update({ description: 'Draft' }, { key: 'CAD-482', draftKept: true }),
    ).resolves.toBe(false);
    expect(error).toHaveBeenCalledWith('Could not save the change', {
      description: 'Your description is kept as a draft on this device.',
    });
  });

  it('writes another task than the open one when the update names it', async () => {
    const store: TaskDetailStoreInstance = await setup();
    store.accept(taskAt(3, { id: 'CAD-777', key: 'CAD-777' }));

    await expect(store.update({ description: 'Draft' }, { key: 'CAD-777' })).resolves.toBe(true);

    expect(update).toHaveBeenCalledExactlyOnceWith('CAD-777', 3, { description: 'Draft' });
    expect(store.task()?.key).toBe('CAD-482');
  });

  it('reads the task again and warns when its version changed elsewhere (412)', async () => {
    update.mockRejectedValueOnce(new TaskVersionConflict('CAD-482'));
    read
      .mockResolvedValueOnce(detailAt(4))
      .mockResolvedValueOnce(detailAt(7, { task: taskAt(7, { priority: 'basse' }) }));
    const store: TaskDetailStoreInstance = await setup();

    const saved: boolean = await store.update({ priority: 'urgente' });

    expect(saved).toBe(false);
    expect(warning).toHaveBeenCalledWith('CAD-482 changed elsewhere', {
      description: 'Its latest version is shown.',
    });
    await vi.waitFor(() => {
      expect(store.confirmedTask()?.version).toBe(7);
    });
    expect(store.task()?.priority).toBe('basse');
    expect(error).not.toHaveBeenCalled();
  });

  it('reads the task again after a pushed change without overwriting a pending value', async () => {
    vi.useFakeTimers();
    update.mockReturnValueOnce(new Promise<TaskDetailTask>(() => undefined));
    read
      .mockResolvedValueOnce(detailAt(4))
      .mockResolvedValueOnce(detailAt(5, { task: taskAt(5, { name: 'Renamed elsewhere' }) }));
    const store: TaskDetailStoreInstance = await setup();
    void store.update({ priority: 'urgente' });

    notices.next({
      id: 'n1',
      type: 'task.updated.v1',
      at: '2026-11-06T11:00:00Z',
      data: { taskId: '0190d2c4-0000-7000-8000-000000000001', changed: ['name'] },
    });
    notices.next({
      id: 'n2',
      type: 'task.status-changed.v1',
      at: '2026-11-06T11:00:00Z',
      data: { taskId: '0190d2c4-0000-7000-8000-000000000001', changed: ['status'] },
    });
    await vi.advanceTimersByTimeAsync(NOTICE_WINDOW_MS);

    expect(read).toHaveBeenCalledTimes(2);
    expect(store.task()?.name).toBe('Renamed elsewhere');
    expect(store.task()?.priority).toBe('urgente');
    expect(store.isPending('priority')).toBe(true);
  });

  it('reads the comments on a pushed comment and counts the Git link notices', async () => {
    vi.useFakeTimers();
    const store: TaskDetailStoreInstance = await setup();

    notices.next({
      id: 'n1',
      type: 'comment.created.v1',
      at: '2026-11-06T11:00:00Z',
      data: {
        taskId: '0190d2c4-0000-7000-8000-000000000001',
        commentId: '0190d2c4-0000-7000-8000-000000000002',
      },
    });
    notices.next({
      id: 'n2',
      type: 'git.links-changed.v1',
      at: '2026-11-06T11:00:00Z',
      data: { taskId: '0190d2c4-0000-7000-8000-000000000001' },
    });
    await vi.advanceTimersByTimeAsync(NOTICE_WINDOW_MS);

    expect(readComments).toHaveBeenCalledOnce();
    expect(store.commentsRevision()).toBe(1);
    expect(store.gitRevision()).toBe(1);
    expect(read).toHaveBeenCalledOnce();
  });

  it('applies the notices pushed while the first read runs once the detail is shown', async () => {
    vi.useFakeTimers();
    let answer: (detail: TaskDetail) => void = (): void => undefined;
    read.mockReturnValueOnce(
      new Promise<TaskDetail>((resolve: (detail: TaskDetail) => void) => {
        answer = resolve;
      }),
    );
    read.mockResolvedValueOnce(detailAt(5, { task: taskAt(5, { name: 'Renamed elsewhere' }) }));
    TestBed.configureTestingModule({
      providers: [
        TaskDetailStore,
        {
          provide: TaskDetailApi,
          useValue: {
            read,
            readComments,
            watchers: () => Promise.resolve({ total: 2, following: false }),
            reminder: reminderRead,
          },
        },
        { provide: RealtimeConnection, useValue: { watch, reconnected } },
        {
          provide: TaskDetailOpener,
          useValue: { open: openTask, notifyChanged, taskKey: openedKey },
        },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
        { provide: CwToastService, useValue: { show, error, warning, dismiss: vi.fn() } },
      ],
    });
    const store: TaskDetailStoreInstance = TestBed.inject(TaskDetailStore);
    store.open('CAD-482', null);
    TestBed.tick();

    for (const type of ['task.updated.v1', 'comment.created.v1', 'git.links-changed.v1']) {
      notices.next({
        id: type,
        type,
        at: '2026-11-06T11:00:00Z',
        data: { taskId: '0190d2c4-0000-7000-8000-000000000001' },
      });
    }
    await vi.advanceTimersByTimeAsync(NOTICE_WINDOW_MS);

    expect(store.gitRevision()).toBe(1);
    expect(readComments).not.toHaveBeenCalled();
    answer(detailAt(4));
    await vi.advanceTimersByTimeAsync(0);

    expect(read).toHaveBeenCalledTimes(2);
    expect(readComments).toHaveBeenCalledOnce();
    expect(store.commentsRevision()).toBe(1);
    await vi.waitFor(() => {
      expect(store.task()?.name).toBe('Renamed elsewhere');
    });
    expect(store.developmentRevision()).toBe(1);
  });

  it('reads every part again after the socket reconnects', async () => {
    vi.useFakeTimers();
    const store: TaskDetailStoreInstance = await setup();

    reconnected.next();
    await vi.advanceTimersByTimeAsync(NOTICE_WINDOW_MS);

    expect(read).toHaveBeenCalledTimes(2);
    expect(readComments).toHaveBeenCalledOnce();
    expect(store.commentsRevision()).toBe(1);
    expect(store.gitRevision()).toBe(1);
  });

  it('follows the task at once, takes the new version and says so', async () => {
    const store: TaskDetailStoreInstance = await setup();
    await vi.waitFor(() => {
      expect(store.watchers()).not.toBeNull();
    });

    const done: Promise<void> = store.toggleWatch();

    expect(store.watchers()).toEqual({ total: 3, following: true });
    await done;
    expect(follow).toHaveBeenCalledWith('CAD-482', 'u1', true);
    expect(store.confirmedTask()?.version).toBe(5);
    expect(show).toHaveBeenCalledWith('You follow CAD-482', {
      description: 'Comments and changes will reach your inbox.',
    });
  });

  it('puts the watchers back when following is refused', async () => {
    follow.mockRejectedValueOnce(new HttpErrorResponse({ status: 403 }));
    const store: TaskDetailStoreInstance = await setup();
    await vi.waitFor(() => {
      expect(store.watchers()).not.toBeNull();
    });

    await store.toggleWatch();

    expect(store.watchers()).toEqual({ total: 2, following: false });
    expect(error).toHaveBeenCalledOnce();
  });

  it('attaches the task to a parent, reads the detail again and offers Undo', async () => {
    const store: TaskDetailStoreInstance = await setup();

    const attached: boolean = await store.attachTo({ key: 'CAD-470', name: 'Sign-in' });

    expect(attached).toBe(true);
    expect(update).toHaveBeenCalledWith('CAD-482', 4, { parentKey: 'CAD-470' });
    const [title, options]: [string, CwToastOptions?] = show.mock.calls[0];
    expect(title).toBe('CAD-482 attached to CAD-470');
    expect(options?.description).toBe('It is now a subtask of “Sign-in”.');
    await vi.waitFor(() => {
      expect(read).toHaveBeenCalledTimes(2);
    });
    options?.undo?.();
    await vi.waitFor(() => {
      expect(update).toHaveBeenLastCalledWith('CAD-482', 5, { parentKey: null });
    });
  });

  it('says why a parent beyond the limits is refused', async () => {
    update.mockRejectedValueOnce(
      new HttpErrorResponse({
        status: 422,
        error: { status: 422, code: 'task.subtask-depth-exceeded', title: 'Refused' },
      }),
    );
    const store: TaskDetailStoreInstance = await setup();

    await store.attachTo({ key: 'CAD-470', name: 'Sign-in' });

    expect(error).toHaveBeenCalledWith('Could not save the change', {
      description:
        'Maximum level reached: 3 levels (task, subtask, sub-subtask). Use the checklist to go into more detail.',
    });
  });

  it('duplicates the task with a fresh idempotency key and opens the copy from the toast', async () => {
    const store: TaskDetailStoreInstance = await setup();

    await store.duplicate();

    expect(duplicate).toHaveBeenCalledWith('CAD-482', 4, expect.stringMatching(/^[0-9a-f-]{36}$/u));
    const [title, options]: [string, CwToastOptions?] = show.mock.calls[0];
    expect(title).toBe('Task duplicated');
    expect(options?.description).toBe('CAD-495 · Redesign (copy)');
    expect(options?.action?.label).toBe('Open');
    options?.action?.run();
    expect(openTask).toHaveBeenCalledWith('CAD-495', expect.objectContaining({ key: 'CAD-495' }));
  });

  it('archives the task against its version and restores it from Undo', async () => {
    const store: TaskDetailStoreInstance = await setup();

    await expect(store.archive()).resolves.toBe(true);

    expect(archive).toHaveBeenCalledWith('CAD-482', 4);
    const [title, options]: [string, CwToastOptions?] = show.mock.calls[0];
    expect(title).toBe('CAD-482 archived');
    expect(options?.description).toBe('Find it in the Archives, at the bottom of the sidebar.');
    options?.undo?.();
    expect(unarchive).toHaveBeenCalledWith('CAD-482');
  });

  it('deletes the task with its subtasks and restores the trash entry from Undo', async () => {
    const store: TaskDetailStoreInstance = await setup();

    await expect(store.trash()).resolves.toBe(true);

    expect(trash).toHaveBeenCalledWith('CAD-482', 4);
    const [title, options]: [string, CwToastOptions?] = show.mock.calls[0];
    expect(title).toBe('CAD-482 deleted');
    expect(options?.description).toBe('With 3 subtasks. Kept 30 days in the trash.');
    options?.undo?.();
    expect(restore).toHaveBeenCalledWith('entry-1');
  });

  it('tells the view under the detail once an Undo restored the task', async () => {
    const store: TaskDetailStoreInstance = await setup();
    await store.archive();
    const [, archived]: [string, CwToastOptions?] = show.mock.calls[0];
    archived?.undo?.();
    await vi.waitFor(() => {
      expect(notifyChanged).toHaveBeenCalledWith('CAD-482');
    });

    notifyChanged.mockClear();
    await store.trash();
    const [, trashed]: [string, CwToastOptions?] = show.mock.calls[1];
    trashed?.undo?.();
    await vi.waitFor(() => {
      expect(notifyChanged).toHaveBeenCalledWith('CAD-482');
    });
  });

  it('archives, deletes and duplicates against the version an earlier write confirmed', async () => {
    const store: TaskDetailStoreInstance = await setup();

    const renamed: Promise<boolean> = store.update({ name: 'Redesign the sign-in' });
    await store.duplicate();
    await renamed;
    expect(update).toHaveBeenCalledWith('CAD-482', 4, { name: 'Redesign the sign-in' });
    expect(duplicate).toHaveBeenCalledWith('CAD-482', 5, expect.any(String));

    void store.update({ name: 'Redesign the SSO sign-in' });
    await store.archive();
    expect(archive).toHaveBeenCalledWith('CAD-482', 6);

    void store.update({ name: 'Redesign' });
    await store.trash();
    expect(trash).toHaveBeenCalledWith('CAD-482', 7);
  });

  it('saves the reminder notes one after the other, the last one winning', async () => {
    reminderRead.mockResolvedValue({
      id: 'r1',
      at: '2026-11-09T08:00:00Z',
      note: '',
      fired: false,
    });
    const store: TaskDetailStoreInstance = await setup();
    await vi.waitFor(() => {
      expect(store.reminder()?.id).toBe('r1');
    });
    let answer: (saved: TaskReminder) => void = () => undefined;
    saveReminderNote.mockReturnValueOnce(
      new Promise<TaskReminder>((resolve: (saved: TaskReminder) => void) => {
        answer = resolve;
      }),
    );

    const first: Promise<void> = store.saveReminderNote('Call');
    await vi.waitFor(() => {
      expect(saveReminderNote).toHaveBeenCalledTimes(1);
    });
    const second: Promise<void> = store.saveReminderNote('Call Hugo');
    const third: Promise<void> = store.saveReminderNote('Call Hugo back');
    expect(store.reminder()?.note).toBe('Call Hugo back');
    answer({ id: 'r1', at: '2026-11-09T08:00:00Z', note: 'Call', fired: false });
    await Promise.all([first, second, third]);

    expect(saveReminderNote.mock.calls.map((call: unknown[]) => call[1])).toEqual([
      'Call',
      'Call Hugo back',
    ]);
    expect(store.reminder()?.note).toBe('Call Hugo back');
  });

  it('rolls back only the latest reminder note, to the last confirmed one', async () => {
    reminderRead.mockResolvedValue({
      id: 'r1',
      at: '2026-11-09T08:00:00Z',
      note: 'Call',
      fired: false,
    });
    const store: TaskDetailStoreInstance = await setup();
    await vi.waitFor(() => {
      expect(store.reminder()?.id).toBe('r1');
    });
    let refuse: (reason: unknown) => void = () => undefined;
    saveReminderNote.mockReturnValueOnce(
      new Promise<TaskReminder>((_resolve: unknown, reject: (reason: unknown) => void) => {
        refuse = reject;
      }),
    );

    const older: Promise<void> = store.saveReminderNote('Call Hugo');
    await vi.waitFor(() => {
      expect(saveReminderNote).toHaveBeenCalledTimes(1);
    });
    const newer: Promise<void> = store.saveReminderNote('Call Hugo back');
    refuse(new Error('offline'));
    await Promise.all([older, newer]);

    expect(store.reminder()?.note).toBe('Call Hugo back');
    expect(error).not.toHaveBeenCalled();

    saveReminderNote.mockRejectedValueOnce(new Error('offline'));
    await store.saveReminderNote('Call Hugo at 9');

    expect(store.reminder()?.note).toBe('Call Hugo back');
    expect(error).toHaveBeenCalledWith('Could not save the note', expect.anything());
  });

  it('tells the view under the detail when a write confirms after the detail closed', async () => {
    const store: TaskDetailStoreInstance = await setup();
    let answer: (saved: TaskDetailTask) => void = () => undefined;
    update.mockReturnValueOnce(
      new Promise<TaskDetailTask>((resolve: (saved: TaskDetailTask) => void) => {
        answer = resolve;
      }),
    );
    const saved: Promise<boolean> = store.update({ name: 'Redesign the sign-in' });
    await vi.waitFor(() => {
      expect(update).toHaveBeenCalledTimes(1);
    });

    openedKey.set(null);
    store.close();
    expect(notifyChanged).not.toHaveBeenCalled();
    answer(taskAt(5, { name: 'Redesign the sign-in' }));

    await expect(saved).resolves.toBe(true);
    expect(notifyChanged).toHaveBeenCalledExactlyOnceWith('CAD-482');
  });

  it('does not notify the view for a write confirmed while its detail is shown', async () => {
    const store: TaskDetailStoreInstance = await setup();

    await expect(store.update({ name: 'Redesign the sign-in' })).resolves.toBe(true);

    expect(notifyChanged).not.toHaveBeenCalled();
  });

  it('keeps the detail open when the deletion is refused', async () => {
    trash.mockRejectedValueOnce(new HttpErrorResponse({ status: 409 }));
    const store: TaskDetailStoreInstance = await setup();

    await expect(store.trash()).resolves.toBe(false);

    expect(error).toHaveBeenCalledWith('Could not delete the task', expect.anything());
    expect(store.action()).toBeNull();
  });

  it('sets the reminder with its note and says when', async () => {
    const store: TaskDetailStoreInstance = await setup();
    const at: Date = new Date(2026, 10, 9, 9, 0, 0);

    await expect(store.setReminder(at, 'Tomorrow, 9:00', 'Follow up')).resolves.toBe(true);

    expect(setReminder).toHaveBeenCalledWith('CAD-482', at, 'Follow up');
    expect(store.reminder()?.note).toBe('Follow up');
    expect(show).toHaveBeenCalledWith('Reminder set', { description: 'Tomorrow, 9:00 · CAD-482' });
  });

  it('forgets the task when it closes and drops a late answer', async () => {
    const store: TaskDetailStoreInstance = await setup();
    let resolve: (detail: TaskDetail) => void = () => undefined;
    read.mockReturnValueOnce(
      new Promise<TaskDetail>((done: (detail: TaskDetail) => void) => {
        resolve = done;
      }),
    );
    void store.reload();

    store.close();
    resolve(detailAt(9));
    await Promise.resolve();

    expect(store.taskKey()).toBeNull();
    expect(store.ready()).toBe(false);
  });

  it('adopts a version reported alone only when it follows the confirmed one', async () => {
    const store: TaskDetailStoreInstance = await setup();

    store.acceptVersion(5, { status: 'review' });

    expect(store.confirmedTask()?.version).toBe(5);
    expect(store.task()?.status).toBe('review');
    expect(read).toHaveBeenCalledOnce();
  });

  it('reads the task again for a version that skipped one, and writes once the read landed', async () => {
    let land: (detail: TaskDetail) => void = () => undefined;
    read.mockResolvedValueOnce(detailAt(4)).mockReturnValueOnce(
      new Promise<TaskDetail>((done: (detail: TaskDetail) => void) => {
        land = done;
      }),
    );
    const store: TaskDetailStoreInstance = await setup();

    store.acceptVersion(7);
    const saved: Promise<boolean> = store.update({ priority: 'basse' });
    await new Promise<void>((done: () => void) => setTimeout(done, 0));

    expect(store.confirmedTask()?.version).toBe(4);
    expect(read).toHaveBeenCalledTimes(2);
    expect(update).not.toHaveBeenCalled();
    land(detailAt(7, { task: taskAt(7, { name: 'Renamed elsewhere' }) }));

    await expect(saved).resolves.toBe(true);
    expect(update).toHaveBeenCalledExactlyOnceWith('CAD-482', 7, { priority: 'basse' });
  });

  it('reads the task again when a follow reports a version that skipped one', async () => {
    read.mockResolvedValueOnce(detailAt(4)).mockResolvedValueOnce(detailAt(9));
    follow.mockResolvedValueOnce(9);
    const store: TaskDetailStoreInstance = await setup();
    await vi.waitFor(() => {
      expect(store.watchers()).not.toBeNull();
    });

    await store.toggleWatch();

    await vi.waitFor(() => {
      expect(store.confirmedTask()?.version).toBe(9);
    });
    expect(read).toHaveBeenCalledTimes(2);
    expect(store.watchersRevision()).toBe(1);
  });

  it('sends the edits queued behind a 412 against the version read again', async () => {
    update.mockRejectedValueOnce(new TaskVersionConflict('CAD-482'));
    read.mockResolvedValueOnce(detailAt(4)).mockResolvedValueOnce(detailAt(7));
    const store: TaskDetailStoreInstance = await setup();

    const first: Promise<boolean> = store.update({ priority: 'urgente' });
    const second: Promise<boolean> = store.update({ name: 'Redesign the SSO screen' });

    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(true);
    expect(update.mock.calls.map((call: unknown[]) => call[1])).toEqual([4, 7]);
    expect(store.task()?.name).toBe('Redesign the SSO screen');
    expect(warning).toHaveBeenCalledOnce();
  });

  describe('once another task opens', () => {
    beforeEach(() => {
      read.mockImplementation((key: string) =>
        Promise.resolve(
          key === 'CAD-490'
            ? detailAt(2, { task: taskAt(2, { id: 'CAD-490', key: 'CAD-490', name: 'Audit' }) })
            : detailAt(4),
        ),
      );
    });

    it('still sends a queued write with its own task key and version', async () => {
      let resolve: (task: TaskDetailTask) => void = () => undefined;
      update.mockReturnValueOnce(
        new Promise<TaskDetailTask>((done: (task: TaskDetailTask) => void) => {
          resolve = done;
        }),
      );
      const store: TaskDetailStoreInstance = await setup();
      void store.update({ priority: 'urgente' });
      const second: Promise<boolean> = store.update({ name: 'Renamed' });

      store.open('CAD-490', null);
      await vi.waitFor(() => {
        expect(store.task()?.key).toBe('CAD-490');
      });
      resolve(taskAt(5, { priority: 'urgente' }));

      await expect(second).resolves.toBe(true);
      expect(update).toHaveBeenLastCalledWith('CAD-482', 5, { name: 'Renamed' });
      expect(store.task()?.name).toBe('Audit');
    });

    it('reverses a parent change from its Undo on the original task', async () => {
      const store: TaskDetailStoreInstance = await setup();
      await store.attachTo({ key: 'CAD-470', name: 'Sign-in' });
      const [, options]: [string, CwToastOptions?] = show.mock.calls[0];

      store.open('CAD-490', null);
      await vi.waitFor(() => {
        expect(store.task()?.key).toBe('CAD-490');
      });
      options?.undo?.();

      await vi.waitFor(() => {
        expect(update).toHaveBeenLastCalledWith('CAD-482', 5, { parentKey: null });
      });
      expect(store.task()?.key).toBe('CAD-490');
      expect(store.task()?.parentKey).toBeNull();
      expect(error).not.toHaveBeenCalled();
    });
  });

  it('keeps the idempotency key of a failed duplication until a copy succeeds', async () => {
    duplicate.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    const store: TaskDetailStoreInstance = await setup();

    await store.duplicate();
    await store.duplicate();
    await store.duplicate();

    const keys: unknown[] = duplicate.mock.calls.map((call: unknown[]) => call[2]);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  describe('with the status changes on its write path', () => {
    /**
     * Function shownTask
     *
     * @description
     * The confirmed task of the detail, which the properties panel hands to the status changes.
     *
     * @param {TaskDetailStoreInstance} store - The detail.
     * @returns {TaskDetailTask} The task.
     */
    function shownTask(store: TaskDetailStoreInstance): TaskDetailTask {
      const task: TaskDetailTask | null = store.confirmedTask();
      if (!task) throw new Error('No task shown');
      return task;
    }

    /**
     * Function setupLane
     *
     * @description
     * Opens CAD-482 with the status changes writing through the detail (`TASK_WRITE_LANE`).
     *
     * @param {TaskApi['changeStatus']} changeStatus - The faked status write.
     * @returns {Promise<[TaskDetailStoreInstance, TaskStatusChangesInstance]>} Both stores.
     */
    async function setupLane(
      changeStatus: TaskApi['changeStatus'],
    ): Promise<[TaskDetailStoreInstance, TaskStatusChangesInstance]> {
      const store: TaskDetailStoreInstance = await setup([
        TaskStatusChangesStore,
        { provide: TASK_WRITE_LANE, useExisting: TaskDetailStore },
        { provide: TaskApi, useValue: { changeStatus, read: vi.fn() } },
      ]);
      return [store, TestBed.inject(TaskStatusChangesStore)];
    }

    it('sends a status click against the version a field write confirmed before it settled', async () => {
      vi.useFakeTimers();
      const changeStatus: Mock<TaskApi['changeStatus']> = vi.fn<TaskApi['changeStatus']>(
        (_key: string, version: number, status: StatusKey) => of(taskAt(version + 1, { status })),
      );
      const [store, statuses]: [TaskDetailStoreInstance, TaskStatusChangesInstance] =
        await setupLane(changeStatus);

      statuses.request(shownTask(store), 'review', undefined, { quiet: true });
      await expect(store.update({ priority: 'urgente' })).resolves.toBe(true);
      await vi.advanceTimersByTimeAsync(STATUS_SETTLE_MS);

      expect(update).toHaveBeenCalledWith('CAD-482', 4, { priority: 'urgente' });
      expect(changeStatus).toHaveBeenCalledExactlyOnceWith('CAD-482', 5, 'review', null);
      expect(store.confirmedTask()?.version).toBe(6);
      expect(store.confirmedTask()?.status).toBe('review');
      await store.update({ name: 'Redesign the SSO screen' });
      expect(update).toHaveBeenLastCalledWith('CAD-482', 6, { name: 'Redesign the SSO screen' });
      expect(warning).not.toHaveBeenCalled();
    });

    it('sends a field picked during a status write after it, against its saved version', async () => {
      vi.useFakeTimers();
      const answer: Subject<TaskDetailTask> = new Subject<TaskDetailTask>();
      const changeStatus: Mock<TaskApi['changeStatus']> = vi.fn<TaskApi['changeStatus']>(
        () => answer,
      );
      const [store, statuses]: [TaskDetailStoreInstance, TaskStatusChangesInstance] =
        await setupLane(changeStatus);

      statuses.request(shownTask(store), 'review', undefined, { quiet: true });
      await vi.advanceTimersByTimeAsync(STATUS_SETTLE_MS);
      expect(changeStatus).toHaveBeenCalledExactlyOnceWith('CAD-482', 4, 'review', null);
      const picked: Promise<boolean> = store.update({ priority: 'basse' });
      await vi.advanceTimersByTimeAsync(0);
      expect(update).not.toHaveBeenCalled();

      answer.next(taskAt(5, { status: 'review' }));
      answer.complete();

      await expect(picked).resolves.toBe(true);
      expect(update).toHaveBeenCalledExactlyOnceWith('CAD-482', 5, { priority: 'basse' });
      expect(warning).not.toHaveBeenCalled();
    });
  });
});
