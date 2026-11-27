import { HttpErrorResponse } from '@angular/common/http';
import { signal, type WritableSignal } from '@angular/core';
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
import {
  STATUS_SETTLE_MS,
  TaskStatusChangesStore,
} from '../task-status-changes/task-status-changes.store';
import { TaskRowActionsStore, type TaskRowActionsStoreInstance } from './task-row-actions.store';

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
 * The outcome of a write applied to one task.
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

describe('TaskRowActionsStore', () => {
  let bulk: Mock<Bulk>;
  let remind: Mock<(taskKey: string, at: Date) => Promise<void>>;
  let restore: Mock<(entryId: string) => Promise<void>>;
  let changeStatus: Mock<TaskApi['changeStatus']>;
  let open: Mock<TaskDetailOpener['open']>;
  let show: Mock<(title: string, options?: CwToastOptions) => string>;
  let error: Mock<(title: string, options?: CwToastOptions) => string>;
  let warning: Mock<(title: string, options?: CwToastOptions) => string>;
  let organization: WritableSignal<WorkspaceOrganization>;

  /**
   * Function setup
   *
   * @description
   * Provides the store and the route's status store with faked data access, opener and toasts.
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
        TaskStatusChangesStore,
        TaskRowActionsStore,
        { provide: TaskActionsApi, useValue: { bulk, remind, restore } },
        { provide: TaskApi, useValue: { changeStatus, read: vi.fn() } },
        { provide: TaskDetailOpener, useValue: { open } },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
        {
          provide: CwToastService,
          useValue: { show, error, warning, dismiss: vi.fn(), toasts: signal([]) },
        },
      ],
    });
    return TestBed.inject(TaskRowActionsStore);
  }

  beforeEach(() => {
    bulk = vi.fn<Bulk>(() => Promise.resolve(applied()));
    remind = vi.fn(() => Promise.resolve());
    restore = vi.fn(() => Promise.resolve());
    changeStatus = vi.fn<TaskApi['changeStatus']>(
      (_key: string, version: number, status: StatusKey): Observable<TaskSummary> =>
        of({ ...task, status, version: version + 1 }),
    );
    open = vi.fn(() => Promise.resolve(true));
    show = vi.fn(() => 't1');
    error = vi.fn(() => 't2');
    warning = vi.fn(() => 't3');
    organization = signal({
      id: 'o1',
      slug: 'atelier-nord',
      name: 'Atelier Nord',
    } as WorkspaceOrganization);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a priority at once, sends it and keeps it until a read reaches its version', async () => {
    const store: TaskRowActionsStoreInstance = setup();
    const changed: string[] = [];
    store.changed.subscribe((key: string) => changed.push(key));

    store.setPriority(task, 'urgente');

    expect(store.displayedTask(task).priority).toBe('urgente');
    await vi.waitFor(() => {
      expect(show).toHaveBeenCalledOnce();
    });
    expect(bulk).toHaveBeenCalledExactlyOnceWith(
      [{ taskKey: 'CAD-482' }],
      { type: 'priority', priority: 'urgente' },
      expect.any(Function),
    );
    const [title, options]: [string, CwToastOptions?] = show.mock.calls[0];
    expect(title).toBe('CAD-482 · urgent priority');
    expect(options?.description).toBe('Priority changed.');
    expect(changed).toEqual(['CAD-482']);
    expect(store.rows([task])[0].priority).toBe('urgente');
    expect(store.rows([{ ...task, version: 4, priority: 'basse' }])[0].priority).toBe('basse');
  });

  it('puts the confirmed priority back with the failure toast when the write is refused', async () => {
    bulk.mockResolvedValue(refused);
    const store: TaskRowActionsStoreInstance = setup();

    store.setPriority(task, 'urgente');
    expect(store.displayedTask(task).priority).toBe('urgente');

    await vi.waitFor(() => {
      expect(error).toHaveBeenCalledWith('The task could not be changed');
    });
    expect(store.displayedTask(task).priority).toBe('haute');
    expect(show).not.toHaveBeenCalled();
  });

  it('warns and drops the shown value when the answer is uncertain', async () => {
    bulk.mockResolvedValue(uncertain);
    const store: TaskRowActionsStoreInstance = setup();

    store.moveTo(task, backlog);

    await vi.waitFor(() => {
      expect(warning).toHaveBeenCalledWith('The outcome is unknown. The task is being refreshed.');
    });
    expect(store.displayedTask(task).listId).toBe('sprint-14');
  });

  it('undoes a move against the version the move returned', async () => {
    const store: TaskRowActionsStoreInstance = setup();

    store.moveTo(task, backlog);
    await vi.waitFor(() => {
      expect(show).toHaveBeenCalledOnce();
    });
    const [title, options]: [string, CwToastOptions?] = show.mock.calls[0];
    expect(title).toBe('CAD-482 moved');
    expect(options?.description).toBe('To Backlog.');

    options?.undo?.();

    await vi.waitFor(() => {
      expect(bulk).toHaveBeenCalledTimes(2);
    });
    expect(bulk.mock.calls[1].slice(0, 2)).toEqual([
      [{ taskKey: 'CAD-482', version: 4 }],
      { type: 'move', listId: 'sprint-14' },
    ]);
  });

  it('says so when an undo is refused because the task changed since', async () => {
    const store: TaskRowActionsStoreInstance = setup();
    store.setPriority(task, 'basse');
    await vi.waitFor(() => {
      expect(show).toHaveBeenCalledOnce();
    });
    bulk.mockResolvedValue(refused);

    show.mock.calls[0][1]?.undo?.();

    await vi.waitFor(() => {
      expect(error).toHaveBeenCalledWith('The change could not be undone');
    });
  });

  it('removes an assignee the task has, and assigns one it has not', async () => {
    const store: TaskRowActionsStoreInstance = setup();

    store.toggleAssignee(task, personOf('u1', 'Camille Martin'));
    expect(store.displayedTask(task).assigneeIds).toEqual([]);
    await vi.waitFor(() => {
      expect(show).toHaveBeenCalledOnce();
    });
    store.toggleAssignee({ ...task, assigneeIds: [], version: 4 }, personOf('u2', 'Inès Roy'));
    await vi.waitFor(() => {
      expect(show).toHaveBeenCalledTimes(2);
    });

    expect(bulk.mock.calls.map((call) => call[1])).toEqual<TaskBulkAction[]>([
      { type: 'unassign', userId: 'u1' },
      { type: 'assign', userId: 'u2' },
    ]);
    expect(show.mock.calls.map((call) => call[0])).toEqual([
      'Camille Martin removed',
      'Inès Roy assigned',
    ]);
  });

  it('sends the writes of one task one after the other', async () => {
    let release: (outcome: TaskBulkOutcome) => void = () => undefined;
    bulk.mockImplementationOnce(
      () =>
        new Promise<TaskBulkOutcome>((resolve) => {
          release = resolve;
        }),
    );
    const store: TaskRowActionsStoreInstance = setup();

    store.setPriority(task, 'urgente');
    store.moveTo(task, backlog);
    await Promise.resolve();

    expect(bulk).toHaveBeenCalledOnce();
    expect(store.displayedTask(task)).toMatchObject({ priority: 'urgente', listId: 'backlog' });
    release(applied());
    await vi.waitFor(() => {
      expect(bulk).toHaveBeenCalledTimes(2);
    });
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

  it('says so when the restore of a deleted task is refused', async () => {
    bulk.mockResolvedValue(applied({ trashEntryId: 'trash-1' }));
    restore.mockRejectedValue(new HttpErrorResponse({ status: 404 }));
    const store: TaskRowActionsStoreInstance = setup();
    store.askDelete(task);
    await store.trash();

    show.mock.calls[0][1]?.undo?.();

    await vi.waitFor(() => {
      expect(error).toHaveBeenCalledWith('The task could not be restored');
    });
    expect(store.rows([task])).toEqual([]);
  });

  it('opens the copy of a duplicated task from its toast', async () => {
    bulk.mockResolvedValue(applied({ newTaskKey: 'CAD-501' }));
    const store: TaskRowActionsStoreInstance = setup();

    await store.duplicate(task);

    const [title, options]: [string, CwToastOptions?] = show.mock.calls[0];
    expect(title).toBe('Task duplicated');
    expect(options?.description).toBe('CAD-501');
    expect(options?.undo).toBeUndefined();
    options?.action?.run();
    expect(open).toHaveBeenCalledWith('CAD-501', undefined);
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

  it('changes a status through the route status store and reports its completion', async () => {
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
    let release: (outcome: TaskBulkOutcome) => void = () => undefined;
    bulk.mockImplementationOnce(
      () =>
        new Promise<TaskBulkOutcome>((resolve) => {
          release = resolve;
        }),
    );
    const store: TaskRowActionsStoreInstance = setup();

    store.setPriority(task, 'urgente');
    await Promise.resolve();
    organization.set({ id: 'o2', slug: 'other', name: 'Other' } as WorkspaceOrganization);
    release(applied());
    await new Promise<void>((resolve) => {
      setTimeout(resolve);
    });

    expect(show).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
