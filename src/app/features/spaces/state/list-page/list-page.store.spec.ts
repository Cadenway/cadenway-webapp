import { HttpErrorResponse } from '@angular/common/http';
import {
  createEnvironmentInjector,
  EnvironmentInjector,
  signal,
  type WritableSignal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type Observable, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { type RealtimeChange, RealtimeConnection } from '@core/realtime';
import { AccessDeniedRouteError } from '@shared/route-errors';
import { type CreatedTask, TaskCreate } from '@features/task';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { ListsApi } from '../../data-access/services/lists-api/lists-api.service';
import { SpacesApi } from '../../data-access/services/spaces-api/spaces-api.service';
import type { SavedView } from '../../models/saved-view/saved-view.interface';
import type { ListSummary, TaskList } from '../../models/task-list/task-list.interface';
import { DEFAULT_VIEW_CONFIG } from '../../utils/list-view-query/list-view-query.util';
import { ListPageStore } from './list-page.store';

/**
 * Constant sprint14
 *
 * @description
 * The mockup's `Sprint 14`.
 *
 * @type {TaskList}
 */
const sprint14: TaskList = {
  id: 'l-sprint14',
  spaceId: 'sp-product',
  name: 'Sprint 14',
  icon: 'lightning',
  color: 'violet',
  sprint: { startDate: '2026-11-03', endDate: '2026-11-17', goal: null },
  archived: false,
  canEdit: true,
  version: 4,
};

/**
 * Constant criticalBugs
 *
 * @description
 * A saved view of the list.
 *
 * @type {SavedView}
 */
const criticalBugs: SavedView = {
  id: 'sv-bugs',
  listId: 'l-sprint14',
  name: 'Critical bugs',
  icon: 'bug',
  layout: 'list',
  config: DEFAULT_VIEW_CONFIG,
  version: 1,
};

/**
 * Type ApiFake
 *
 * @description
 * Mocks of the list page's data-access methods, by name.
 *
 * @type {Record<string, Mock>}
 */
type ApiFake = Record<string, Mock>;

describe('ListPageStore', () => {
  let api: ApiFake;
  let notices: Subject<RealtimeChange>;
  let creations: Subject<CreatedTask>;
  let watch: Mock;
  let store: InstanceType<typeof ListPageStore>;
  let organization: WritableSignal<{ id: string }>;

  beforeEach(() => {
    organization = signal({ id: 'org-atelier-nord' });
    notices = new Subject<RealtimeChange>();
    creations = new Subject<CreatedTask>();
    watch = vi.fn((): Observable<RealtimeChange> => notices.asObservable());
    api = {
      list: vi.fn(() => Promise.resolve(sprint14)),
      counts: vi.fn(() =>
        Promise.resolve({
          list: sprint14,
          counts: { total: 98, open: 70, done: 24, cancelled: 2, late: 3 },
        }),
      ),
      milestoneCount: vi.fn(() => Promise.resolve(2)),
      listMembers: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
      organizationMembers: vi.fn(() => Promise.resolve([{ userId: 'u1', name: 'Inès Robert' }])),
      labels: vi.fn(() => Promise.resolve(['Auth', 'Front'])),
      savedViews: vi.fn(() => Promise.resolve([criticalBugs])),
      duplicate: vi.fn(),
      exportCsv: vi.fn(),
      archive: vi.fn(),
      remove: vi.fn(),
      createSavedView: vi.fn(),
      updateSavedView: vi.fn(),
      duplicateSavedView: vi.fn(),
      deleteSavedView: vi.fn(),
      bulk: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        ListPageStore,
        { provide: WORKSPACE_CONTEXT, useValue: { organization } },
        { provide: ListsApi, useValue: api },
        {
          provide: SpacesApi,
          useValue: { space: vi.fn(() => Promise.resolve({ id: 'sp-product' })) },
        },
        { provide: RealtimeConnection, useValue: { watch } },
        { provide: TaskCreate, useValue: { created: creations.asObservable() } },
      ],
    });
    store = TestBed.inject(ListPageStore);
  });

  /**
   * Function loaded
   *
   * @description
   * Binds Sprint 14 and waits for its reads.
   *
   * @returns {Promise<void>} Resolves once the list and its counts are read.
   */
  async function loaded(): Promise<void> {
    store.load('l-sprint14');
    await expect.poll(() => store.list.hasValue() && store.counts.hasValue()).toBe(true);
    await expect.poll(() => store.savedViews.hasValue()).toBe(true);
  }

  it('keeps the typed route error of a failed primary read', async () => {
    api['list'].mockRejectedValueOnce(
      new AccessDeniedRouteError({ kind: 'list', id: 'l-x', name: null, ownerName: null }),
    );
    store.load('l-x');
    await expect.poll(() => store.list.status()).toBe('error');
    expect(store.list.error()).toBeInstanceOf(AccessDeniedRouteError);
  });

  it('watches the list room and reads the counts again on a notice', async () => {
    await loaded();
    expect(watch).toHaveBeenCalledWith({ kind: 'list', listId: 'l-sprint14' });
    const calls: number = api['counts'].mock.calls.length;

    notices.next({
      id: 'n1',
      type: 'task.updated',
      at: '2026-11-08T09:00:00Z',
      data: { listId: 'l-sprint14' },
    });
    await expect.poll(() => api['counts'].mock.calls.length).toBe(calls + 1);
    expect(api['milestoneCount']).toHaveBeenCalledTimes(2);
  });

  it('reads the counts again on a task notice, which names only its task', async () => {
    await loaded();

    notices.next({
      id: 'n1',
      type: 'task.status-changed.v1',
      at: '2026-11-08T09:00:00Z',
      data: { taskId: 'CAD-482', changed: ['status'] },
    });
    await expect.poll(() => api['counts'].mock.calls.length).toBe(2);
  });

  it('reads the counts again when a task joins or leaves the list', async () => {
    await loaded();

    notices.next({
      id: 'n1',
      type: 'list.tasks-changed.v1',
      at: '2026-11-08T09:00:00Z',
      data: { listId: 'l-sprint14' },
    });

    await expect.poll(() => api['counts'].mock.calls.length).toBe(2);
  });

  it('ignores the comment and Git link notices, which cannot change the counts', async () => {
    await loaded();

    for (const type of ['comment.created.v1', 'git.links-changed.v1']) {
      notices.next({ id: type, type, at: '2026-11-08T09:00:00Z', data: { taskId: 'CAD-482' } });
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 400);
    });

    expect(api['counts']).toHaveBeenCalledTimes(1);
    expect(api['milestoneCount']).toHaveBeenCalledTimes(1);
  });

  it('reads the counts again while task notices keep arriving faster than 300 ms', async () => {
    await loaded();
    const notice: RealtimeChange = {
      id: 'n1',
      type: 'task.updated.v1',
      at: '2026-11-08T09:00:00Z',
      data: { taskId: 'CAD-482', changed: ['dueDate'] },
    };

    for (let sent: number = 0; sent < 8; sent++) {
      notices.next(notice);
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });
    }

    expect(api['counts'].mock.calls.length).toBeGreaterThan(1);
  });

  it('ignores unrelated notices and gathers matching notices into one refresh', async () => {
    await loaded();
    const notice: RealtimeChange = {
      id: 'n1',
      type: 'task.updated',
      at: '2026-11-08T09:00:00Z',
      data: { listId: 'other' },
    };
    notices.next(notice);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 350);
    });
    expect(api['counts']).toHaveBeenCalledTimes(1);
    notices.next({ ...notice, data: { listId: 'l-sprint14' } });
    notices.next({ ...notice, data: { spaceId: 'sp-product' } });
    await expect.poll(() => api['counts'].mock.calls.length).toBe(2);
    expect(api['milestoneCount']).toHaveBeenCalledTimes(2);
  });

  it('reads the counts again when a task is created in the list, not in another one', async () => {
    await loaded();
    const created: CreatedTask = {
      key: 'CAD-483',
      listId: 'l-sprint14',
      status: 'todo',
      subtasks: 0,
    };

    creations.next({ ...created, listId: 'l-other' });
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });
    expect(api['counts']).toHaveBeenCalledTimes(1);

    creations.next(created);
    await expect.poll(() => api['counts'].mock.calls.length).toBe(2);
    expect(api['milestoneCount']).toHaveBeenCalledTimes(2);
  });

  it('retains counts and queues one refresh while a read is running', async () => {
    await loaded();
    const original: ListSummary | undefined = store.counts.value();
    let finish: (value: unknown) => void = () => undefined;
    api['counts'].mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    store.refreshCounts();
    await expect.poll(() => api['counts'].mock.calls.length).toBe(2);
    store.refreshCounts();
    store.refreshCounts();
    expect(store.counts.value()).toEqual(original);
    finish(original);
    await expect.poll(() => api['counts'].mock.calls.length).toBe(3);
  });

  it('shows the open list as edited elsewhere and ignores another list', async () => {
    await loaded();
    const edits: Subject<TaskList> = new Subject<TaskList>();
    store.followListEdits(edits);

    edits.next({ ...sprint14, id: 'l-other', name: 'Other' });
    expect(store.list.value()?.name).toBe('Sprint 14');
    edits.next({ ...sprint14, name: 'Sprint 15', version: 9 });
    expect(store.list.value()).toMatchObject({ name: 'Sprint 15', version: 9 });
  });

  it('creates a deleted view again at its former place', async () => {
    await loaded();
    const again: SavedView = { ...criticalBugs, id: 'sv-again' };
    api['createSavedView'].mockResolvedValueOnce(again);
    await store.deleteView(criticalBugs);

    expect(await store.restoreView(criticalBugs, 0)).toEqual(again);
    expect(store.savedViews.value()).toEqual([again]);
    expect(api['createSavedView']).toHaveBeenCalledWith('l-sprint14', {
      name: criticalBugs.name,
      icon: criticalBugs.icon,
      layout: criticalBugs.layout,
      config: criticalBugs.config,
    });
  });

  it('removes a saved view at once and puts it back when the deletion is refused', async () => {
    await loaded();
    api['deleteSavedView'].mockRejectedValueOnce(new Error('saved-view.list-archived'));

    const pending: Promise<boolean> = store.deleteView(criticalBugs);
    expect(store.savedViews.value()).toEqual([]);

    expect(await pending).toBe(false);
    expect(store.savedViews.value()).toEqual([criticalBugs]);
  });

  it('keeps the saved views read pending or failed when a creation completes', async () => {
    let resolveViews: (views: readonly SavedView[]) => void = () => undefined;
    api['savedViews'].mockReturnValueOnce(
      new Promise<readonly SavedView[]>((resolve) => {
        resolveViews = resolve;
      }),
    );
    store.load('l-sprint14');
    await expect.poll(() => store.savedViews.isLoading()).toBe(true);
    const created: SavedView = { ...criticalBugs, id: 'sv-new' };
    api['createSavedView'].mockResolvedValue(created);
    expect(
      await store.createView({ name: 'New', icon: null }, 'list', DEFAULT_VIEW_CONFIG),
    ).toEqual(created);
    expect(store.savedViews.isLoading()).toBe(true);
    resolveViews([criticalBugs, created]);
    await expect.poll(() => store.savedViews.hasValue()).toBe(true);
    expect(store.savedViews.value()).toEqual([criticalBugs, created]);

    api['savedViews'].mockRejectedValueOnce(new Error('unavailable'));
    store.savedViews.reload();
    await expect.poll(() => store.savedViews.status()).toBe('error');
    expect(
      await store.createView({ name: 'New', icon: null }, 'list', DEFAULT_VIEW_CONFIG),
    ).toEqual(created);
    expect(store.savedViews.status()).toBe('error');
    expect(store.savedViews.error()).toBeTruthy();
  });

  it('does not overwrite a failed read when a creation finishes after it', async () => {
    await loaded();
    let finish: (view: SavedView) => void = () => undefined;
    api['createSavedView'].mockReturnValueOnce(
      new Promise<SavedView>((resolve) => {
        finish = resolve;
      }),
    );
    const pending: Promise<SavedView | null> = store.createView(
      { name: 'New', icon: null },
      'list',
      DEFAULT_VIEW_CONFIG,
    );
    api['savedViews'].mockRejectedValueOnce(new Error('unavailable'));
    store.savedViews.reload();
    await expect.poll(() => store.savedViews.status()).toBe('error');
    finish({ ...criticalBugs, id: 'sv-new' });
    await pending;
    expect(store.savedViews.status()).toBe('error');
  });

  it('restores only the deleted view when other writes succeed before its refusal', async () => {
    const second: SavedView = { ...criticalBugs, id: 'sv-second', name: 'Second' };
    const third: SavedView = { ...criticalBugs, id: 'sv-third', name: 'Third' };
    api['savedViews'].mockResolvedValueOnce([criticalBugs, second, third]);
    await loaded();
    let refuse: (reason: unknown) => void = () => undefined;
    api['deleteSavedView'].mockReturnValueOnce(
      new Promise<void>((_resolve, reject) => {
        refuse = reject;
      }),
    );
    const deleting: Promise<boolean> = store.deleteView(second);
    const renamed: SavedView = { ...third, name: 'Updated' };
    const created: SavedView = { ...third, id: 'sv-new', name: 'New' };
    api['updateSavedView'].mockResolvedValueOnce(renamed);
    api['createSavedView'].mockResolvedValueOnce(created);
    await store.renameView(third, { name: 'Updated', icon: null });
    await store.createView({ name: 'New', icon: null }, 'list', DEFAULT_VIEW_CONFIG);
    refuse(new Error('unavailable'));
    expect(await deleting).toBe(false);
    expect(store.savedViews.value()).toEqual([criticalBugs, second, renamed, created]);
  });

  it('appends a created view and its duplicate after its source', async () => {
    await loaded();
    const created: SavedView = { ...criticalBugs, id: 'sv-2', name: 'My tasks' };
    const copy: SavedView = { ...criticalBugs, id: 'sv-3', name: 'Critical bugs (copy)' };
    api['createSavedView'].mockResolvedValueOnce(created);
    api['duplicateSavedView'].mockResolvedValueOnce(copy);

    expect(
      await store.createView({ name: 'My tasks', icon: null }, 'list', DEFAULT_VIEW_CONFIG),
    ).toBe(created);
    expect(await store.duplicateView(criticalBugs)).toBe(copy);
    expect(store.savedViews.value()?.map((view: SavedView) => view.id)).toEqual([
      'sv-bugs',
      'sv-3',
      'sv-2',
    ]);
  });

  it('does not apply a saved view write after switching lists', async () => {
    await loaded();
    let finishDuplicate: (view: SavedView) => void = () => undefined;
    let finishUpdate: (view: SavedView) => void = () => undefined;
    api['duplicateSavedView'].mockReturnValueOnce(
      new Promise<SavedView>((resolve) => {
        finishDuplicate = resolve;
      }),
    );
    api['updateSavedView'].mockReturnValueOnce(
      new Promise<SavedView>((resolve) => {
        finishUpdate = resolve;
      }),
    );
    const duplicate: Promise<SavedView | null> = store.duplicateView(criticalBugs);
    const update: Promise<SavedView | null> = store.renameView(criticalBugs, {
      name: 'Changed',
      icon: null,
    });
    api['savedViews'].mockResolvedValueOnce([]);
    store.load('l-other');
    await expect
      .poll(() => store.savedViews.hasValue() && store.savedViews.value().length === 0)
      .toBe(true);
    finishDuplicate({ ...criticalBugs, id: 'copy' });
    finishUpdate({ ...criticalBugs, name: 'Changed' });
    await Promise.all([duplicate, update]);
    expect(store.savedViews.value()).toEqual([]);
  });

  it('reads the counts again after a bulk action and reports a refusal', async () => {
    await loaded();
    const calls: number = api['counts'].mock.calls.length;
    api['bulk'].mockResolvedValueOnce(3);

    expect(await store.bulk([{ taskKey: 'CAD-482' }], { type: 'done' })).toEqual({
      affected: 3,
      done: [{ taskKey: 'CAD-482' }],
      failed: [],
      unknown: [],
      notSent: [],
    });
    await expect.poll(() => api['counts'].mock.calls.length).toBe(calls + 1);

    api['bulk'].mockRejectedValueOnce(new HttpErrorResponse({ status: 412 }));
    expect(await store.bulk([{ taskKey: 'CAD-482' }], { type: 'trash' })).toEqual({
      affected: 0,
      done: [],
      failed: [{ taskKey: 'CAD-482' }],
      unknown: [],
      notSent: [],
    });
    expect(await store.bulk([], { type: 'trash' })).toEqual({
      affected: 0,
      done: [],
      failed: [],
      unknown: [],
      notSent: [],
    });
  });

  it('sends a selection over 50 in chunks and reports the refused chunk', async () => {
    await loaded();
    const selection: { taskKey: string }[] = Array.from(
      { length: 120 },
      (_: unknown, index: number) => ({ taskKey: `CAD-${String(400 + index)}` }),
    );
    api['bulk']
      .mockResolvedValueOnce(50)
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 412 }))
      .mockResolvedValueOnce(20);

    const outcome: Awaited<ReturnType<typeof store.bulk>> = await store.bulk(selection, {
      type: 'done',
    });

    expect(api['bulk']).toHaveBeenCalledTimes(3);
    expect(api['bulk'].mock.calls.map((call: unknown[]) => (call[0] as unknown[]).length)).toEqual([
      50, 50, 20,
    ]);
    expect(outcome.affected).toBe(70);
    expect(outcome.done).toHaveLength(70);
    expect(outcome.failed).toEqual(selection.slice(50, 100));
  });

  it('retries an uncertain chunk with the same key and reports a lost response', async () => {
    await loaded();
    api['bulk']
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }))
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    const selection: { taskKey: string }[] = [{ taskKey: 'CAD-482' }];
    const outcome: Awaited<ReturnType<typeof store.bulk>> = await store.bulk(selection, {
      type: 'done',
    });
    expect(outcome.unknown).toEqual(selection);
    expect(outcome.failed).toEqual([]);
    expect(api['bulk'].mock.calls[0][2]).toBe(api['bulk'].mock.calls[1][2]);
  });

  it('does not send later chunks after the organization changes', async () => {
    await loaded();
    let finish: (affected: number) => void = () => undefined;
    api['bulk'].mockReturnValueOnce(
      new Promise<number>((resolve) => {
        finish = resolve;
      }),
    );
    const selection: { taskKey: string }[] = Array.from({ length: 75 }, (_, index: number) => ({
      taskKey: `CAD-${String(index)}`,
    }));
    const pending: Promise<import('../../models/bulk-action/bulk-action.interface').BulkOutcome> =
      store.bulk(selection, { type: 'done' });
    organization.set({ id: 'org-lumen' });
    finish(50);
    const outcome: import('../../models/bulk-action/bulk-action.interface').BulkOutcome =
      await pending;
    expect(api['bulk']).toHaveBeenCalledTimes(1);
    expect(outcome.done).toEqual(selection.slice(0, 50));
    expect(outcome.notSent).toEqual(selection.slice(50));
    expect(outcome.unknown).toEqual([]);
  });

  it('does not retry an uncertain chunk after the organization changes', async () => {
    await loaded();
    let reject: (reason: unknown) => void = () => undefined;
    api['bulk'].mockReturnValueOnce(
      new Promise<number>((_resolve, fail) => {
        reject = fail;
      }),
    );
    const selection: { taskKey: string }[] = Array.from({ length: 75 }, (_, index: number) => ({
      taskKey: `CAD-${String(index)}`,
    }));
    const pending: Promise<import('../../models/bulk-action/bulk-action.interface').BulkOutcome> =
      store.bulk(selection, { type: 'done' });
    organization.set({ id: 'org-lumen' });
    reject(new HttpErrorResponse({ status: 0 }));
    const outcome: import('../../models/bulk-action/bulk-action.interface').BulkOutcome =
      await pending;
    expect(api['bulk']).toHaveBeenCalledTimes(1);
    expect(outcome.unknown).toEqual(selection.slice(0, 50));
    expect(outcome.notSent).toEqual(selection.slice(50));
  });

  it('does not send later chunks after the store is destroyed', async () => {
    const injector: EnvironmentInjector = createEnvironmentInjector(
      [ListPageStore],
      TestBed.inject(EnvironmentInjector),
    );
    const scoped: InstanceType<typeof ListPageStore> = injector.get(ListPageStore);
    let finish: (affected: number) => void = () => undefined;
    api['bulk'].mockReturnValueOnce(
      new Promise<number>((resolve) => {
        finish = resolve;
      }),
    );
    const selection: { taskKey: string }[] = Array.from({ length: 75 }, (_, index: number) => ({
      taskKey: `CAD-${String(index)}`,
    }));
    const pending: Promise<import('../../models/bulk-action/bulk-action.interface').BulkOutcome> =
      scoped.bulk(selection, { type: 'done' });
    injector.destroy();
    finish(50);
    const outcome: import('../../models/bulk-action/bulk-action.interface').BulkOutcome =
      await pending;
    expect(api['bulk']).toHaveBeenCalledTimes(1);
    expect(outcome.done).toEqual(selection.slice(0, 50));
    expect(outcome.notSent).toEqual(selection.slice(50));
  });

  it('does not retry an uncertain chunk after the store is destroyed', async () => {
    const injector: EnvironmentInjector = createEnvironmentInjector(
      [ListPageStore],
      TestBed.inject(EnvironmentInjector),
    );
    const scoped: InstanceType<typeof ListPageStore> = injector.get(ListPageStore);
    let reject: (reason: unknown) => void = () => undefined;
    api['bulk'].mockReturnValueOnce(
      new Promise<number>((_resolve, fail) => {
        reject = fail;
      }),
    );
    const selection: { taskKey: string }[] = Array.from({ length: 75 }, (_, index: number) => ({
      taskKey: `CAD-${String(index)}`,
    }));
    const pending: Promise<import('../../models/bulk-action/bulk-action.interface').BulkOutcome> =
      scoped.bulk(selection, { type: 'done' });
    injector.destroy();
    reject(new HttpErrorResponse({ status: 0 }));
    const outcome: import('../../models/bulk-action/bulk-action.interface').BulkOutcome =
      await pending;
    expect(api['bulk']).toHaveBeenCalledTimes(1);
    expect(outcome.unknown).toEqual(selection.slice(0, 50));
    expect(outcome.notSent).toEqual(selection.slice(50));
  });

  it('reports the list writes', async () => {
    await loaded();
    api['archive'].mockResolvedValueOnce(undefined);
    api['remove'].mockRejectedValueOnce(new Error('access.role-insufficient'));
    api['duplicate'].mockResolvedValueOnce({ list: { ...sprint14, id: 'l-copy' }, taskCount: 98 });
    api['exportCsv'].mockResolvedValueOnce({ fileName: 'sprint-14.csv', content: 'a\nb' });

    expect(await store.archive()).toBe(true);
    expect(await store.remove()).toBe(false);
    expect((await store.duplicate())?.taskCount).toBe(98);
    expect((await store.exportCsv({ level: 'roots', sort: 'manual' }))?.fileName).toBe(
      'sprint-14.csv',
    );
    expect(api['exportCsv']).toHaveBeenCalledWith(sprint14, { level: 'roots', sort: 'manual' });
  });
});
