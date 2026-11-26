import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  STATUS_SETTLE_MS,
  TaskActionsApi,
  type TaskBulkOutcome,
  type TaskSummary,
} from '@features/task';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import type { BoardCard, BoardColumn } from '../../models/board-view/board-view.interface';
import type { ListTaskItem } from '../../models/list-tasks/list-tasks.interface';
import type {
  ListTaskQuery,
  ListViewPresentation,
} from '../../models/list-view-config/list-view-config.interface';
import type { SpaceStatusOption } from '../../models/space/space.interface';
import type {
  ViewTaskOutcome,
  ViewTaskWriter,
} from '../../models/view-task-write/view-task-write.interface';
import { DEFAULT_PRESENTATION } from '../../utils/list-view-query/list-view-query.util';
import { ListPageStore } from '../list-page/list-page.store';
import { ListTasksStore } from '../list-tasks/list-tasks.store';
import { ListViewStore } from '../list-view/list-view.store';
import { BoardViewStore } from './board-view.store';

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
    due: null,
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

describe('BoardViewStore', () => {
  let items: WritableSignal<readonly ListTaskItem[]>;
  let presentation: WritableSignal<ListViewPresentation>;
  let statuses: readonly SpaceStatusOption[];
  let show: Mock;
  let error: Mock;
  let warning: Mock;
  let refreshCounts: Mock;
  let organization: WritableSignal<{ id: string; slug: string }>;
  let listId: WritableSignal<string | null>;

  /**
   * Function heldWriter
   *
   * @description
   * The board's writer over a reader whose first write stays in flight until settled by hand.
   *
   * @param {InstanceType<typeof BoardViewStore>} store - The store.
   * @returns {{ writer: ViewTaskWriter; settle: (outcome: ViewTaskOutcome) => void }} The writer
   * and the hand that settles its write.
   */
  function heldWriter(store: InstanceType<typeof BoardViewStore>): {
    writer: ViewTaskWriter;
    settle: (outcome: ViewTaskOutcome) => void;
  } {
    let settle: (outcome: ViewTaskOutcome) => void = (): void => undefined;
    const reader: ViewTaskWriter = {
      act: vi.fn(
        () =>
          new Promise<ViewTaskOutcome>((resolve: (outcome: ViewTaskOutcome) => void): void => {
            settle = resolve;
          }),
      ),
      update: vi.fn(),
      remind: vi.fn(),
      restore: vi.fn(),
      reload: vi.fn(),
      shownStatus: (task: TaskSummary) => task.status,
    };
    return {
      writer: store.writerOver(reader),
      settle: (outcome: ViewTaskOutcome): void => {
        settle(outcome);
      },
    };
  }

  /**
   * Function refused
   *
   * @description
   * A write of the view refused for CAD-461.
   *
   * @returns {ViewTaskOutcome} The outcome.
   */
  function refused(): ViewTaskOutcome {
    return {
      affected: 0,
      done: [],
      failed: [{ taskKey: 'CAD-461', version: 3 }],
      unknown: [],
      notSent: [],
      before: {},
      after: {},
      changed: [],
    };
  }

  /**
   * Function showProgress
   *
   * @description
   * Shows CAD-461 in progress over its confirmed `To do`, as an optimistic write leaves it.
   */
  function showProgress(): void {
    items.update((current: readonly ListTaskItem[]) =>
      current.map((item: ListTaskItem) =>
        item.task.key === 'CAD-461' ? { ...item, status: 'progress' } : item,
      ),
    );
  }
  let taskQuery: WritableSignal<ListTaskQuery>;
  let bulk: Mock<TaskActionsApi['bulk']>;

  /**
   * Function applied
   *
   * @description
   * A bulk answer that applied one task at a version.
   *
   * @param {string} taskKey - The task.
   * @param {number} version - The version it was left at.
   * @returns {TaskBulkOutcome} The answer.
   */
  function applied(taskKey: string, version: number): TaskBulkOutcome {
    return {
      affected: 1,
      done: [{ taskKey, version, newTaskKey: null, trashEntryId: null }],
      failed: [],
      unknown: [],
      notSent: [],
    };
  }

  /**
   * Function setup
   *
   * @description
   * Provides the store over faked tasks, list page and view configuration.
   *
   * @returns {InstanceType<typeof BoardViewStore>} The store.
   */
  function setup(): InstanceType<typeof BoardViewStore> {
    TestBed.configureTestingModule({
      providers: [
        BoardViewStore,
        {
          provide: ListTasksStore,
          useValue: {
            items,
            taskOf: (key: string): TaskSummary | undefined =>
              items().find((item: ListTaskItem): boolean => item.task.key === key)?.task,
          },
        },
        {
          provide: ListPageStore,
          useValue: {
            space: ready({ id: 'product', statuses }),
            refreshCounts,
            listId,
            organizationMembers: ready([
              { userId: 'u-ines', name: 'Inès Robert' },
              { userId: 'u-hugo', name: null },
            ]),
          },
        },
        {
          provide: ListViewStore,
          useValue: {
            presentation,
            taskQuery,
            setPresentation: (change: Partial<ListViewPresentation>): void => {
              presentation.update((current: ListViewPresentation) => ({ ...current, ...change }));
            },
          },
        },
        { provide: CwToastService, useValue: { show, error, warning } },
        { provide: TaskActionsApi, useValue: { bulk } },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: { organization },
        },
      ],
    });
    return TestBed.inject(BoardViewStore);
  }

  /**
   * Function cardOf
   *
   * @description
   * The card of a task.
   *
   * @param {InstanceType<typeof BoardViewStore>} store - The store.
   * @param {string} key - Task key.
   * @returns {BoardCard} The card.
   */
  function cardOf(store: InstanceType<typeof BoardViewStore>, key: string): BoardCard {
    const card: BoardCard | undefined = store
      .cards()
      .find((item: BoardCard): boolean => item.task.key === key);
    if (!card) throw new Error(`No card ${key}`);
    return card;
  }

  beforeEach(() => {
    items = signal<readonly ListTaskItem[]>([
      { task: task('CAD-482', { assigneeIds: ['u-ines', 'u-gone'] }), status: 'progress' },
      {
        task: task('CAD-470', { status: 'done', subtasks: { closed: 1, total: 3 } }),
        status: 'done',
      },
      { task: task('CAD-461', { checklist: { closed: 2, total: 4 } }), status: 'todo' },
    ]);
    presentation = signal<ListViewPresentation>(DEFAULT_PRESENTATION);
    statuses = [
      { key: 'progress', name: 'Doing', hidden: false },
      { key: 'triage', name: null, hidden: true },
      { key: 'testing', name: null, hidden: true },
    ];
    show = vi.fn(() => 'toast-1');
    error = vi.fn();
    warning = vi.fn();
    refreshCounts = vi.fn();
    organization = signal({ id: 'org-atelier-nord', slug: 'atelier-nord' });
    listId = signal<string | null>('sprint-14');
    taskQuery = signal<ListTaskQuery>({ level: 'roots', sort: 'manual' });
    bulk = vi.fn<TaskActionsApi['bulk']>(() => Promise.resolve(applied('CAD-461', 4)));
  });

  it('draws the columns in board order with the space names, without its unused statuses', () => {
    const store: InstanceType<typeof BoardViewStore> = setup();

    expect(store.columns().map((column: BoardColumn) => column.id)).toEqual([
      'backlog',
      'todo',
      'progress',
      'review',
      'blocked',
      'waiting',
      'done',
      'cancelled',
    ]);
    expect(store.columns()[2]).toEqual({ id: 'progress', label: 'Doing', status: 'progress' });
    expect(store.columns()[1].label).toBe('To do');
  });

  it('keeps the column of an unused status while a card sits there', () => {
    items.update((current: readonly ListTaskItem[]) => [
      ...current,
      { task: task('CAD-450', { status: 'testing' }), status: 'testing' },
    ]);
    const store: InstanceType<typeof BoardViewStore> = setup();

    expect(store.columns().map((column: BoardColumn) => column.id)).toContain('testing');
  });

  it('leaves out the columns hidden with Columns', () => {
    presentation.update((current: ListViewPresentation) => ({
      ...current,
      hiddenBoardStatusKeys: ['done', 'cancelled'],
    }));
    const store: InstanceType<typeof BoardViewStore> = setup();

    expect(store.columns().map((column: BoardColumn) => column.id)).not.toContain('done');
    expect(store.columns().map((column: BoardColumn) => column.id)).not.toContain('cancelled');
  });

  it('files each card under its shown status with its progress and assignees', () => {
    const store: InstanceType<typeof BoardViewStore> = setup();

    const doing: BoardCard = cardOf(store, 'CAD-482');
    expect(doing.status).toBe('progress');
    expect(doing.closed).toBe(false);
    expect(doing.assignees.map((person) => person.initials)).toEqual(['IR']);
    expect(doing.progress).toBeNull();
    expect(cardOf(store, 'CAD-470')).toMatchObject({
      closed: true,
      progress: { icon: 'phosphorTreeStructureBold', closed: 1, total: 3 },
    });
    expect(cardOf(store, 'CAD-461').progress).toEqual({
      icon: 'phosphorListChecksBold',
      closed: 2,
      total: 4,
    });
  });

  it('follows a write that moves a card to another status', () => {
    const store: InstanceType<typeof BoardViewStore> = setup();
    items.update((current: readonly ListTaskItem[]) =>
      current.map((item: ListTaskItem) =>
        item.task.key === 'CAD-461' ? { ...item, status: 'review' } : item,
      ),
    );

    expect(cardOf(store, 'CAD-461').status).toBe('review');
  });

  it('accepts a drop only in another column whose status the task may take', () => {
    items.update((current: readonly ListTaskItem[]) => [
      ...current,
      { task: task('CAD-490', { milestone: true }), status: 'todo' },
    ]);
    const store: InstanceType<typeof BoardViewStore> = setup();
    const card: BoardCard = cardOf(store, 'CAD-482');

    expect(store.accepts(card, 'review')).toBe(true);
    expect(store.accepts(card, 'progress')).toBe(false);
    expect(store.accepts(card, 'testing')).toBe(false);
    expect(store.accepts(cardOf(store, 'CAD-490'), 'review')).toBe(false);
    expect(store.accepts(cardOf(store, 'CAD-490'), 'done')).toBe(true);
  });

  it('hides a column with a toast whose Undo shows it again', () => {
    const store: InstanceType<typeof BoardViewStore> = setup();

    store.hideColumn('review');

    expect(presentation().hiddenBoardStatusKeys).toEqual(['review']);
    expect(store.columns().map((column: BoardColumn) => column.id)).not.toContain('review');
    expect(show).toHaveBeenCalledWith('Column hidden', {
      description: 'In review · show it again from “Columns”.',
      undo: expect.any(Function) as () => void,
    });
    const undo: () => void = (show.mock.calls[0][1] as { undo: () => void }).undo;
    undo();
    expect(presentation().hiddenBoardStatusKeys).toEqual([]);
  });

  it('undoes a hidden column without showing the columns hidden since', () => {
    const store: InstanceType<typeof BoardViewStore> = setup();

    store.hideColumn('review');
    store.hideColumn('blocked');
    const undoReview: () => void = (show.mock.calls[0][1] as { undo: () => void }).undo;
    undoReview();

    expect(presentation().hiddenBoardStatusKeys).toEqual(['blocked']);
  });

  describe('moves', () => {
    let send: Mock<(task: TaskSummary, status: string) => void>;

    beforeEach(() => {
      vi.useFakeTimers();
      send = vi.fn();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows a move at once and writes only the last status of quick moves', () => {
      const store: InstanceType<typeof BoardViewStore> = setup();
      store.settleWith(send);

      store.stage(cardOf(store, 'CAD-461'), 'progress');
      expect(cardOf(store, 'CAD-461').status).toBe('progress');
      vi.advanceTimersByTime(STATUS_SETTLE_MS - 100);
      store.stage(cardOf(store, 'CAD-461'), 'review');
      vi.advanceTimersByTime(STATUS_SETTLE_MS - 100);
      expect(send).not.toHaveBeenCalled();
      vi.advanceTimersByTime(100);

      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'CAD-461' }) as TaskSummary,
        'review',
      );
    });

    it('sends nothing for a move back to the confirmed status', () => {
      const store: InstanceType<typeof BoardViewStore> = setup();
      store.settleWith(send);

      store.stage(cardOf(store, 'CAD-461'), 'progress');
      store.stage(cardOf(store, 'CAD-461'), 'todo');
      vi.advanceTimersByTime(STATUS_SETTLE_MS * 2);

      expect(send).not.toHaveBeenCalled();
      expect(cardOf(store, 'CAD-461').status).toBe('todo');
    });

    it('keeps a waiting move over a read of the tasks', () => {
      const store: InstanceType<typeof BoardViewStore> = setup();
      store.settleWith(send);

      store.stage(cardOf(store, 'CAD-461'), 'review');
      items.set([...items()]);

      expect(cardOf(store, 'CAD-461').status).toBe('review');
    });

    it('forgets a discarded move', () => {
      const store: InstanceType<typeof BoardViewStore> = setup();
      store.settleWith(send);

      store.stage(cardOf(store, 'CAD-461'), 'review');
      store.discard(['CAD-461']);
      vi.advanceTimersByTime(STATUS_SETTLE_MS);

      expect(send).not.toHaveBeenCalled();
      expect(cardOf(store, 'CAD-461').status).toBe('todo');
    });

    it('writes the waiting moves at once on a flush', () => {
      const store: InstanceType<typeof BoardViewStore> = setup();
      store.settleWith(send);

      store.stage(cardOf(store, 'CAD-461'), 'review');
      store.flush();
      vi.advanceTimersByTime(STATUS_SETTLE_MS);

      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'CAD-461' }) as TaskSummary,
        'review',
      );
    });

    it('writes the last move from its task when another query leaves the task out', () => {
      const store: InstanceType<typeof BoardViewStore> = setup();
      store.settleWith(send);
      TestBed.tick();

      store.stage(cardOf(store, 'CAD-461'), 'progress');
      store.stage(cardOf(store, 'CAD-461'), 'review');
      items.set([]);
      taskQuery.set({ level: 'roots', sort: 'manual', search: 'quotas' });
      TestBed.tick();
      vi.advanceTimersByTime(STATUS_SETTLE_MS);

      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'CAD-461', version: 3 }) as TaskSummary,
        'review',
      );
    });

    it('writes the waiting moves with the task API when destroyed, never Cancelled', async () => {
      const store: InstanceType<typeof BoardViewStore> = setup();
      store.settleWith(send);

      store.stage(cardOf(store, 'CAD-461'), 'review');
      store.stage(cardOf(store, 'CAD-482'), 'cancelled');
      TestBed.resetTestingModule();
      await vi.advanceTimersByTimeAsync(STATUS_SETTLE_MS);

      expect(send).not.toHaveBeenCalled();
      expect(bulk).toHaveBeenCalledTimes(1);
      expect(bulk).toHaveBeenCalledWith(
        [{ taskKey: 'CAD-461', version: 3 }],
        { type: 'status', status: 'review' },
        expect.any(Function),
      );
    });

    it('warns of an unknown outcome of a move written on leaving and reads the counts', async () => {
      bulk.mockResolvedValue({
        affected: 0,
        done: [],
        failed: [],
        unknown: [{ taskKey: 'CAD-461', version: 3 }],
        notSent: [],
      });
      const store: InstanceType<typeof BoardViewStore> = setup();

      store.stage(cardOf(store, 'CAD-461'), 'review');
      store.leave();
      await vi.advanceTimersByTimeAsync(0);

      expect(warning).toHaveBeenCalledWith(
        'The outcome is unknown. The tasks are being refreshed.',
      );
      expect(refreshCounts).toHaveBeenCalledTimes(1);
      expect(error).not.toHaveBeenCalled();
      expect(show).not.toHaveBeenCalled();
    });

    it('sends nothing on leaving when a refused write leaves the task at the moved-back status', async () => {
      const store: InstanceType<typeof BoardViewStore> = setup();
      const { writer, settle } = heldWriter(store);
      void writer.act([cardOf(store, 'CAD-461').task], { type: 'status', status: 'progress' });
      showProgress();

      store.stage(cardOf(store, 'CAD-461'), 'todo');
      store.leave();
      settle(refused());
      await vi.advanceTimersByTimeAsync(0);

      expect(bulk).not.toHaveBeenCalled();
      expect(show).not.toHaveBeenCalled();
    });

    it('offers the Undo of a move written on leaving back to the confirmed status', async () => {
      const store: InstanceType<typeof BoardViewStore> = setup();
      const { writer, settle } = heldWriter(store);
      void writer.act([cardOf(store, 'CAD-461').task], { type: 'status', status: 'progress' });
      showProgress();

      store.stage(cardOf(store, 'CAD-461'), 'review');
      store.leave();
      settle(refused());
      await vi.advanceTimersByTimeAsync(0);
      expect(bulk).toHaveBeenCalledWith(
        [{ taskKey: 'CAD-461', version: 3 }],
        { type: 'status', status: 'review' },
        expect.any(Function),
      );
      (show.mock.calls[0][1] as { undo: () => void }).undo();
      await vi.advanceTimersByTimeAsync(0);

      expect(bulk).toHaveBeenLastCalledWith(
        [{ taskKey: 'CAD-461', version: 4 }],
        { type: 'status', status: 'todo' },
        expect.any(Function),
      );
    });

    it('offers no Undo when the write before the move has an unknown outcome', async () => {
      const store: InstanceType<typeof BoardViewStore> = setup();
      const { writer, settle } = heldWriter(store);
      void writer.act([cardOf(store, 'CAD-461').task], { type: 'status', status: 'progress' });
      showProgress();

      store.stage(cardOf(store, 'CAD-461'), 'review');
      store.leave();
      settle({
        ...refused(),
        failed: [],
        unknown: [{ taskKey: 'CAD-461', version: 3 }],
      });
      await vi.advanceTimersByTimeAsync(0);

      expect(bulk).toHaveBeenCalledTimes(1);
      expect(show).toHaveBeenCalledWith('CAD-461 · In review', {
        description: 'Status changed.',
      });
    });

    it('writes a waiting move in its own list when another list is shown', async () => {
      const store: InstanceType<typeof BoardViewStore> = setup();
      store.settleWith(send);
      TestBed.tick();

      store.stage(cardOf(store, 'CAD-461'), 'review');
      listId.set('sprint-15');
      TestBed.tick();
      await vi.advanceTimersByTimeAsync(STATUS_SETTLE_MS);

      expect(send).not.toHaveBeenCalled();
      expect(bulk).toHaveBeenCalledTimes(1);
      expect(bulk).toHaveBeenCalledWith(
        [{ taskKey: 'CAD-461', version: 3 }],
        { type: 'status', status: 'review' },
        expect.any(Function),
      );
      expect(refreshCounts).not.toHaveBeenCalled();
    });

    it('drops a waiting move with the failure toast when another organization is shown', async () => {
      const store: InstanceType<typeof BoardViewStore> = setup();
      store.settleWith(send);
      TestBed.tick();

      store.stage(cardOf(store, 'CAD-461'), 'review');
      organization.set({ id: 'org-other', slug: 'other' });
      TestBed.tick();
      await vi.advanceTimersByTimeAsync(STATUS_SETTLE_MS);

      expect(send).not.toHaveBeenCalled();
      expect(bulk).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledWith('The task could not be changed');
    });

    it('writes the last move after the write in flight when the view is left', async () => {
      const store: InstanceType<typeof BoardViewStore> = setup();
      let settleFirst: (outcome: ViewTaskOutcome) => void = (): void => undefined;
      const first: Promise<ViewTaskOutcome> = new Promise<ViewTaskOutcome>(
        (resolve: (outcome: ViewTaskOutcome) => void): void => {
          settleFirst = resolve;
        },
      );
      const reader: ViewTaskWriter = {
        act: vi.fn(() => first),
        update: vi.fn(),
        remind: vi.fn(),
        restore: vi.fn(),
        reload: vi.fn(),
        shownStatus: (task: TaskSummary) => task.status,
      };
      const writer: ViewTaskWriter = store.writerOver(reader);
      const task: TaskSummary = cardOf(store, 'CAD-461').task;
      void writer.act([task], { type: 'status', status: 'progress' });

      store.stage(cardOf(store, 'CAD-461'), 'review');
      store.leave();
      await vi.advanceTimersByTimeAsync(0);
      expect(bulk).not.toHaveBeenCalled();

      settleFirst({
        ...applied('CAD-461', 4),
        before: {},
        after: { 'CAD-461': 4 },
        changed: [],
      });
      await vi.advanceTimersByTimeAsync(0);

      expect(bulk).toHaveBeenCalledWith(
        [{ taskKey: 'CAD-461', version: 4 }],
        { type: 'status', status: 'review' },
        expect.any(Function),
      );
    });

    it('reports a move left unsent when the organization changes before it goes', async () => {
      bulk.mockImplementation((selection, _action, current): Promise<TaskBulkOutcome> =>
        Promise.resolve(
          current()
            ? applied('CAD-461', 5)
            : { affected: 0, done: [], failed: [], unknown: [], notSent: [...selection] },
        ),
      );
      const store: InstanceType<typeof BoardViewStore> = setup();
      let settleFirst: (outcome: ViewTaskOutcome) => void = (): void => undefined;
      const reader: ViewTaskWriter = {
        act: vi.fn(
          () =>
            new Promise<ViewTaskOutcome>((resolve: (outcome: ViewTaskOutcome) => void): void => {
              settleFirst = resolve;
            }),
        ),
        update: vi.fn(),
        remind: vi.fn(),
        restore: vi.fn(),
        reload: vi.fn(),
        shownStatus: (task: TaskSummary) => task.status,
      };
      void store
        .writerOver(reader)
        .act([cardOf(store, 'CAD-461').task], { type: 'status', status: 'progress' });

      store.stage(cardOf(store, 'CAD-461'), 'review');
      store.leave();
      organization.set({ id: 'org-other', slug: 'other' });
      settleFirst({ ...applied('CAD-461', 4), before: {}, after: { 'CAD-461': 4 }, changed: [] });
      await vi.advanceTimersByTimeAsync(0);

      expect(bulk).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith('The task could not be changed');
      expect(show).not.toHaveBeenCalled();
      expect(refreshCounts).not.toHaveBeenCalled();
    });

    it('shows the status toast of a move written on leaving, and its Undo writes it back', async () => {
      const store: InstanceType<typeof BoardViewStore> = setup();

      store.stage(cardOf(store, 'CAD-461'), 'review');
      store.leave();
      await vi.advanceTimersByTimeAsync(0);

      expect(refreshCounts).toHaveBeenCalledTimes(1);
      expect(show).toHaveBeenCalledWith('CAD-461 · In review', {
        description: 'Status changed.',
        undo: expect.any(Function) as () => void,
      });
      const undo: () => void = (show.mock.calls[0][1] as { undo: () => void }).undo;
      undo();
      await vi.advanceTimersByTimeAsync(0);

      expect(bulk).toHaveBeenLastCalledWith(
        [{ taskKey: 'CAD-461', version: 4 }],
        { type: 'status', status: 'todo' },
        expect.any(Function),
      );
      expect(refreshCounts).toHaveBeenCalledTimes(2);
    });

    it('warns when the Undo of a move written on leaving is refused', async () => {
      const store: InstanceType<typeof BoardViewStore> = setup();
      store.stage(cardOf(store, 'CAD-461'), 'review');
      store.leave();
      await vi.advanceTimersByTimeAsync(0);
      bulk.mockResolvedValueOnce({
        affected: 0,
        done: [],
        failed: [{ taskKey: 'CAD-461', version: 4 }],
        unknown: [],
        notSent: [],
      });

      (show.mock.calls[0][1] as { undo: () => void }).undo();
      await vi.advanceTimersByTimeAsync(0);

      expect(warning).toHaveBeenCalledWith('CAD-461 changed since', {
        description: 'Undo skipped it: its latest values are shown.',
      });
    });

    it('holds a waiting move while its cancellation is asked, then settles it when dismissed', () => {
      const store: InstanceType<typeof BoardViewStore> = setup();
      store.settleWith(send);

      store.stage(cardOf(store, 'CAD-461'), 'progress');
      store.hold(['CAD-461']);
      vi.advanceTimersByTime(STATUS_SETTLE_MS * 3);
      expect(send).not.toHaveBeenCalled();
      expect(cardOf(store, 'CAD-461').status).toBe('progress');

      store.release(['CAD-461']);
      vi.advanceTimersByTime(STATUS_SETTLE_MS);

      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'CAD-461' }) as TaskSummary,
        'progress',
      );
    });

    it('replaces a held move once its cancellation is confirmed', () => {
      const store: InstanceType<typeof BoardViewStore> = setup();
      store.settleWith(send);

      store.stage(cardOf(store, 'CAD-461'), 'progress');
      store.hold(['CAD-461']);
      store.discard(['CAD-461']);
      store.release(['CAD-461']);
      vi.advanceTimersByTime(STATUS_SETTLE_MS * 2);

      expect(send).not.toHaveBeenCalled();
      expect(cardOf(store, 'CAD-461').status).toBe('todo');
    });

    it('says so when the write sent on leaving is refused', async () => {
      bulk.mockResolvedValue({
        affected: 0,
        done: [],
        failed: [{ taskKey: 'CAD-461', version: 3 }],
        unknown: [],
        notSent: [],
      });
      const store: InstanceType<typeof BoardViewStore> = setup();

      store.stage(cardOf(store, 'CAD-461'), 'review');
      store.leave();
      await vi.advanceTimersByTimeAsync(0);

      expect(error).toHaveBeenCalledWith('The task could not be changed');
    });
  });

  it('folds and unfolds columns', () => {
    const store: InstanceType<typeof BoardViewStore> = setup();

    store.toggleCollapsed('done');
    expect(store.collapsedColumns()).toEqual(['done']);
    store.setCollapsed(['done', 'cancelled']);
    store.toggleCollapsed('done');
    expect(store.collapsedColumns()).toEqual(['cancelled']);
  });

  it('hands the same cards back as a new list after a drop that writes nothing', () => {
    const store: InstanceType<typeof BoardViewStore> = setup();
    const before: readonly BoardCard[] = store.cards();

    store.restoreCards();

    expect(store.cards()).not.toBe(before);
    expect(store.cards()).toEqual(before);
  });
});
