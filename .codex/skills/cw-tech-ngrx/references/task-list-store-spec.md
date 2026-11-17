# Task list spec example

This spec exercises the [canonical store](task-list-store.md).

```ts
import { TestBed } from '@angular/core/testing';
import { patchState } from '@ngrx/signals';
import { setAllEntities } from '@ngrx/signals/entities';
import { unprotected } from '@ngrx/signals/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TaskApi } from '../data-access/services/task-api';
import type { Task } from '../models/task';
import { TaskListStore } from './task-list-store';

const tasks: Task[] = [{ id: 't1', title: 'Maquette', status: 'todo' }];

function setup(api: Partial<TaskApi>) {
  TestBed.configureTestingModule({
    providers: [TaskListStore, { provide: TaskApi, useValue: api }],
  });
  const store = TestBed.inject(TaskListStore);
  patchState(unprotected(store), setAllEntities(tasks));
  return store;
}

const statusOf = (store: ReturnType<typeof setup>) => store.tasks()[0].status;

describe('TaskListStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows each click at once and sends only the final status of a burst', async () => {
    const changeStatus = vi.fn(() => Promise.resolve());
    const store = setup({ changeStatus });

    store.changeStatus('t1', 'in-progress');
    store.changeStatus('t1', 'done');

    expect(statusOf(store)).toBe('done');
    expect(changeStatus).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(changeStatus).toHaveBeenCalledExactlyOnceWith('t1', 'done');
    expect(store.doneCount()).toBe(1);
  });

  it('cancels the pending change when the saved status is clicked again', async () => {
    const changeStatus = vi.fn(() => Promise.resolve());
    const store = setup({ changeStatus });

    store.changeStatus('t1', 'done');
    store.changeStatus('t1', 'todo');
    await vi.runAllTimersAsync();

    expect(changeStatus).not.toHaveBeenCalled();
    expect(statusOf(store)).toBe('todo');
  });

  it('rolls back when the API refuses the change', async () => {
    const store = setup({ changeStatus: vi.fn(() => Promise.reject(new Error('500'))) });

    store.changeStatus('t1', 'done');
    await vi.runAllTimersAsync();

    expect(statusOf(store)).toBe('todo');
  });

  it('undo sends the saved status at once', async () => {
    const changeStatus = vi.fn(() => Promise.resolve());
    const store = setup({ changeStatus });
    store.changeStatus('t1', 'done');
    await vi.runAllTimersAsync();

    store.undo('t1');
    await vi.runAllTimersAsync();

    expect(statusOf(store)).toBe('todo');
    expect(changeStatus).toHaveBeenLastCalledWith('t1', 'todo');
  });

  it('a refused undo restores the changed status and keeps Annuler available', async () => {
    const changeStatus = vi
      .fn<() => Promise<void>>()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('500'))
      .mockResolvedValue();
    const store = setup({ changeStatus });
    store.changeStatus('t1', 'done');
    await vi.runAllTimersAsync();

    store.undo('t1');
    await vi.runAllTimersAsync();
    expect(statusOf(store)).toBe('done');

    store.undo('t1');
    await vi.runAllTimersAsync();
    expect(statusOf(store)).toBe('todo');
  });

  it('offers no undo once the toast has closed', async () => {
    const changeStatus = vi.fn(() => Promise.resolve());
    const store = setup({ changeStatus });
    store.changeStatus('t1', 'done');
    await vi.runAllTimersAsync();

    store.forgetUndo('t1');
    store.undo('t1');
    await vi.runAllTimersAsync();

    expect(changeStatus).toHaveBeenCalledOnce();
    expect(statusOf(store)).toBe('done');
  });

  it('keeps the tasks and flags the failure when the search fails, then retries', async () => {
    const search = vi
      .fn<TaskApi['search']>()
      .mockReturnValueOnce(throwError(() => new Error('500')))
      .mockReturnValue(of([{ id: 't2', title: 'Sprint 14', status: 'todo' }]));
    const store = setup({ search });

    store.search('sprint');
    await vi.runAllTimersAsync();
    expect(store.searchFailed()).toBe(true);
    expect(store.tasks()).toEqual(tasks);

    store.retrySearch();
    await vi.runAllTimersAsync();
    expect(search).toHaveBeenLastCalledWith('sprint');
    expect(store.searchFailed()).toBe(false);
    expect(store.tasks().map((task) => task.id)).toEqual(['t2']);
  });
});
```
