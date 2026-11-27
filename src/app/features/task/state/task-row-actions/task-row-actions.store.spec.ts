import { HttpErrorResponse } from '@angular/common/http';
import {
  createEnvironmentInjector,
  EnvironmentInjector,
  signal,
  type WritableSignal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { StatusKey } from '@cadenway/contracts';
import { CwToastService, type CwToastOptions } from '@cadenway/ui/components/toast';
import { type Observable, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
  type WorkspaceOrganization,
} from '@features/workspace/ports/workspace-context';

import { TaskActionsApi } from '../../data-access/services/task-actions-api/task-actions-api.service';
import { TaskApi } from '../../data-access/services/task-api/task-api.service';
import type {
  TaskBulkAction,
  TaskBulkEntry,
  TaskBulkOutcome,
} from '../../models/task-bulk/task-bulk.interface';
import type { TaskMoveTarget } from '../../models/task-move-target/task-move-target.interface';
import type { TaskSummary } from '../../models/task-summary/task-summary.interface';
import { TaskDetailOpener } from '../../services/task-detail-opener/task-detail-opener.service';
import { personOf } from '../../utils/person/person.util';
import { STATUS_SETTLE_MS } from '../task-status-changes/task-status-changes.store';
import { TASK_ROW_ACTIONS_PROVIDERS } from './task-row-actions.providers';
import {
  ROW_RECONCILE_DELAYS_MS,
  TaskRowActionsStore,
  type TaskRowActionsStoreInstance,
} from './task-row-actions.store';

/**
 * Constant task
 *
 * @description
 * CAD-482 of Sprint 14 in Atelier Nord, to do, high, assigned to Camille, at version 3.
 *
 * @type {TaskSummary}
 */
const task: TaskSummary = {
  id: 'CAD-482',
  key: 'CAD-482',
  name: 'Redesign the SSO sign-in screen',
  status: 'todo',
  cancelReason: null,
  priority: 'haute',
  assigneeIds: ['u1'],
  due: '2026-11-12',
  start: null,
  labels: [],
  subtasks: { closed: 0, total: 0 },
  checklist: { closed: 0, total: 0 },
  comments: null,
  parentKey: null,
  milestone: false,
  recurrence: 'none',
  listId: 'sprint-14',
  spaceId: 'product',
  version: 3,
};

/**
 * Constant backlog
 *
 * @description
 * The `Backlog` list of the `Product` space, a destination of `Move to`.
 *
 * @type {TaskMoveTarget}
 */
const backlog: TaskMoveTarget = {
  listId: 'backlog',
  name: 'Backlog',
  spaceName: 'Product',
  icon: 'phosphorListBulletsBold',
  tone: 'text-muted-foreground',
};

/**
 * Type Bulk
 *
 * @description
 * Signature of `TaskActionsApi.bulk`.
 *
 * @type {TaskActionsApi['bulk']}
 */
type Bulk = TaskActionsApi['bulk'];

/**
 * Function applied
 *
 * @description
 * The outcome of a write applied to CAD-482.
 *
 * @param {Partial<TaskBulkEntry>} [entry] - What the gateway returned besides the key.
 * @param {number} [affected] - Tasks affected, subtasks included.
 * @returns {TaskBulkOutcome} The outcome.
 */
function applied(entry: Partial<TaskBulkEntry> = {}, affected: number = 1): TaskBulkOutcome {
  return {
    affected,
    done: [{ taskKey: 'CAD-482', version: 4, newTaskKey: null, trashEntryId: null, ...entry }],
    failed: [],
    unknown: [],
    notSent: [],
  };
}

/**
 * Constant refused
 *
 * @description
 * The outcome of a write the gateway refused.
 *
 * @type {TaskBulkOutcome}
 */
const refused: TaskBulkOutcome = {
  affected: 0,
  done: [],
  failed: [{ taskKey: 'CAD-482' }],
  unknown: [],
  notSent: [],
};

/**
 * Constant uncertain
 *
 * @description
 * The outcome of a write without a certain answer.
 *
 * @type {TaskBulkOutcome}
 */
const uncertain: TaskBulkOutcome = {
  affected: 0,
  done: [],
  failed: [],
  unknown: [{ taskKey: 'CAD-482' }],
  notSent: [],
};

/**
 * Function deferred
 *
 * @description
 * A bulk answer the spec releases when it wants.
 *
 * @returns {{ promise: Promise<TaskBulkOutcome>; release: (outcome: TaskBulkOutcome) => void }}
 * The pending answer and its release.
 */
function deferred(): {
  promise: Promise<TaskBulkOutcome>;
  release: (outcome: TaskBulkOutcome) => void;
} {
  let release: (outcome: TaskBulkOutcome) => void = () => undefined;
  const promise: Promise<TaskBulkOutcome> = new Promise<TaskBulkOutcome>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe('TaskRowActionsStore', () => {
  let bulk: Mock<Bulk>;
  let remind: Mock<(taskKey: string, at: Date) => Promise<void>>;
  let restore: Mock<(entryId: string) => Promise<void>>;
  let changeStatus: Mock<TaskApi['changeStatus']>;
  let read: Mock<(key: string) => Observable<TaskSummary>>;
  let open: Mock<TaskDetailOpener['open']>;
  let show: Mock<(title: string, options?: CwToastOptions) => string>;
  let error: Mock<(title: string, options?: CwToastOptions) => string>;
  let warning: Mock<(title: string, options?: CwToastOptions) => string>;
  let dismiss: Mock<(id: string) => void>;
  let organization: WritableSignal<WorkspaceOrganization>;
  let page: EnvironmentInjector;

  /**
   * Function setup
   *
   * @description
   * Provides the page's row providers in their own injector (destroyed to leave the page), with
   * faked data access, opener and toasts.
   *
   * @returns {TaskRowActionsStoreInstance} The store.
   */
  function setup(): TaskRowActionsStoreInstance {
    const workspace: WorkspaceContextPort = {
      user: signal({
        id: 'u1',
        name: 'Camille Martin',
        firstName: 'Camille',
        displayName: null,
        email: 'camille.martin@ateliernord.fr',
        initials: 'CM',
      }),
      organization,
      role: signal('member'),
      can: (): boolean => true,
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: TaskActionsApi, useValue: { bulk, remind, restore } },
        { provide: TaskApi, useValue: { changeStatus, read } },
        { provide: TaskDetailOpener, useValue: { open } },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
        {
          provide: CwToastService,
          useValue: { show, error, warning, dismiss, toasts: signal([{ id: 't1' }]) },
        },
      ],
    });
    page = createEnvironmentInjector(
      TASK_ROW_ACTIONS_PROVIDERS,
      TestBed.inject(EnvironmentInjector),
    );
    return page.get(TaskRowActionsStore);
  }

  beforeEach(() => {
    bulk = vi.fn<Bulk>(() => Promise.resolve(applied()));
    remind = vi.fn(() => Promise.resolve());
    restore = vi.fn(() => Promise.resolve());
    changeStatus = vi.fn<TaskApi['changeStatus']>(
      (_key: string, version: number, status: StatusKey): Observable<TaskSummary> =>
        of({ ...task, status, version: version + 1 }),
    );
    read = vi.fn(() => of(task));
    open = vi.fn(() => Promise.resolve(true));
    show = vi.fn(() => 't1');
    error = vi.fn(() => 't2');
    warning = vi.fn(() => 't3');
    dismiss = vi.fn();
    organization = signal({
      id: 'o1',
      slug: 'atelier-nord',
      name: 'Atelier Nord',
    } as WorkspaceOrganization);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends a priority at the shown version and keeps it until a read reaches its version', async () => {
    const store: TaskRowActionsStoreInstance = setup();
    const changed: string[] = [];
    store.changed.subscribe((key: string) => changed.push(key));

    const done: Promise<void> = store.setPriority(task, 'urgente');
    expect(store.displayedTask(task).priority).toBe('urgente');
    await done;

    expect(bulk).toHaveBeenCalledExactlyOnceWith(
      [{ taskKey: 'CAD-482', version: 3 }],
      { type: 'priority', priority: 'urgente' },
      expect.any(Function),
    );
    const [title, options]: [string, CwToastOptions?] = show.mock.calls[0];
    expect(title).toBe('CAD-482 · urgent priority');
    expect(options?.description).toBe('Priority changed.');
    expect(options?.undo).toBeTypeOf('function');
    expect(changed).toEqual(['CAD-482']);
    expect(store.rows([task])[0].priority).toBe('urgente');
    expect(store.rows([{ ...task, version: 4, priority: 'basse' }])[0].priority).toBe('basse');
    expect(read).not.toHaveBeenCalled();
  });

  it('puts the confirmed priority back with the failure toast when the write is refused', async () => {
    bulk.mockResolvedValue(refused);
    const store: TaskRowActionsStoreInstance = setup();

    const done: Promise<void> = store.setPriority(task, 'urgente');
    expect(store.displayedTask(task).priority).toBe('urgente');
    await done;

    expect(error).toHaveBeenCalledExactlyOnceWith('The task could not be changed');
    expect(store.displayedTask(task).priority).toBe('haute');
    expect(show).not.toHaveBeenCalled();
  });

  it('reads a refused task back and warns when it changed elsewhere, showing its values', async () => {
    bulk.mockResolvedValue(refused);
    read.mockReturnValue(of({ ...task, priority: 'basse', version: 5 }));
    const store: TaskRowActionsStoreInstance = setup();

    await store.setPriority(task, 'urgente');

    expect(warning).toHaveBeenCalledWith('CAD-482 changed elsewhere', {
      description: 'Its latest version is shown.',
    });
    expect(error).not.toHaveBeenCalled();
    expect(store.displayedTask(task).priority).toBe('basse');
  });

  it('offers no Undo when the returned version shows another change, and reads the task', async () => {
    bulk.mockResolvedValue(applied({ version: 6 }));
    read.mockReturnValue(of({ ...task, priority: 'urgente', version: 6 }));
    const store: TaskRowActionsStoreInstance = setup();

    await store.setPriority(task, 'urgente');

    expect(show.mock.calls[0][1]?.undo).toBeUndefined();
    await vi.waitFor(() => {
      expect(read).toHaveBeenCalledWith('CAD-482');
    });
  });

  it('undoes a move against the version it returned, back to the confirmed list', async () => {
    const store: TaskRowActionsStoreInstance = setup();

    await store.moveTo(task, backlog);
    const [title, options]: [string, CwToastOptions?] = show.mock.calls[0];
    expect(title).toBe('CAD-482 moved');
    expect(options?.description).toBe('To Backlog.');
    bulk.mockResolvedValue(applied({ version: 5 }));

    options?.undo?.();

    await vi.waitFor(() => {
      expect(bulk).toHaveBeenCalledTimes(2);
    });
    expect(bulk.mock.calls[1].slice(0, 2)).toEqual([
      [{ taskKey: 'CAD-482', version: 4 }],
      { type: 'move', listId: 'sprint-14' },
    ]);
  });

  it('takes the Undo snapshot from the confirmed state when the write starts', async () => {
    const first: ReturnType<typeof deferred> = deferred();
    bulk.mockImplementationOnce(() => first.promise);
    const store: TaskRowActionsStoreInstance = setup();

    const urgent: Promise<void> = store.setPriority(task, 'urgente');
    const low: Promise<void> = store.setPriority(task, 'basse');
    expect(store.displayedTask(task).priority).toBe('basse');
    first.release(refused);
    await Promise.all([urgent, low]);
    expect(store.displayedTask(task).priority).toBe('basse');

    show.mock.calls[0][1]?.undo?.();

    await vi.waitFor(() => {
      expect(bulk).toHaveBeenCalledTimes(3);
    });
    expect(bulk.mock.calls[2][1]).toEqual({ type: 'priority', priority: 'haute' });
  });

  it('keeps an applied value when a later write of the task is refused', async () => {
    const store: TaskRowActionsStoreInstance = setup();
    await store.setPriority(task, 'urgente');
    bulk.mockResolvedValue(refused);
    read.mockReturnValue(of({ ...task, priority: 'urgente', version: 4 }));

    await store.moveTo(task, backlog);

    expect(store.displayedTask(task)).toMatchObject({ priority: 'urgente', listId: 'sprint-14' });
    expect(error).toHaveBeenCalledWith('The task could not be changed');
  });

  it('sends a second write at the version the first one returned', async () => {
    const store: TaskRowActionsStoreInstance = setup();
    await store.setPriority(task, 'urgente');
    bulk.mockResolvedValue(applied({ version: 5 }));

    await store.moveTo(task, backlog);

    expect(bulk.mock.calls[1][0]).toEqual([{ taskKey: 'CAD-482', version: 4 }]);
    expect(show.mock.calls[1][1]?.undo).toBeTypeOf('function');
  });

  it('sends the writes of one task one after the other', async () => {
    const first: ReturnType<typeof deferred> = deferred();
    bulk.mockImplementationOnce(() => first.promise);
    const store: TaskRowActionsStoreInstance = setup();

    const urgent: Promise<void> = store.setPriority(task, 'urgente');
    const moved: Promise<void> = store.moveTo(task, backlog);
    await Promise.resolve();

    expect(bulk).toHaveBeenCalledOnce();
    expect(store.displayedTask(task)).toMatchObject({ priority: 'urgente', listId: 'backlog' });
    first.release(applied());
    await Promise.all([urgent, moved]);
    expect(bulk).toHaveBeenCalledTimes(2);
  });

  it('keeps an uncertain value and holds the next write until a read back settles it', async () => {
    vi.useFakeTimers();
    bulk.mockResolvedValueOnce(uncertain);
    read.mockReturnValue(of({ ...task, listId: 'backlog', version: 4 }));
    const store: TaskRowActionsStoreInstance = setup();

    void store.moveTo(task, backlog);
    await vi.advanceTimersByTimeAsync(0);
    void store.setPriority(task, 'urgente');
    await vi.advanceTimersByTimeAsync(ROW_RECONCILE_DELAYS_MS[0] - 1);

    expect(warning).toHaveBeenCalledWith('The outcome is unknown. The task is being refreshed.');
    expect(store.displayedTask(task).listId).toBe('backlog');
    expect(bulk).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);

    expect(read).toHaveBeenCalledWith('CAD-482');
    expect(store.displayedTask(task).listId).toBe('backlog');
    expect(bulk).toHaveBeenCalledTimes(2);
    expect(bulk.mock.calls[1][0]).toEqual([{ taskKey: 'CAD-482', version: 4 }]);
    expect(error).not.toHaveBeenCalled();
  });

  it('drops an uncertain value once the reads still find the task at the version sent', async () => {
    vi.useFakeTimers();
    bulk.mockResolvedValue(uncertain);
    const store: TaskRowActionsStoreInstance = setup();

    void store.moveTo(task, backlog);
    for (const delay of ROW_RECONCILE_DELAYS_MS) await vi.advanceTimersByTimeAsync(delay);

    expect(read).toHaveBeenCalledTimes(ROW_RECONCILE_DELAYS_MS.length);
    expect(store.displayedTask(task).listId).toBe('sprint-14');
    expect(error).toHaveBeenCalledWith('The task could not be changed');
  });

  it('removes an assignee the task has, and assigns one it has not', async () => {
    const store: TaskRowActionsStoreInstance = setup();

    const removed: Promise<void> = store.toggleAssignee(task, personOf('u1', 'Camille Martin'));
    expect(store.displayedTask(task).assigneeIds).toEqual([]);
    await removed;
    bulk.mockResolvedValue(applied({ version: 5 }));
    await store.toggleAssignee(
      { ...task, assigneeIds: [], version: 4 },
      personOf('u2', 'Inès Roy'),
    );

    expect(bulk.mock.calls.map((call) => call[1])).toEqual<TaskBulkAction[]>([
      { type: 'unassign', userId: 'u1' },
      { type: 'assign', userId: 'u2' },
    ]);
    expect(show.mock.calls.map((call) => call[0])).toEqual([
      'Camille Martin removed',
      'Inès Roy assigned',
    ]);
  });

  it('confirms a deletion, hides the task, then restores it with Undo', async () => {
    bulk.mockResolvedValue(applied({ version: null, trashEntryId: 'trash-1' }, 3));
    const store: TaskRowActionsStoreInstance = setup();
    const changed: string[] = [];
    store.changed.subscribe((key: string) => changed.push(key));

    store.askDelete(task);
    expect(store.deleteOpen()).toBe(true);
    expect(store.deleteTitle()).toBe('Delete “Redesign the SSO sign-in screen”?');
    expect(store.deleteText()).toBe(
      'It goes to the trash with its subtasks, where it stays 30 days.',
    );
    expect(store.deleteItems()).toEqual(['CAD-482 · Redesign the SSO sign-in screen']);

    const trashed: Promise<void> = store.trash();
    expect(store.rows([task])).toEqual([]);
    expect(store.deleting()).toBe(true);
    await trashed;

    expect(store.deleteOpen()).toBe(false);
    expect(store.deleting()).toBe(false);
    const [title, options]: [string, CwToastOptions?] = show.mock.calls[0];
    expect(title).toBe('CAD-482 deleted');
    expect(options?.description).toBe('With 2 subtasks. Kept 30 days in the trash.');

    options?.undo?.();

    await vi.waitFor(() => {
      expect(store.rows([task])).toHaveLength(1);
    });
    expect(restore).toHaveBeenCalledExactlyOnceWith('trash-1');
    expect(changed).toEqual(['CAD-482', 'CAD-482']);
  });

  it('brings a task back when its deletion is refused', async () => {
    bulk.mockResolvedValue(refused);
    const store: TaskRowActionsStoreInstance = setup();

    store.askDelete(task);
    await store.trash();

    expect(store.rows([task])).toHaveLength(1);
    expect(error).toHaveBeenCalledWith('The task could not be deleted');
  });

  it('keeps a deletion without a certain outcome hidden until a read finds the task gone', async () => {
    vi.useFakeTimers();
    bulk.mockResolvedValue(uncertain);
    read.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const store: TaskRowActionsStoreInstance = setup();

    store.askDelete(task);
    const trashed: Promise<void> = store.trash();
    store.sync([task]);
    await vi.advanceTimersByTimeAsync(0);
    store.sync([]);
    expect(store.rows([task])).toEqual([]);
    await vi.advanceTimersByTimeAsync(ROW_RECONCILE_DELAYS_MS[0]);
    await trashed;

    expect(store.rows([task])).toEqual([]);
    expect(store.deleting()).toBe(false);
    expect(error).not.toHaveBeenCalled();
  });

  it('shows a restored task again, with changed, when its restore is refused', async () => {
    bulk.mockResolvedValue(applied({ trashEntryId: 'trash-1' }));
    restore.mockRejectedValue(new HttpErrorResponse({ status: 404 }));
    const store: TaskRowActionsStoreInstance = setup();
    const changed: string[] = [];
    store.changed.subscribe((key: string) => changed.push(key));
    store.askDelete(task);
    await store.trash();

    show.mock.calls[0][1]?.undo?.();

    await vi.waitFor(() => {
      expect(error).toHaveBeenCalledWith('The task could not be restored');
    });
    expect(changed).toEqual(['CAD-482', 'CAD-482']);
    expect(store.rows([task])).toHaveLength(1);
  });

  it('shows a deleted task again once a read no longer holds it, and prunes confirmed values', async () => {
    bulk.mockResolvedValueOnce(applied());
    const store: TaskRowActionsStoreInstance = setup();
    await store.setPriority(task, 'urgente');
    store.sync([{ ...task, version: 4, priority: 'urgente' }]);

    expect(store.displayedTask(task).priority).toBe('haute');
    bulk.mockResolvedValueOnce(applied({ version: null, trashEntryId: 'trash-1' }));
    store.askDelete(task);
    await store.trash();
    store.sync([task]);
    expect(store.rows([task])).toEqual([]);
    store.sync([]);

    expect(store.rows([task])).toHaveLength(1);
  });

  it('opens the copy of a duplicated task from its toast, only in its organization', async () => {
    bulk.mockResolvedValue(applied({ newTaskKey: 'CAD-501' }));
    const store: TaskRowActionsStoreInstance = setup();

    await store.duplicate(task);

    const [title, options]: [string, CwToastOptions?] = show.mock.calls[0];
    expect(title).toBe('Task duplicated');
    expect(options?.description).toBe('CAD-501');
    expect(options?.undo).toBeUndefined();
    options?.action?.run();
    expect(open).toHaveBeenCalledWith('CAD-501', undefined);
    organization.set({ id: 'o2', slug: 'other', name: 'Other' } as WorkspaceOrganization);
    options?.action?.run();
    expect(open).toHaveBeenCalledOnce();
  });

  it('dismisses its toasts when the page is left and shows no success toast after', async () => {
    const store: TaskRowActionsStoreInstance = setup();
    await store.setPriority(task, 'urgente');
    const late: ReturnType<typeof deferred> = deferred();
    bulk.mockImplementationOnce(() => late.promise);
    const moved: Promise<void> = store.moveTo(task, backlog);
    await Promise.resolve();

    page.destroy();
    late.release(applied({ version: 5 }));
    await moved;

    expect(dismiss).toHaveBeenCalledWith('t1');
    expect(show).toHaveBeenCalledOnce();
  });

  it('sets a reminder tomorrow at 9 and says when it fails', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 8, 10));
    const store: TaskRowActionsStoreInstance = setup();

    await store.remind(task);

    expect(remind).toHaveBeenCalledExactlyOnceWith('CAD-482', new Date(2026, 10, 9, 9));
    expect(show).toHaveBeenCalledWith('Reminder set', {
      description: 'Mon, Nov 9, 9 AM · CAD-482',
    });
    remind.mockRejectedValue(new HttpErrorResponse({ status: 503 }));
    await store.remind(task);
    expect(error).toHaveBeenCalledWith('The reminder could not be set');
  });

  it('never sends a queued reminder once the organization changed', async () => {
    const first: ReturnType<typeof deferred> = deferred();
    bulk.mockImplementationOnce(() => first.promise);
    const store: TaskRowActionsStoreInstance = setup();

    const urgent: Promise<void> = store.setPriority(task, 'urgente');
    const reminded: Promise<void> = store.remind(task);
    await Promise.resolve();
    organization.set({ id: 'o2', slug: 'other', name: 'Other' } as WorkspaceOrganization);
    first.release(applied());
    await Promise.all([urgent, reminded]);

    expect(remind).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('sends no Undo once the organization changed', async () => {
    const store: TaskRowActionsStoreInstance = setup();
    await store.setPriority(task, 'urgente');
    organization.set({ id: 'o2', slug: 'other', name: 'Other' } as WorkspaceOrganization);

    show.mock.calls[0][1]?.undo?.();
    await Promise.resolve();

    expect(bulk).toHaveBeenCalledOnce();
  });

  it('copies the shareable link and the key of the task', async () => {
    const writeText: Mock<(text: string) => Promise<void>> = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    try {
      const store: TaskRowActionsStoreInstance = setup();

      await store.copyLink(task);
      await store.copyKey(task);

      expect(writeText.mock.calls.map((call) => call[0])).toEqual([
        `${location.origin}/atelier-nord/t/CAD-482`,
        'CAD-482',
      ]);
      expect(show.mock.calls.map((call) => call[0])).toEqual(['Link copied', 'Identifier copied']);
    } finally {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('opens the detail with the line as its preview', () => {
    const store: TaskRowActionsStoreInstance = setup();

    store.open(task);

    expect(open).toHaveBeenCalledExactlyOnceWith('CAD-482', {
      key: 'CAD-482',
      name: 'Redesign the SSO sign-in screen',
      status: 'todo',
      milestone: false,
    });
  });

  it('changes a status through the shared lane and reports its completion', async () => {
    vi.useFakeTimers();
    const store: TaskRowActionsStoreInstance = setup();
    const changed: string[] = [];
    store.changed.subscribe((key: string) => changed.push(key));

    store.setStatus(task, 'progress');
    expect(store.displayedStatus(task)).toBe('progress');
    await vi.advanceTimersByTimeAsync(STATUS_SETTLE_MS);

    expect(changeStatus).toHaveBeenCalledExactlyOnceWith('CAD-482', 3, 'progress', null);
    expect(changed).toEqual(['CAD-482']);
  });

  it('sends a status change after a menu write, at the version that write returned', async () => {
    vi.useFakeTimers();
    const first: ReturnType<typeof deferred> = deferred();
    bulk.mockImplementationOnce(() => first.promise);
    const store: TaskRowActionsStoreInstance = setup();

    const urgent: Promise<void> = store.setPriority(task, 'urgente');
    store.setStatus(task, 'progress');
    await vi.advanceTimersByTimeAsync(STATUS_SETTLE_MS);
    expect(changeStatus).not.toHaveBeenCalled();
    first.release(applied());
    await urgent;
    await vi.advanceTimersByTimeAsync(0);

    expect(changeStatus).toHaveBeenCalledExactlyOnceWith('CAD-482', 4, 'progress', null);
    expect(read).not.toHaveBeenCalled();
    await store.moveTo(task, backlog);
    expect(bulk.mock.calls[1][0]).toEqual([{ taskKey: 'CAD-482', version: 5 }]);
  });

  it('puts the confirmed status back when the status write is refused', async () => {
    vi.useFakeTimers();
    changeStatus.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422 })));
    const store: TaskRowActionsStoreInstance = setup();

    store.setStatus(task, 'done');
    expect(store.displayedStatus(task)).toBe('done');
    await vi.advanceTimersByTimeAsync(STATUS_SETTLE_MS);

    expect(store.displayedStatus(task)).toBe('todo');
    expect(error).toHaveBeenCalledWith('Could not change the status', expect.anything());
  });

  it('asks the cancel reason before cancelling, and keeps the task on Keep', () => {
    const store: TaskRowActionsStoreInstance = setup();

    store.setStatus(task, 'cancelled');
    expect(store.cancelKeys()).toEqual(['CAD-482']);
    store.keepCancel();

    expect(store.cancelKeys()).toBeNull();
    expect(store.displayedStatus(task)).toBe('todo');
  });

  it('reports nothing for a write answered once the organization changed', async () => {
    const first: ReturnType<typeof deferred> = deferred();
    bulk.mockImplementationOnce(() => first.promise);
    const store: TaskRowActionsStoreInstance = setup();

    const urgent: Promise<void> = store.setPriority(task, 'urgente');
    await Promise.resolve();
    organization.set({ id: 'o2', slug: 'other', name: 'Other' } as WorkspaceOrganization);
    first.release(applied());
    await urgent;

    expect(show).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('drops a status write queued behind a menu write once the organization changed', async () => {
    vi.useFakeTimers();
    const first: ReturnType<typeof deferred> = deferred();
    bulk.mockImplementationOnce(() => first.promise);
    const store: TaskRowActionsStoreInstance = setup();

    const urgent: Promise<void> = store.setPriority(task, 'urgente');
    store.setStatus(task, 'progress');
    await vi.advanceTimersByTimeAsync(STATUS_SETTLE_MS);
    organization.set({ id: 'o2', slug: 'other', name: 'Other' } as WorkspaceOrganization);
    first.release(applied());
    await urgent;
    await vi.advanceTimersByTimeAsync(0);

    expect(changeStatus).not.toHaveBeenCalled();
    expect(store.displayedStatus(task)).toBe('todo');
    expect(error).not.toHaveBeenCalled();
  });

  it('drops a status write queued behind a menu write when the page is left', async () => {
    vi.useFakeTimers();
    const first: ReturnType<typeof deferred> = deferred();
    bulk.mockImplementationOnce(() => first.promise);
    const store: TaskRowActionsStoreInstance = setup();

    const urgent: Promise<void> = store.setPriority(task, 'urgente');
    store.setStatus(task, 'progress');
    await vi.advanceTimersByTimeAsync(STATUS_SETTLE_MS);
    page.destroy();
    first.release(applied());
    await urgent;
    await vi.advanceTimersByTimeAsync(0);

    expect(changeStatus).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('computes a queued assignee toggle from the confirmed assignees when it starts', async () => {
    const first: ReturnType<typeof deferred> = deferred();
    bulk.mockImplementationOnce(() => first.promise);
    const store: TaskRowActionsStoreInstance = setup();

    const ines: Promise<void> = store.toggleAssignee(task, personOf('u2', 'Inès Roy'));
    const hugo: Promise<void> = store.toggleAssignee(task, personOf('u3', 'Hugo Durand'));
    expect(store.displayedTask(task).assigneeIds).toEqual(['u1', 'u2', 'u3']);
    first.release(refused);
    await Promise.all([ines, hugo]);

    expect(bulk.mock.calls[1][1]).toEqual({ type: 'assign', userId: 'u3' });
    expect(store.displayedTask(task).assigneeIds).toEqual(['u1', 'u3']);
  });

  it('keeps an unconfirmed value without the failure toast when no read answers', async () => {
    vi.useFakeTimers();
    bulk.mockResolvedValueOnce(uncertain);
    read.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    const store: TaskRowActionsStoreInstance = setup();

    const moved: Promise<void> = store.moveTo(task, backlog);
    for (const delay of ROW_RECONCILE_DELAYS_MS) await vi.advanceTimersByTimeAsync(delay);
    await moved;

    expect(error).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledWith('CAD-482 is not confirmed', {
      description: 'The server did not answer. The next refresh shows the task as it is.',
    });
    expect(store.displayedTask(task).listId).toBe('backlog');
    await store.setPriority(task, 'urgente');
    expect(bulk.mock.calls[1][0]).toEqual([{ taskKey: 'CAD-482', version: 3 }]);
    store.sync([{ ...task, version: 4 }]);
    expect(store.displayedTask({ ...task, version: 4 }).listId).toBe('sprint-14');
  });

  it('leaves a deletion no read could settle to the next page read', async () => {
    vi.useFakeTimers();
    bulk.mockResolvedValueOnce(uncertain);
    read.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    const store: TaskRowActionsStoreInstance = setup();

    store.askDelete(task);
    const trashed: Promise<void> = store.trash();
    for (const delay of ROW_RECONCILE_DELAYS_MS) await vi.advanceTimersByTimeAsync(delay);
    await trashed;

    expect(store.rows([task])).toEqual([]);
    expect(error).not.toHaveBeenCalled();
    store.sync([task]);
    expect(store.rows([task])).toHaveLength(1);
  });
});
