import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { TaskDetailOpener, type TaskSummary } from '@features/task';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { SheetTasksApi } from '../../data-access/services/sheet-tasks-api/sheet-tasks-api.service';
import type { ListTaskItem } from '../../models/list-tasks/list-tasks.interface';
import type {
  ListGroupBy,
  ListViewPresentation,
} from '../../models/list-view-config/list-view-config.interface';
import type {
  SheetCustomField,
  SheetRow,
  SheetTaskFacts,
} from '../../models/sheet-view/sheet-view.interface';
import type { ViewTaskOutcome } from '../../models/view-task-write/view-task-write.interface';
import { ListPageStore } from '../list-page/list-page.store';
import { ListTasksStore } from '../list-tasks/list-tasks.store';
import { ListViewStore } from '../list-view/list-view.store';
import { SheetViewStore, type SheetViewStoreInstance, SPENT_CONCURRENCY } from './sheet-view.store';

/**
 * Function item
 *
 * @description
 * A task of Sprint 14 as the shared reader shows it.
 *
 * @param {string} key - Task key.
 * @returns {ListTaskItem} The item.
 */
function item(key: string): ListTaskItem {
  const task: TaskSummary = {
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
    version: 4,
  };
  return { task, status: 'todo' };
}

/**
 * Function facts
 *
 * @description
 * The sheet's facts of CAD-482 at a version.
 *
 * @param {number} version - The version.
 * @param {number | null} estimateMinutes - The estimate.
 * @returns {SheetTaskFacts} The facts.
 */
function facts(version: number, estimateMinutes: number | null): SheetTaskFacts {
  return { key: 'CAD-482', version, estimateMinutes, customFieldValues: { 'f-points': 5 } };
}

/**
 * Function outcome
 *
 * @description
 * The answer of a single-field write of CAD-482.
 *
 * @param {number | null} version - The version the gateway returned, null for a refusal.
 * @returns {ViewTaskOutcome} The outcome.
 */
function outcome(version: number | null): ViewTaskOutcome {
  const sent: { taskKey: string; version: number } = { taskKey: 'CAD-482', version: 4 };
  return {
    affected: version === null ? 0 : 1,
    done:
      version === null
        ? []
        : [{ taskKey: 'CAD-482', version, newTaskKey: null, trashEntryId: null }],
    failed: version === null ? [sent] : [],
    unknown: [],
    notSent: [],
    before: {},
    after: version === null ? {} : { 'CAD-482': version },
    changed: [],
  };
}

/**
 * Function ready
 *
 * @description
 * A read that answered.
 *
 * @param {T} value - Its value.
 * @returns {{ hasValue: () => boolean; value: () => T }} The read.
 */
function ready<T>(value: T): { hasValue: () => boolean; value: () => T } {
  return { hasValue: () => true, value: () => value };
}

/**
 * Constant points
 *
 * @description
 * The sprint points field of the `Product` space.
 *
 * @type {SheetCustomField}
 */
const points: SheetCustomField = {
  id: 'f-points',
  name: 'Points',
  type: 'number',
  position: 0,
  sprintPoints: true,
};

/**
 * Function flush
 *
 * @description
 * Lets the store's promises and microtasks run.
 *
 * @returns {Promise<void>} Resolves once they ran.
 */
async function flush(): Promise<void> {
  for (let round: number = 0; round < 10; round++) await Promise.resolve();
  TestBed.tick();
}

describe('SheetViewStore', () => {
  let factsRead: Subject<readonly SheetTaskFacts[]>;
  let customFields: Mock<SheetTasksApi['customFields']>;
  let spentMinutes: Mock<SheetTasksApi['spentMinutes']>;
  let items: WritableSignal<readonly ListTaskItem[]>;
  let presentation: WritableSignal<ListViewPresentation>;
  let config: WritableSignal<{ groupBy: ListGroupBy }>;
  let setPresentation: Mock;
  let followCustomFields: Mock;
  let detailClosed: Subject<string>;

  /**
   * Function setup
   *
   * @description
   * Provides the store for Sprint 14 with its faked reader, frame and data access.
   *
   * @returns {SheetViewStoreInstance} The store, loading the list.
   */
  function setup(): SheetViewStoreInstance {
    TestBed.configureTestingModule({
      providers: [
        SheetViewStore,
        {
          provide: SheetTasksApi,
          useValue: { facts: factsRead.asObservable(), customFields, spentMinutes },
        },
        { provide: ListTasksStore, useValue: { items } },
        {
          provide: ListViewStore,
          useValue: { presentation, config, setPresentation, followCustomFields },
        },
        {
          provide: ListPageStore,
          useValue: {
            organizationMembers: ready([]),
            list: ready({ id: 'sprint-14', name: 'Sprint 14' }),
          },
        },
        {
          provide: TaskDetailOpener,
          useValue: { closed: detailClosed.asObservable(), changed: new Subject<string>() },
        },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: { organization: () => ({ id: 'org-atelier-nord' }) },
        },
      ],
    });
    const store: SheetViewStoreInstance = TestBed.inject(SheetViewStore);
    store.load('sprint-14');
    TestBed.tick();
    return store;
  }

  beforeEach(() => {
    factsRead = new Subject<readonly SheetTaskFacts[]>();
    customFields = vi.fn<SheetTasksApi['customFields']>(() => Promise.resolve([points]));
    spentMinutes = vi.fn<SheetTasksApi['spentMinutes']>(() => Promise.resolve(30));
    items = signal<readonly ListTaskItem[]>([item('CAD-482')]);
    presentation = signal<ListViewPresentation>({
      hiddenBoardStatusKeys: [],
      hiddenSheetColumns: [],
      hiddenCustomFieldIds: [],
      sheetSort: null,
      customFieldSort: null,
    });
    config = signal<{ groupBy: ListGroupBy }>({ groupBy: null });
    setPresentation = vi.fn();
    followCustomFields = vi.fn();
    detailClosed = new Subject<string>();
  });

  it('shows the estimate and fields of the read, never replaced by an older version', () => {
    const store: SheetViewStoreInstance = setup();
    factsRead.next([facts(5, 240)]);
    factsRead.next([facts(4, 60)]);
    const row: SheetRow = store.rows()[0];
    expect(row.estimateMinutes).toBe(240);
    expect(row.customFieldValues).toEqual({ 'f-points': 5 });
  });

  it('keeps a confirmed edit until a read reaches its version', async () => {
    const store: SheetViewStoreInstance = setup();
    factsRead.next([facts(4, 60)]);
    store.showEdit('CAD-482', { estimateMinutes: 180 }, Promise.resolve(outcome(5)));
    expect(store.rows()[0].estimateMinutes).toBe(180);
    await flush();
    factsRead.next([facts(4, 60)]);
    expect(store.rows()[0].estimateMinutes).toBe(180);
    factsRead.next([facts(5, 180)]);
    expect(store.rows()[0].estimateMinutes).toBe(180);
    factsRead.next([facts(6, 120)]);
    expect(store.rows()[0].estimateMinutes).toBe(120);
  });

  it('drops a confirmed edit at once when a read already reached its version', async () => {
    const store: SheetViewStoreInstance = setup();
    factsRead.next([facts(4, 60)]);
    let answer: (outcome: ViewTaskOutcome) => void = (): void => undefined;
    store.showEdit(
      'CAD-482',
      { estimateMinutes: 180 },
      new Promise<ViewTaskOutcome>((resolve: (outcome: ViewTaskOutcome) => void) => {
        answer = resolve;
      }),
    );
    factsRead.next([facts(6, 120)]);
    expect(store.rows()[0].estimateMinutes).toBe(180);
    answer(outcome(5));
    await flush();
    expect(store.rows()[0].estimateMinutes).toBe(120);
  });

  it('groups the rows by the view grouping and folds Cancelled by default', () => {
    items.set([item('CAD-482'), { ...item('CAD-475'), status: 'cancelled' }]);
    const store: SheetViewStoreInstance = setup();
    expect(store.groups().order).toEqual([]);
    config.set({ groupBy: 'status' });
    expect(store.groups().order).toEqual(['todo', 'cancelled']);
    expect(store.collapsed()).toEqual(['cancelled']);
    store.setCollapsed([]);
    expect(store.collapsed()).toEqual([]);
    config.set({ groupBy: 'priority' });
    expect(store.collapsed()).toEqual([]);
    config.set({ groupBy: 'status' });
    expect(store.collapsed()).toEqual([]);
  });

  it('puts the read value back when the write is refused', async () => {
    const store: SheetViewStoreInstance = setup();
    factsRead.next([facts(4, 60)]);
    store.showEdit(
      'CAD-482',
      { customFieldValues: { 'f-points': null } },
      Promise.resolve(outcome(null)),
    );
    expect(store.rows()[0].customFieldValues).toEqual({});
    await flush();
    expect(store.rows()[0].customFieldValues).toEqual({ 'f-points': 5 });
    expect(store.rows()[0].estimateMinutes).toBe(60);
  });

  it('reads the time spent of the shown rows four at a time, once each', async () => {
    const keys: readonly string[] = [
      'CAD-482',
      'CAD-479',
      'CAD-475',
      'CAD-488',
      'CAD-490',
      'CAD-491',
    ];
    items.set(keys.map(item));
    const pending: ((minutes: number) => void)[] = [];
    spentMinutes.mockImplementation(
      () => new Promise<number>((resolve: (minutes: number) => void) => pending.push(resolve)),
    );
    const store: SheetViewStoreInstance = setup();
    for (const key of keys) store.requestSpent(key);
    store.requestSpent('CAD-482');
    await flush();
    expect(spentMinutes).toHaveBeenCalledTimes(SPENT_CONCURRENCY);
    expect(store.totals().spentMinutes).toBeNull();
    for (const resolve of pending.splice(0)) resolve(30);
    await flush();
    expect(spentMinutes).toHaveBeenCalledTimes(keys.length);
    for (const resolve of pending.splice(0)) resolve(30);
    await flush();
    expect(store.totals().spentMinutes).toBe(180);
    expect(store.rows()[0].spentMinutes).toBe(30);
  });

  it('reads the time spent again when a task detail closes', async () => {
    const store: SheetViewStoreInstance = setup();
    store.requestSpent('CAD-482');
    await flush();
    spentMinutes.mockResolvedValue(75);
    detailClosed.next('CAD-482');
    await flush();
    expect(spentMinutes).toHaveBeenCalledTimes(2);
    expect(store.rows()[0].spentMinutes).toBe(75);
  });

  it('publishes the custom fields to the frame once read', async () => {
    const store: SheetViewStoreInstance = setup();
    await vi.waitFor(() => {
      TestBed.tick();
      expect(followCustomFields).toHaveBeenCalledWith([{ id: 'f-points', name: 'Points' }]);
    });
    expect(store.customFields()).toEqual([points]);
    expect(store.fieldsFailed()).toBe(false);
  });

  it('shows a failed custom field read and reads again on Retry', async () => {
    customFields.mockRejectedValueOnce(new Error('unavailable'));
    const store: SheetViewStoreInstance = setup();
    await vi.waitFor(() => {
      TestBed.tick();
      expect(store.fieldsFailed()).toBe(true);
    });
    expect(store.customFields()).toEqual([]);
    expect(followCustomFields).not.toHaveBeenCalled();
    store.reloadFields();
    await vi.waitFor(() => {
      TestBed.tick();
      expect(store.customFields()).toEqual([points]);
    });
    expect(customFields).toHaveBeenCalledTimes(2);
  });

  it('writes the order and the hidden columns to the presentation', async () => {
    const store: SheetViewStoreInstance = setup();
    await vi.waitFor(() => {
      TestBed.tick();
      expect(store.customFields()).toEqual([points]);
    });
    store.setOrder({ key: 'field:f-points', direction: 'desc' });
    expect(setPresentation).toHaveBeenLastCalledWith({
      sheetSort: null,
      customFieldSort: { fieldId: 'f-points', direction: 'desc' },
    });
    store.setColumnShown('estimate', false);
    expect(setPresentation).toHaveBeenLastCalledWith({ hiddenSheetColumns: ['estimate'] });
    store.setColumnShown('field:f-points', false);
    expect(setPresentation).toHaveBeenLastCalledWith({ hiddenCustomFieldIds: ['f-points'] });
    presentation.set({
      ...presentation(),
      hiddenSheetColumns: ['estimate', 'points'],
      hiddenCustomFieldIds: ['f-points', 'f-retired'],
    });
    expect(store.hiddenColumns()).toEqual(['estimate', 'field:f-points']);
    store.showAllColumns();
    expect(setPresentation).toHaveBeenLastCalledWith({
      hiddenSheetColumns: [],
      hiddenCustomFieldIds: [],
    });
  });

  it('forgets the facts of the previous list', () => {
    const store: SheetViewStoreInstance = setup();
    factsRead.next([facts(4, 60)]);
    store.load('sprint-15');
    TestBed.tick();
    expect(store.rows()[0].estimateMinutes).toBeNull();
  });
});
