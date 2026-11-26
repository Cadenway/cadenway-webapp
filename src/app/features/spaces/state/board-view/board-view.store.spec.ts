import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { TaskSummary } from '@features/task';

import type { BoardCard, BoardColumn } from '../../models/board-view/board-view.interface';
import type { ListTaskItem } from '../../models/list-tasks/list-tasks.interface';
import type { ListViewPresentation } from '../../models/list-view-config/list-view-config.interface';
import type { SpaceStatusOption } from '../../models/space/space.interface';
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
        { provide: ListTasksStore, useValue: { items } },
        {
          provide: ListPageStore,
          useValue: {
            space: ready({ id: 'product', statuses }),
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
            setPresentation: (change: Partial<ListViewPresentation>): void => {
              presentation.update((current: ListViewPresentation) => ({ ...current, ...change }));
            },
          },
        },
        { provide: CwToastService, useValue: { show } },
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
