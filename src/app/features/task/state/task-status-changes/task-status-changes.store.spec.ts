import { TestBed } from '@angular/core/testing';
import type { StatusKey } from '@cadenway/contracts';
import { CwToastService, type CwToastOptions } from '@cadenway/ui/components/toast';
import { type Observable, of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { CANCEL_REASON_LABELS, STATUS_LABELS } from '../../constants/task-copy/task-copy.constants';
import { TaskApi } from '../../data-access/services/task-api/task-api.service';
import type {
  TaskCancellation,
  TaskStatusChange,
} from '../../models/task-status-change/task-status-change.interface';
import type { TaskSummary } from '../../models/task-summary/task-summary.interface';
import { TaskVersionConflict } from '../../models/task-write-error/task-write-error.model';
import { STATUS_SETTLE_MS, TaskStatusChanges } from './task-status-changes.store';

/**
 * Constant task
 *
 * @description
 * CAD-482 of Sprint 14, to do, at version 3.
 *
 * @type {TaskSummary}
 */
const task: TaskSummary = {
  id: 'CAD-482',
  key: 'CAD-482',
  name: 'Refondre l’écran de connexion SSO',
  status: 'todo',
  cancelReason: null,
  priority: 'haute',
  assigneeIds: ['u1'],
  due: '2026-11-12',
  start: null,
  labels: ['Front'],
  subtasks: { closed: 0, total: 0 },
  checklist: { closed: 0, total: 0 },
  comments: null,
  parentKey: null,
  milestone: false,
  recurrence: 'none',
  listId: 'sprint-14',
  spaceId: 'produit',
  version: 3,
};

/**
 * Type ChangeStatus
 *
 * @description
 * Signature of `TaskApi.changeStatus`.
 *
 * @type {TaskApi['changeStatus']}
 */
type ChangeStatus = TaskApi['changeStatus'];

/**
 * Function saved
 *
 * @description
 * The task as the gateway saves it with a status, one version later.
 *
 * @param {StatusKey} status - Saved status.
 * @param {number} version - Saved version.
 * @returns {TaskSummary} The saved task.
 */
function saved(status: StatusKey, version: number = 4): TaskSummary {
  return { ...task, status, version, cancelReason: status === 'cancelled' ? 'duplicate' : null };
}

describe('TaskStatusChanges', () => {
  let changeStatus: Mock<ChangeStatus>;
  let read: Mock<(key: string) => Observable<TaskSummary>>;
  let show: Mock<(title: string, options?: CwToastOptions) => string>;
  let error: Mock<(title: string, options?: CwToastOptions) => string>;
  let warning: Mock<(title: string, options?: CwToastOptions) => string>;

  /**
   * Function setup
   *
   * @description
   * Provides the store with the faked task data access and toasts.
   *
   * @returns {InstanceType<typeof TaskStatusChanges>} The store.
   */
  function setup(): InstanceType<typeof TaskStatusChanges> {
    TestBed.configureTestingModule({
      providers: [
        TaskStatusChanges,
        { provide: TaskApi, useValue: { changeStatus, read } },
        { provide: CwToastService, useValue: { show, error, warning } },
      ],
    });
    return TestBed.inject(TaskStatusChanges);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    changeStatus = vi.fn<ChangeStatus>((_key: string, version: number, status: StatusKey) =>
      of(saved(status, version + 1)),
    );
    read = vi.fn(() => of(saved('review', 7)));
    show = vi.fn(() => 't1');
    error = vi.fn(() => 't2');
    warning = vi.fn(() => 't3');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows each click at once and sends only the last one, 460 ms after it', async () => {
    const store: InstanceType<typeof TaskStatusChanges> = setup();

    store.request(task, 'progress');
    await vi.advanceTimersByTimeAsync(200);
    store.request(task, 'review');

    expect(store.displayedStatus(task)).toBe('review');
    expect(store.pendingStatus(task.id)).toBe('review');
    expect(store.settledStatus(task)).toBe('todo');
    await vi.advanceTimersByTimeAsync(STATUS_SETTLE_MS - 1);
    expect(changeStatus).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(changeStatus).toHaveBeenCalledExactlyOnceWith('CAD-482', 3, 'review', null);
    expect(store.pendingStatus(task.id)).toBeNull();
    expect(store.displayedStatus(task)).toBe('review');
    const [title, options]: [string, CwToastOptions?] = show.mock.calls[0];
    expect(title).toContain('CAD-482');
    expect(title).toContain(STATUS_LABELS.review);
    expect(options?.description).toContain(STATUS_LABELS.todo);
    expect(options?.duration).toBe(6000);
    expect(options?.undo).toBeTypeOf('function');
  });

  it('cancels the pending change when the saved status is clicked again', async () => {
    const store: InstanceType<typeof TaskStatusChanges> = setup();

    store.request(task, 'done');
    store.request(task, 'todo');
    await vi.runAllTimersAsync();

    expect(changeStatus).not.toHaveBeenCalled();
    expect(store.displayedStatus(task)).toBe('todo');
  });

  it('emits the change when it settles, so a grouped view moves the task then', async () => {
    const store: InstanceType<typeof TaskStatusChanges> = setup();
    const changes: TaskStatusChange[] = [];
    store.changed.subscribe((change: TaskStatusChange) => changes.push(change));

    store.request(task, 'progress');
    expect(changes).toEqual([]);
    await vi.advanceTimersByTimeAsync(STATUS_SETTLE_MS);

    expect(changes).toEqual([{ taskId: 'CAD-482', from: 'todo', to: 'progress', reason: null }]);
    expect(store.settledStatus(task)).toBe('progress');
  });

  it('never overlaps two writes of one task and sends the next one against the new version', async () => {
    const answer: Subject<TaskSummary> = new Subject<TaskSummary>();
    changeStatus.mockReturnValueOnce(answer);
    const store: InstanceType<typeof TaskStatusChanges> = setup();

    store.request(task, 'progress');
    await vi.advanceTimersByTimeAsync(STATUS_SETTLE_MS);
    store.request(task, 'review');
    await vi.advanceTimersByTimeAsync(STATUS_SETTLE_MS);
    expect(changeStatus).toHaveBeenCalledOnce();

    answer.next(saved('progress', 4));
    answer.complete();
    await vi.runAllTimersAsync();

    expect(changeStatus).toHaveBeenLastCalledWith('CAD-482', 4, 'review', null);
    expect(store.displayedStatus(task)).toBe('review');
  });

  it('asks a reason before cancelling and sends it with the note', async () => {
    const store: InstanceType<typeof TaskStatusChanges> = setup();

    store.request(task, 'cancelled');
    expect(store.cancelRequest()).toEqual({ taskKeys: ['CAD-482'] });
    expect(store.displayedStatus(task)).toBe('todo');
    const cancellation: TaskCancellation = { reason: 'duplicate', note: 'remplacée par CAD-490' };
    store.confirmCancel(cancellation);
    expect(store.cancelRequest()).toBeNull();
    expect(store.displayedStatus(task)).toBe('cancelled');
    await vi.runAllTimersAsync();

    expect(changeStatus).toHaveBeenCalledExactlyOnceWith('CAD-482', 3, 'cancelled', cancellation);
    const [title, options]: [string, CwToastOptions?] = show.mock.calls[0];
    expect(title).toContain('CAD-482');
    expect(options?.description).toContain(CANCEL_REASON_LABELS.duplicate);
  });

  it('keeps the task when « Garder la tâche » closes the dialog', async () => {
    const store: InstanceType<typeof TaskStatusChanges> = setup();

    store.request(task, 'cancelled');
    store.keepTask();
    await vi.runAllTimersAsync();

    expect(store.cancelRequest()).toBeNull();
    expect(changeStatus).not.toHaveBeenCalled();
    expect(store.displayedStatus(task)).toBe('todo');
  });

  it('restores the confirmed status and shows the failure toast when the write fails', async () => {
    changeStatus.mockReturnValueOnce(throwError(() => new Error('503')));
    const store: InstanceType<typeof TaskStatusChanges> = setup();
    const changes: TaskStatusChange[] = [];
    store.changed.subscribe((change: TaskStatusChange) => changes.push(change));

    store.request(task, 'done');
    await vi.runAllTimersAsync();

    expect(store.displayedStatus(task)).toBe('todo');
    expect(store.pendingStatus(task.id)).toBeNull();
    expect(error).toHaveBeenCalledOnce();
    expect(changes.at(-1)).toEqual({ taskId: 'CAD-482', from: 'done', to: 'todo', reason: null });

    store.request(task, 'done');
    await vi.runAllTimersAsync();
    expect(changeStatus).toHaveBeenLastCalledWith('CAD-482', 3, 'done', null);
    expect(store.displayedStatus(task)).toBe('done');
  });

  it('reads the task again and warns after a 412', async () => {
    changeStatus.mockReturnValueOnce(throwError(() => new TaskVersionConflict('CAD-482')));
    const store: InstanceType<typeof TaskStatusChanges> = setup();

    store.request(task, 'done');
    await vi.runAllTimersAsync();

    expect(read).toHaveBeenCalledWith('CAD-482');
    expect(store.displayedStatus(task)).toBe('review');
    const [title, options]: [string, CwToastOptions?] = warning.mock.calls[0];
    expect(title).toContain('CAD-482');
    expect(options?.description).toContain(STATUS_LABELS.review);
    expect(show).not.toHaveBeenCalled();

    store.request(task, 'done');
    await vi.runAllTimersAsync();
    expect(changeStatus).toHaveBeenLastCalledWith('CAD-482', 7, 'done', null);
  });

  it('undoes a confirmed change at once from the toast', async () => {
    const store: InstanceType<typeof TaskStatusChanges> = setup();
    store.request(task, 'progress');
    await vi.runAllTimersAsync();
    const options: CwToastOptions | undefined = show.mock.calls[0][1];

    options?.undo?.();
    expect(store.displayedStatus(task)).toBe('todo');
    await vi.advanceTimersByTimeAsync(0);

    expect(changeStatus).toHaveBeenLastCalledWith('CAD-482', 4, 'todo', null);
    expect(store.displayedStatus(task)).toBe('todo');
    expect(show).toHaveBeenCalledOnce();
  });

  it('ignores an undo once another change moved the task on', async () => {
    const store: InstanceType<typeof TaskStatusChanges> = setup();
    store.request(task, 'progress');
    await vi.runAllTimersAsync();
    const first: CwToastOptions | undefined = show.mock.calls[0][1];
    store.request(task, 'review');
    await vi.runAllTimersAsync();

    first?.undo?.();
    await vi.runAllTimersAsync();
    expect(changeStatus).toHaveBeenLastCalledWith('CAD-482', 5, 'progress', null);
    expect(store.displayedStatus(task)).toBe('progress');

    first?.undo?.();
    await vi.runAllTimersAsync();
    expect(changeStatus).toHaveBeenCalledTimes(3);
  });

  it('lets the caller’s task win once it caught up with the confirmed version', async () => {
    const store: InstanceType<typeof TaskStatusChanges> = setup();
    store.request(task, 'progress');
    await vi.runAllTimersAsync();

    expect(store.displayedStatus({ ...task, status: 'blocked', version: 6 })).toBe('blocked');
  });
});
