import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, type Observable, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TaskDetailApi } from '../../data-access/services/task-detail/task-detail-api.service';
import { TaskDetailRequestError } from '../../models/task-detail/task-detail-failure.model';
import type {
  TaskDetailView,
  TaskRouteContext,
  TaskStatusConfirmation,
} from '../../models/task-detail/task-detail.model';
import { TaskDetailStore } from './task-detail.store';

/**
 * Constant taskView
 *
 * @description
 * A visible task that permits three ordinary status choices.
 *
 * @type {TaskDetailView}
 */
const taskView: TaskDetailView = {
  key: 'CAD-482',
  name: 'Refondre l’écran de connexion SSO',
  status: 'progress',
  version: 3,
  description: null,
  mayEditStatus: true,
  options: [
    { key: 'todo', label: 'À faire', selectable: true },
    { key: 'progress', label: 'En cours', selectable: true },
    { key: 'review', label: 'En revue', selectable: true },
    { key: 'blocked', label: 'Bloqué', selectable: false },
  ],
  space: { id: 'space', name: 'Produit' },
  list: { id: 'list', name: 'Sprint 14' },
  parent: null,
  subtasks: [],
  comments: [],
  commentsUnavailable: false,
};

/**
 * Function flushResource
 *
 * @description
 * Flushes the router-input reaction and the async result of the synchronous fixture.
 *
 * @returns {Promise<void>} Resolves once the current resource result can be read.
 */
async function flushResource(): Promise<void> {
  TestBed.tick();
  await Promise.resolve();
  TestBed.tick();
}

/**
 * Function setup
 *
 * @description
 * Binds one fixture client to a fresh store and starts following its route parameter.
 *
 * @param {Pick<TaskDetailApi, 'load' | 'changeStatus'>} api - Fixture reads and writes.
 * @param {WritableSignal<TaskRouteContext>} [route] - Mutable input used to test route changes.
 * @returns {Promise<InstanceType<typeof TaskDetailStore>>} The store after loading.
 */
async function setup(
  api: Pick<TaskDetailApi, 'load' | 'changeStatus'>,
  route: WritableSignal<TaskRouteContext> = signal({ key: taskView.key, organizationId: 'org-a' }),
): Promise<InstanceType<typeof TaskDetailStore>> {
  TestBed.configureTestingModule({
    providers: [TaskDetailStore, { provide: TaskDetailApi, useValue: api }],
  });
  const store: InstanceType<typeof TaskDetailStore> = TestBed.inject(TaskDetailStore);
  TestBed.runInInjectionContext(() => {
    store.followTask(route);
  });
  await flushResource();
  return store;
}

describe('TaskDetailStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('makes only the last write from a burst and disables overlapping writes', async () => {
    const response: Subject<TaskStatusConfirmation> = new Subject<TaskStatusConfirmation>();
    const changeStatus: ReturnType<typeof vi.fn<TaskDetailApi['changeStatus']>> = vi.fn<
      TaskDetailApi['changeStatus']
    >(() => response);
    const store: InstanceType<typeof TaskDetailStore> = await setup({
      load: () => of(taskView),
      changeStatus,
    });

    store.changeStatus('todo');
    expect(store.detail()?.status).toBe('todo');
    store.changeStatus('review');
    expect(store.detail()?.status).toBe('review');
    await vi.advanceTimersByTimeAsync(459);
    expect(changeStatus).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(store.savingStatus()).toBe(true);
    store.changeStatus('todo');
    expect(changeStatus).toHaveBeenCalledExactlyOnceWith('CAD-482', 'review', 3, 'org-a');
    response.next({ key: 'CAD-482', status: 'review', version: 4 });
    response.complete();
    expect(store.detail()?.status).toBe('review');
    expect(store.detail()?.version).toBe(4);
    expect(store.savingStatus()).toBe(false);
    expect(store.statusSaved()).toBe(true);
  });

  it('cancels a pending write when the user returns to the saved status', async () => {
    const changeStatus: ReturnType<typeof vi.fn<TaskDetailApi['changeStatus']>> =
      vi.fn<TaskDetailApi['changeStatus']>();
    const store: InstanceType<typeof TaskDetailStore> = await setup({
      load: () => of(taskView),
      changeStatus,
    });

    store.changeStatus('blocked');
    expect(store.detail()?.status).toBe('progress');
    store.changeStatus('review');
    store.changeStatus('progress');
    await vi.advanceTimersByTimeAsync(460);

    expect(store.detail()?.status).toBe('progress');
    expect(changeStatus).not.toHaveBeenCalled();
  });

  it('reloads the current version after a conflict without replaying the write', async () => {
    const load: ReturnType<typeof vi.fn<TaskDetailApi['load']>> = vi
      .fn<TaskDetailApi['load']>()
      .mockReturnValueOnce(of(taskView))
      .mockReturnValueOnce(of({ ...taskView, status: 'todo', version: 4 }));
    const changeStatus: ReturnType<typeof vi.fn<TaskDetailApi['changeStatus']>> = vi.fn<
      TaskDetailApi['changeStatus']
    >(() => throwError(() => new TaskDetailRequestError('stale')));
    const store: InstanceType<typeof TaskDetailStore> = await setup({ load, changeStatus });

    store.changeStatus('review');
    await vi.advanceTimersByTimeAsync(460);
    await flushResource();

    expect(store.detail()?.status).toBe('todo');
    expect(store.detail()?.version).toBe(4);
    expect(store.statusFailure()).toBe('stale');
    expect(changeStatus).toHaveBeenCalledExactlyOnceWith('CAD-482', 'review', 3, 'org-a');
  });

  it('does not send the pending status of a task after the route key changes', async () => {
    const route: WritableSignal<TaskRouteContext> = signal({
      key: taskView.key,
      organizationId: 'org-a',
    });
    const load: (key: string) => Observable<TaskDetailView> = (key) => of({ ...taskView, key });
    const changeStatus: ReturnType<typeof vi.fn<TaskDetailApi['changeStatus']>> =
      vi.fn<TaskDetailApi['changeStatus']>();
    const store: InstanceType<typeof TaskDetailStore> = await setup({ load, changeStatus }, route);

    store.changeStatus('review');
    route.update((context) => ({ ...context, key: 'CAD-483' }));
    await flushResource();
    await vi.advanceTimersByTimeAsync(460);

    expect(store.detail()?.key).toBe('CAD-483');
    expect(store.detail()?.status).toBe('progress');
    expect(changeStatus).not.toHaveBeenCalled();
  });

  it('hides the stale task when its organization is no longer active', async () => {
    const load: ReturnType<typeof vi.fn<TaskDetailApi['load']>> = vi
      .fn<TaskDetailApi['load']>()
      .mockReturnValue(of(taskView));
    const changeStatus: ReturnType<typeof vi.fn<TaskDetailApi['changeStatus']>> = vi.fn<
      TaskDetailApi['changeStatus']
    >(() => throwError(() => new TaskDetailRequestError('organization-changed')));
    const store: InstanceType<typeof TaskDetailStore> = await setup({ load, changeStatus });

    store.changeStatus('review');
    await vi.advanceTimersByTimeAsync(460);
    store.retry();
    await flushResource();

    expect(store.detail()).toBeUndefined();
    expect(store.loadFailure()).toBe('organization-changed');
    expect(store.savingStatus()).toBe(false);
    expect(load).toHaveBeenCalledExactlyOnceWith('CAD-482', 'org-a');
  });

  it('discards the previous write result across navigation out of and back to the task', async () => {
    const route: WritableSignal<TaskRouteContext> = signal({
      key: taskView.key,
      organizationId: 'org-a',
    });
    const response: Subject<TaskStatusConfirmation> = new Subject<TaskStatusConfirmation>();
    const changeStatus: ReturnType<typeof vi.fn<TaskDetailApi['changeStatus']>> = vi.fn<
      TaskDetailApi['changeStatus']
    >(() => response);
    const store: InstanceType<typeof TaskDetailStore> = await setup(
      { load: (key) => of({ ...taskView, key }), changeStatus },
      route,
    );

    store.changeStatus('review');
    await vi.advanceTimersByTimeAsync(460);
    route.update((context) => ({ ...context, key: 'CAD-483' }));
    await flushResource();
    route.update((context) => ({ ...context, key: taskView.key }));
    await flushResource();
    response.next({ key: taskView.key, status: 'review', version: 4 });

    expect(store.detail()?.status).toBe('progress');
    expect(store.detail()?.version).toBe(3);
    expect(store.statusSaved()).toBe(false);
  });
});
