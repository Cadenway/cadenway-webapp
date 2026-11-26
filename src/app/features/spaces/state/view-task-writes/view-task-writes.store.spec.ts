import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { StatusKey } from '@cadenway/contracts';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { TaskDetailOpener, type TaskSummary } from '@features/task';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { bulkDoneText } from '../../constants/bulk-copy/bulk-copy.constants';
import type {
  ConfirmedTask,
  ViewTaskOutcome,
  ViewTaskWriter,
} from '../../models/view-task-write/view-task-write.interface';
import { ListPageStore } from '../list-page/list-page.store';
import { SpacesNavigationStore } from '../spaces-navigation/spaces-navigation.store';
import { ViewTaskWritesStore, type ViewTaskWritesStoreInstance } from './view-task-writes.store';
import { VIEW_TASK_WRITER } from './view-task-writer.token';

/**
 * Function task
 *
 * @description
 * A task of Sprint 14 in the `Product` space of Atelier Nord.
 *
 * @param {string} key - Task key.
 * @param {Partial<TaskSummary>} [changes] - Other members.
 * @returns {TaskSummary} The task.
 */
function task(key: string, changes: Partial<TaskSummary> = {}): TaskSummary {
  return {
    id: key,
    key,
    name: key,
    status: 'todo',
    cancelReason: null,
    priority: 'haute',
    assigneeIds: [],
    due: '2026-11-27',
    start: '2026-11-23',
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
    ...changes,
  };
}

/**
 * Function ready
 *
 * @description
 * A resource that answered.
 *
 * @param {unknown} value - Its value.
 * @returns {object} The resource-like fake.
 */
function ready(value: unknown): object {
  return { hasValue: () => true, value: () => value };
}

/**
 * Function outcomeOf
 *
 * @description
 * A write that applied tasks at version 4, as confirmed before it.
 *
 * @param {readonly TaskSummary[]} applied - The applied tasks.
 * @param {Partial<ViewTaskOutcome>} [rest] - Other members.
 * @returns {ViewTaskOutcome} The outcome.
 */
function outcomeOf(
  applied: readonly TaskSummary[],
  rest: Partial<ViewTaskOutcome> = {},
): ViewTaskOutcome {
  return {
    affected: applied.length,
    done: applied.map((item: TaskSummary) => ({
      taskKey: item.key,
      version: 4,
      newTaskKey: null,
      trashEntryId: null,
    })),
    failed: [],
    unknown: [],
    notSent: [],
    before: Object.fromEntries(
      applied.map((item: TaskSummary): [string, ConfirmedTask] => [
        item.key,
        { ...item, cancelNote: null },
      ]),
    ),
    after: Object.fromEntries(applied.map((item: TaskSummary): [string, number] => [item.key, 4])),
    changed: [],
    ...rest,
  };
}

describe('ViewTaskWritesStore', () => {
  let act: Mock<ViewTaskWriter['act']>;
  let update: Mock<ViewTaskWriter['update']>;
  let restore: Mock<ViewTaskWriter['restore']>;
  let remind: Mock<ViewTaskWriter['remind']>;
  let openTask: Mock<(key: string) => void>;
  let reload: Mock<() => void>;
  let refreshCounts: Mock<() => void>;
  let toasts: Record<string, Mock>;
  let store: ViewTaskWritesStoreInstance;

  /**
   * Function undoOf
   *
   * @description
   * The `Undo` of the last toast shown.
   *
   * @returns {() => void} The undo.
   */
  function undoOf(): () => void {
    const options: { undo?: () => void } | undefined = toasts['show'].mock.calls.at(-1)?.[1] as
      { undo?: () => void } | undefined;
    expect(options?.undo).toBeTypeOf('function');
    return options?.undo ?? ((): void => undefined);
  }

  /**
   * Function flush
   *
   * @description
   * Lets the promises of the writes run.
   *
   * @returns {Promise<void>} Resolves once they ran.
   */
  async function flush(): Promise<void> {
    for (let tick: number = 0; tick < 10; tick++) await Promise.resolve();
  }

  beforeEach(() => {
    act = vi.fn<ViewTaskWriter['act']>((tasks: readonly TaskSummary[]) =>
      Promise.resolve(outcomeOf(tasks)),
    );
    update = vi.fn<ViewTaskWriter['update']>((item: TaskSummary) =>
      Promise.resolve(outcomeOf([item])),
    );
    restore = vi.fn<ViewTaskWriter['restore']>(() => Promise.resolve(true));
    remind = vi.fn<ViewTaskWriter['remind']>((keys: readonly string[]) => Promise.resolve(keys));
    openTask = vi.fn();
    reload = vi.fn();
    refreshCounts = vi.fn();
    toasts = {
      show: vi.fn(() => 'toast-1'),
      error: vi.fn(),
      warning: vi.fn(),
      dismiss: vi.fn(),
      toasts: vi.fn(() => [{ id: 'toast-1' }]),
    };
    TestBed.configureTestingModule({
      providers: [
        ViewTaskWritesStore,
        {
          provide: VIEW_TASK_WRITER,
          useValue: {
            act,
            update,
            restore,
            reload,
            remind,
            shownStatus: (item: TaskSummary): StatusKey => item.status,
          },
        },
        {
          provide: ListPageStore,
          useValue: {
            listId: () => 'sprint-14',
            space: ready({
              id: 'product',
              statuses: [{ key: 'review', name: 'QA', hidden: false }],
            }),
            organizationMembers: ready([
              { userId: 'u-ines', name: 'Inès Robert' },
              { userId: 'u-camille', name: 'Camille Martin' },
              { userId: 'u-left', name: null },
            ]),
            refreshCounts,
          },
        },
        {
          provide: SpacesNavigationStore,
          useValue: {
            spaces: ready([{ id: 'product', name: 'Product' }]),
            overviews: ready({
              product: {
                lists: [
                  { list: { id: 'sprint-14', name: 'Sprint 14', color: 'gris' } },
                  { list: { id: 'backlog', name: 'Backlog', color: 'gris' } },
                ],
              },
            }),
          },
        },
        { provide: CwToastService, useValue: toasts },
        { provide: TaskDetailOpener, useValue: { open: openTask } },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: {
            organization: signal({ id: 'org-atelier-nord', slug: 'atelier-nord' }),
            user: () => ({ id: 'u-camille' }),
          },
        },
      ],
    });
    store = TestBed.inject(ViewTaskWritesStore);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("offers the space's status names, the members with the signed-in one first and the other lists", () => {
    expect(store.statusOptions().find((option) => option.key === 'review')?.label).toBe('QA');
    expect(store.people().map((person) => person.id)).toEqual(['u-camille', 'u-ines']);
    expect(store.targets().map((target) => target.listId)).toEqual(['backlog']);
  });

  it('changes the status, reads the counts again and undoes it at the version it left', async () => {
    const cad482: TaskSummary = task('CAD-482');
    store.setStatus([cad482, task('CAD-483', { status: 'done' })], 'done', false);
    await flush();

    expect(act).toHaveBeenCalledWith([cad482], { type: 'status', status: 'done' });
    expect(refreshCounts).toHaveBeenCalled();
    expect(toasts['show'].mock.calls[0]?.[0]).toBe('2 tasks · Done');

    undoOf()();
    await flush();
    expect(act).toHaveBeenLastCalledWith(
      [expect.objectContaining({ key: 'CAD-482', status: 'todo' })],
      { type: 'status', status: 'todo' },
      { 'CAD-482': 4 },
    );
  });

  it('asks one reason for the tasks not cancelled already, then cancels them with it', async () => {
    store.setStatus(
      [task('CAD-482'), task('CAD-484', { status: 'cancelled' })],
      'cancelled',
      false,
    );
    expect(store.cancelKeys()).toEqual(['CAD-482']);
    expect(act).not.toHaveBeenCalled();

    store.confirmCancel({ reason: 'duplicate', note: '' });
    await flush();

    expect(store.cancelKeys()).toBeNull();
    expect(act).toHaveBeenCalledWith([expect.objectContaining({ key: 'CAD-482' })], {
      type: 'status',
      status: 'cancelled',
      cancelReason: 'duplicate',
      cancelNote: null,
    });
    expect(toasts['show']).toHaveBeenCalledWith('CAD-482 cancelled', expect.any(Object));
  });

  it('keeps a refused chunk selected and counts it in a second toast', async () => {
    const keep: Mock<(keys: readonly string[]) => void> = vi.fn();
    store.onRefused(keep);
    act.mockResolvedValueOnce(
      outcomeOf([task('CAD-482')], { failed: [{ taskKey: 'CAD-483', version: 3 }] }),
    );

    store.setPriority([task('CAD-482'), task('CAD-483')], 'urgente');
    await flush();

    expect(keep).toHaveBeenCalledWith(['CAD-483']);
    expect(toasts['error']).toHaveBeenCalledWith(expect.any(String), {
      description: 'They stay selected.',
    });
  });

  it('reports a write refused for every task without a success toast', async () => {
    act.mockResolvedValueOnce({
      ...outcomeOf([]),
      failed: [{ taskKey: 'CAD-482', version: 3 }],
    });

    store.moveTo([task('CAD-482')], 'backlog');
    await flush();

    expect(toasts['show']).not.toHaveBeenCalled();
    expect(toasts['error']).toHaveBeenCalledWith('The selection could not be changed');
  });

  it('reschedules with its toast and undoes it with the dates confirmed before', async () => {
    const cad482: TaskSummary = task('CAD-482');
    await store.updateFields(
      cad482,
      { dueDate: '2026-12-01' },
      { title: 'CAD-482 rescheduled', description: 'Due: December 1.' },
    );

    expect(update).toHaveBeenCalledWith(cad482, { dueDate: '2026-12-01' });
    expect(toasts['show']).toHaveBeenCalledWith(
      'CAD-482 rescheduled',
      expect.objectContaining({ description: 'Due: December 1.' }),
    );

    undoOf()();
    await flush();
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ key: 'CAD-482' }),
      { dueDate: '2026-11-27', startDate: '2026-11-23' },
      { 'CAD-482': 4 },
    );
  });

  it('warns instead of undoing a field write the task changed since', async () => {
    await store.updateFields(cad482Named(), { name: 'Sign-in' }, { title: 't', description: 'd' });
    update.mockResolvedValueOnce({
      ...outcomeOf([]),
      changed: [{ taskKey: 'CAD-482', version: 6 }],
    });

    undoOf()();
    await flush();

    expect(toasts['warning']).toHaveBeenCalled();
  });

  it('confirms a deletion, trashes the tasks and restores them from the toast', async () => {
    act.mockResolvedValueOnce({
      ...outcomeOf([task('CAD-482')]),
      done: [{ taskKey: 'CAD-482', version: 4, newTaskKey: null, trashEntryId: 'trash-1' }],
    });
    store.askDelete([task('CAD-482', { name: 'Redesign the SSO sign-in screen' })], true);
    expect(store.deleteOpen()).toBe(true);
    expect(store.deleteTitle()).toBe('Delete “Redesign the SSO sign-in screen”?');
    expect(store.deleteItems()).toEqual(['CAD-482 · Redesign the SSO sign-in screen']);

    await store.trash();
    expect(store.deleteOpen()).toBe(false);
    expect(store.deleting()).toBe(false);
    expect(toasts['show']).toHaveBeenCalledWith('CAD-482 deleted', expect.any(Object));

    undoOf()();
    await flush();
    expect(restore).toHaveBeenCalledWith(['trash-1']);
  });

  it("shows the field write's own wording when the gateway refuses it", async () => {
    update.mockResolvedValueOnce({
      ...outcomeOf([]),
      failed: [{ taskKey: 'CAD-482', version: 3 }],
    });
    const refused: ViewTaskOutcome = await store.updateFields(
      task('CAD-482'),
      { dueDate: '2026-12-01' },
      { title: 'CAD-482 rescheduled', description: 'Due: December 1.' },
    );

    expect(refused.failed).toHaveLength(1);
    expect(toasts['show']).not.toHaveBeenCalled();
    expect(toasts['error']).toHaveBeenCalledWith('The task could not be changed');
    expect(toasts['error']).not.toHaveBeenCalledWith('The selection could not be changed');

    update.mockResolvedValueOnce({
      ...outcomeOf([]),
      failed: [{ taskKey: 'CAD-482', version: 3 }],
    });
    await store.updateFields(
      task('CAD-482'),
      { estimateMinutes: 90 },
      { title: 't', description: 'd', failed: 'The estimate could not be changed' },
    );
    expect(toasts['error']).toHaveBeenLastCalledWith('The estimate could not be changed');
  });

  it('moves a task and moves it back to its list from the toast', async () => {
    store.moveTo([task('CAD-482')], 'backlog');
    await flush();

    expect(act).toHaveBeenCalledWith([expect.objectContaining({ key: 'CAD-482' })], {
      type: 'move',
      listId: 'backlog',
    });
    expect(toasts['show']).toHaveBeenCalledWith(
      'CAD-482 moved',
      expect.objectContaining({ description: 'To Backlog.' }),
    );

    undoOf()();
    await flush();
    expect(act).toHaveBeenLastCalledWith(
      [expect.objectContaining({ key: 'CAD-482', listId: 'sprint-14' })],
      { type: 'move', listId: 'sprint-14' },
      { 'CAD-482': 4 },
    );
  });

  it('moves nothing when every task already sits in the list', async () => {
    store.moveTo([task('CAD-482')], 'sprint-14');
    await flush();

    expect(act).not.toHaveBeenCalled();
  });

  it('duplicates a task and opens its copy from the toast', async () => {
    act.mockResolvedValueOnce({
      ...outcomeOf([task('CAD-482')]),
      done: [{ taskKey: 'CAD-482', version: 4, newTaskKey: 'CAD-499', trashEntryId: null }],
    });
    store.duplicate([task('CAD-482')]);
    await flush();

    const options: { description?: string; action?: { label: string; run: () => void } } = toasts[
      'show'
    ].mock.calls[0]?.[1] as {
      description?: string;
      action?: { label: string; run: () => void };
    };
    expect(toasts['show'].mock.calls[0]?.[0]).toBe('Task duplicated');
    expect(options.description).toBe('CAD-499');
    expect(options.action?.label).toBe('Open');
    options.action?.run();
    expect(openTask).toHaveBeenCalledWith('CAD-499', undefined);
  });

  it('says so when no reminder could be set', async () => {
    remind.mockResolvedValueOnce([]);

    await store.remind([task('CAD-482')]);

    expect(remind).toHaveBeenCalledWith(['CAD-482'], expect.any(Date));
    expect(toasts['error']).toHaveBeenCalledWith('The reminder could not be set');
    expect(toasts['show']).not.toHaveBeenCalled();
  });

  it('sets a reminder tomorrow at 9', async () => {
    await store.remind([task('CAD-482')]);

    const at: Date = remind.mock.calls[0]?.[1] ?? new Date(0);
    expect(at.getHours()).toBe(9);
    expect(toasts['show']).toHaveBeenCalledWith('Reminder set', expect.any(Object));
  });

  it('says so when the clipboard refuses a copy', async () => {
    const writeText: Mock<(text: string) => Promise<void>> = vi.fn(() =>
      Promise.reject(new Error('denied')),
    );
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    try {
      store.copyKeys([task('CAD-482'), task('CAD-483')]);
      await flush();
    } finally {
      Reflect.deleteProperty(navigator, 'clipboard');
    }

    expect(writeText).toHaveBeenCalledWith('CAD-482, CAD-483');
    expect(toasts['error']).toHaveBeenCalledWith('Could not copy', {
      description: 'CAD-482, CAD-483',
    });
  });

  it('marks the tasks not done yet as done and undoes it', async () => {
    store.markDone([task('CAD-482'), task('CAD-483', { status: 'done' })]);
    await flush();

    expect(act).toHaveBeenCalledWith([expect.objectContaining({ key: 'CAD-482' })], {
      type: 'status',
      status: 'done',
    });
    expect(toasts['show']).toHaveBeenCalledWith(
      bulkDoneText(1),
      expect.objectContaining({ description: 'Status: Done.' }),
    );

    undoOf()();
    await flush();
    expect(act).toHaveBeenLastCalledWith(
      [expect.objectContaining({ key: 'CAD-482' })],
      { type: 'status', status: 'todo' },
      { 'CAD-482': 4 },
    );
  });

  it('sends nothing when every selected task is done already', async () => {
    store.markDone([task('CAD-483', { status: 'done' })]);
    await flush();

    expect(act).not.toHaveBeenCalled();
  });

  it('dismisses the toasts whose Undo writes through the view once the view is gone', async () => {
    store.setPriority([task('CAD-482')], 'urgente');
    await flush();

    TestBed.resetTestingModule();

    expect(toasts['dismiss']).toHaveBeenCalledWith('toast-1');
  });
});

/**
 * Function cad482Named
 *
 * @description
 * CAD-482 under its mockup name.
 *
 * @returns {TaskSummary} The task.
 */
function cad482Named(): TaskSummary {
  return task('CAD-482', { name: 'Redesign the SSO sign-in screen' });
}
