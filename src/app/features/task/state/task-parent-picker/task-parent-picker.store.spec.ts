import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { TaskDetailApi } from '../../data-access/services/task-detail-api/task-detail-api.service';
import type { TaskParentCandidate } from '../../models/task-detail/task-detail.interface';
import {
  allowedParents,
  SEARCH_DEBOUNCE_MS,
  type TaskParentContext,
  TaskParentPickerStore,
  type TaskParentPickerStoreInstance,
} from './task-parent-picker.store';

/**
 * Function candidate
 *
 * @description
 * A task of Sprint 14.
 *
 * @param {string} key - Its key.
 * @param {string | null} parentKey - Its parent.
 * @param {number} [children] - Its direct subtasks.
 * @returns {TaskParentCandidate} The candidate.
 */
function candidate(
  key: string,
  parentKey: string | null,
  children: number = 0,
): TaskParentCandidate {
  return { key, name: `Task ${key}`, status: 'todo', sameList: true, parentKey, children };
}

/**
 * Constant context
 *
 * @description
 * CAD-482, a top-level task with one subtask CAD-483 without its own.
 *
 * @type {TaskParentContext}
 */
const context: TaskParentContext = {
  key: 'CAD-482',
  listId: 'sprint-14',
  parentKey: null,
  childKeys: ['CAD-483'],
  height: 1,
};

describe('allowedParents', () => {
  it('leaves out the task, its subtree, a full parent and a level that would break the limit', () => {
    const options: readonly TaskParentCandidate[] = allowedParents(context, [
      candidate('CAD-482', null),
      candidate('CAD-483', 'CAD-482'),
      candidate('CAD-484', 'CAD-483'),
      candidate('CAD-470', null),
      candidate('CAD-471', 'CAD-470'),
      candidate('CAD-472', 'CAD-471'),
      candidate('CAD-460', null, 25),
      { key: 'OPS-12', name: 'Deploy', status: 'progress', sameList: false },
    ]);

    expect(options.map((option: TaskParentCandidate) => option.key)).toEqual(['CAD-470', 'OPS-12']);
  });

  it('leaves out the current parent and puts the open list first, 12 at most', () => {
    const many: TaskParentCandidate[] = Array.from({ length: 14 }, (_: unknown, index: number) =>
      candidate(`CAD-${(500 + index).toString()}`, null),
    );
    const options: readonly TaskParentCandidate[] = allowedParents(
      { ...context, parentKey: 'CAD-500', childKeys: [], height: 0 },
      [{ key: 'OPS-1', name: 'Other', status: 'todo', sameList: false }, ...many],
    );

    expect(options).toHaveLength(12);
    expect(options[0].key).toBe('CAD-501');
    expect(options.some((option: TaskParentCandidate) => option.key === 'CAD-500')).toBe(false);
  });
});

describe('TaskParentPickerStore', () => {
  let listCandidates: Mock<
    (listId: string, query: string) => Promise<readonly TaskParentCandidate[]>
  >;
  let searchCandidates: Mock<(query: string) => Promise<readonly TaskParentCandidate[]>>;
  let store: TaskParentPickerStoreInstance;

  beforeEach(() => {
    vi.useFakeTimers();
    listCandidates = vi.fn(() => Promise.resolve([candidate('CAD-470', null)]));
    searchCandidates = vi.fn(() =>
      Promise.resolve([
        { key: 'CAD-470', name: 'Task CAD-470', status: 'todo', sameList: false },
        { key: 'OPS-12', name: 'Deploy', status: 'progress', sameList: false },
      ] as const),
    );
    TestBed.configureTestingModule({
      providers: [
        TaskParentPickerStore,
        { provide: TaskDetailApi, useValue: { listCandidates, searchCandidates } },
      ],
    });
    store = TestBed.inject(TaskParentPickerStore);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the open list at once, then searches every list after a pause', async () => {
    store.start(context);
    await vi.runAllTimersAsync();

    expect(listCandidates).toHaveBeenCalledWith('sprint-14', '');
    expect(searchCandidates).not.toHaveBeenCalled();
    expect(store.options().map((option: TaskParentCandidate) => option.key)).toEqual(['CAD-470']);

    store.search('de');
    store.search('dep');
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);

    expect(searchCandidates).toHaveBeenCalledOnce();
    expect(searchCandidates).toHaveBeenCalledWith('dep');
    expect(store.options().map((option: TaskParentCandidate) => option.key)).toEqual([
      'CAD-470',
      'OPS-12',
    ]);
  });

  it('keeps a failed read apart from an empty result and retries it', async () => {
    listCandidates.mockRejectedValueOnce(new Error('offline'));
    store.start(context);
    await vi.runAllTimersAsync();

    expect(store.failed()).toBe(true);

    store.retry();
    await vi.runAllTimersAsync();

    expect(store.failed()).toBe(false);
    expect(store.options()).toHaveLength(1);
  });
});
