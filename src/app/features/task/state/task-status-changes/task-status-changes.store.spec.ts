import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { StatusKey } from '@cadenway/contracts';
import { CwToastService, type CwToastOptions } from '@cadenway/ui/components/toast';
import { type Observable, of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { CANCEL_REASON_LABELS, STATUS_LABELS } from '../../constants/task-copy/task-copy.constants';
import { OrganizationPin, OrganizationSwitchPendingError } from '@core/api';
import { TaskApi } from '../../data-access/services/task-api/task-api.service';
import type {
  TaskCancellation,
  TaskStatusChange,
} from '../../models/task-status-change/task-status-change.interface';
import type { TaskSummary } from '../../models/task-summary/task-summary.interface';
import { TaskVersionConflict } from '../../models/task-write-error/task-write-error.model';
import { STATUS_SETTLE_MS, TaskStatusChangesStore } from './task-status-changes.store';

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

describe('TaskStatusChangesStore', () => {
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
   * @returns {InstanceType<typeof TaskStatusChangesStore>} The store.
   */
  function setup(): InstanceType<typeof TaskStatusChangesStore> {
    TestBed.configureTestingModule({
      providers: [
        TaskStatusChangesStore,
        { provide: TaskApi, useValue: { changeStatus, read } },
        { provide: CwToastService, useValue: { show, error, warning, dismiss: vi.fn() } },
      ],
    });
    return TestBed.inject(TaskStatusChangesStore);
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
    const store: InstanceType<typeof TaskStatusChangesStore> = setup();

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
    const store: InstanceType<typeof TaskStatusChangesStore> = setup();

    store.request(task, 'done');
    store.request(task, 'todo');
    await vi.runAllTimersAsync();

    expect(changeStatus).not.toHaveBeenCalled();
    expect(store.displayedStatus(task)).toBe('todo');
  });

  it('emits the change when it settles, so a grouped view moves the task then', async () => {
    const store: InstanceType<typeof TaskStatusChangesStore> = setup();
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
    const store: InstanceType<typeof TaskStatusChangesStore> = setup();

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
    const store: InstanceType<typeof TaskStatusChangesStore> = setup();

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
    const store: InstanceType<typeof TaskStatusChangesStore> = setup();

    store.request(task, 'cancelled');
    store.keepTask();
    await vi.runAllTimersAsync();

    expect(store.cancelRequest()).toBeNull();
    expect(changeStatus).not.toHaveBeenCalled();
    expect(store.displayedStatus(task)).toBe('todo');
  });

  it('restores the confirmed status and shows the failure toast when the write fails', async () => {
    changeStatus.mockReturnValueOnce(throwError(() => new Error('503')));
    const store: InstanceType<typeof TaskStatusChangesStore> = setup();
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
    const store: InstanceType<typeof TaskStatusChangesStore> = setup();

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
    const store: InstanceType<typeof TaskStatusChangesStore> = setup();
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
    const store: InstanceType<typeof TaskStatusChangesStore> = setup();
    store.request(task, 'progress');
    await vi.runAllTimersAsync();
    const first: CwToastOptions | undefined = show.mock.calls[0][1];
    store.request(task, 'review');
    await vi.runAllTimersAsync();

    first?.undo?.();
    await vi.runAllTimersAsync();
    expect(changeStatus).toHaveBeenCalledTimes(2);
    expect(store.displayedStatus(task)).toBe('review');

    show.mock.calls[1][1]?.undo?.();
    await vi.runAllTimersAsync();
    expect(changeStatus).toHaveBeenCalledTimes(3);
    expect(store.displayedStatus(task)).toBe('progress');
  });

  it('holds a pending click while asking for cancellation and discards it when kept', async () => {
    const store: InstanceType<typeof TaskStatusChangesStore> = setup();
    store.request(task, 'progress');
    store.request(task, 'cancelled');
    await vi.runAllTimersAsync();
    expect(changeStatus).not.toHaveBeenCalled();
    store.keepTask();
    expect(store.displayedStatus(task)).toBe('todo');
  });

  it('replaces a pending click with the confirmed cancellation', async () => {
    const store: InstanceType<typeof TaskStatusChangesStore> = setup();
    store.request(task, 'progress');
    store.request(task, 'cancelled');
    store.confirmCancel({ reason: 'duplicate', note: '' });
    await vi.runAllTimersAsync();
    expect(changeStatus).toHaveBeenCalledExactlyOnceWith('CAD-482', 3, 'cancelled', {
      reason: 'duplicate',
      note: '',
    });
  });

  it('cancels several tasks and undoes them from a single toast', async () => {
    const other: TaskSummary = {
      ...task,
      id: 'CAD-483',
      key: 'CAD-483',
      version: 8,
      status: 'review',
    };
    changeStatus.mockImplementation((key: string, version: number, status: StatusKey) =>
      of({
        ...(key === task.key ? task : other),
        status,
        version: version + 1,
        cancelReason: status === 'cancelled' ? 'duplicate' : null,
      }),
    );
    const store: InstanceType<typeof TaskStatusChangesStore> = setup();
    store.requestCancel([task, other]);
    expect(store.cancelRequest()?.taskKeys).toEqual(['CAD-482', 'CAD-483']);
    store.confirmCancel({ reason: 'duplicate', note: '' });
    await vi.runAllTimersAsync();
    expect(changeStatus).toHaveBeenCalledTimes(2);
    expect(show).toHaveBeenCalledOnce();
    show.mock.calls[0][1]?.undo?.();
    await vi.runAllTimersAsync();
    expect(changeStatus).toHaveBeenCalledWith('CAD-482', 4, 'todo', null);
    expect(changeStatus).toHaveBeenCalledWith('CAD-483', 9, 'review', null);
  });

  it('merges cancellation requests made while the dialog is open', () => {
    const store: InstanceType<typeof TaskStatusChangesStore> = setup();
    const other: TaskSummary = { ...task, id: 'CAD-483', key: 'CAD-483' };
    store.requestCancel([task]);
    store.requestCancel([other, task]);
    expect(store.cancelRequest()?.taskKeys).toEqual(['CAD-482', 'CAD-483']);
  });

  it('rolls back failed cancellations and reports one failure count', async () => {
    const other: TaskSummary = { ...task, id: 'CAD-483', key: 'CAD-483' };
    changeStatus.mockImplementation((key: string, version: number, status: StatusKey) =>
      key === other.key ? throwError(() => new Error('offline')) : of(saved(status, version + 1)),
    );
    const store: InstanceType<typeof TaskStatusChangesStore> = setup();
    store.requestCancel([task, other]);
    store.confirmCancel({ reason: 'duplicate', note: '' });
    await vi.runAllTimersAsync();
    expect(store.displayedStatus(task)).toBe('cancelled');
    expect(store.displayedStatus(other)).toBe('todo');
    expect(error).toHaveBeenCalledOnce();
    expect(error.mock.calls[0][0]).toContain('1');
    expect(show).toHaveBeenCalledOnce();
  });

  it('sends a pending click when the store is destroyed', () => {
    const store: InstanceType<typeof TaskStatusChangesStore> = setup();
    store.request(task, 'progress');
    TestBed.resetTestingModule();
    expect(changeStatus).toHaveBeenCalledExactlyOnceWith('CAD-482', 3, 'progress', null);
  });

  it('sends a newer pending click after the in-flight write when destroyed', async () => {
    const response: Subject<TaskSummary> = new Subject<TaskSummary>();
    changeStatus.mockReturnValueOnce(response);
    const store: InstanceType<typeof TaskStatusChangesStore> = setup();
    store.request(task, 'progress');
    await vi.advanceTimersByTimeAsync(STATUS_SETTLE_MS);
    store.request(task, 'review');
    TestBed.resetTestingModule();
    expect(changeStatus).toHaveBeenCalledTimes(1);
    response.next(saved('progress', 4));
    response.complete();
    expect(changeStatus).toHaveBeenLastCalledWith('CAD-482', 4, 'review', null);
    expect(changeStatus).toHaveBeenCalledTimes(2);
    expect(show).not.toHaveBeenCalled();
  });

  it('drops the deferred write if the organization changes after destruction', async () => {
    const response: Subject<TaskSummary> = new Subject<TaskSummary>();
    changeStatus.mockReturnValueOnce(response);
    const store: InstanceType<typeof TaskStatusChangesStore> = setup();
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    pin.set('atelier-nord');
    store.request(task, 'progress');
    await vi.advanceTimersByTimeAsync(STATUS_SETTLE_MS);
    store.request(task, 'review');
    TestBed.resetTestingModule();
    pin.set('other-organization');
    response.next(saved('progress', 4));
    response.complete();
    expect(changeStatus).toHaveBeenCalledTimes(1);
    expect(show).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(warning).not.toHaveBeenCalled();
  });

  it('allows retrying a failed undo from the same toast', async () => {
    const store: InstanceType<typeof TaskStatusChangesStore> = setup();
    store.request(task, 'progress');
    await vi.runAllTimersAsync();
    const toast: CwToastOptions | undefined = show.mock.calls[0][1];
    changeStatus.mockReturnValueOnce(throwError(() => new Error('offline')));
    toast?.undo?.();
    await vi.runAllTimersAsync();
    expect(store.displayedStatus(task)).toBe('progress');
    toast?.undo?.();
    await vi.runAllTimersAsync();
    expect(store.displayedStatus(task)).toBe('todo');
    expect(changeStatus).toHaveBeenCalledTimes(3);
  });

  it.each([
    new OrganizationSwitchPendingError(),
    new HttpErrorResponse({ status: 412, error: { code: 'organization.context-changed' } }),
  ])('rolls back without a toast during an organization switch', async (failure: unknown) => {
    changeStatus.mockReturnValueOnce(throwError(() => failure));
    const store: InstanceType<typeof TaskStatusChangesStore> = setup();
    store.request(task, 'progress');
    await vi.runAllTimersAsync();
    expect(store.displayedStatus(task)).toBe('todo');
    expect(error).not.toHaveBeenCalled();
  });

  it('lets the caller’s task win once it caught up with the confirmed version', async () => {
    const store: InstanceType<typeof TaskStatusChangesStore> = setup();
    store.request(task, 'progress');
    await vi.runAllTimersAsync();

    expect(store.displayedStatus({ ...task, status: 'blocked', version: 6 })).toBe('blocked');
  });
});
