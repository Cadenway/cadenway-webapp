import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  TaskQueriesService,
  TasksService,
  type TaskGroupPage,
  type TaskSummary as TaskSummaryDto,
} from '@cadenway/api-client';
import { CwToastService } from '@cadenway/ui/components/toast';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';
import { TaskStatusChangesStore } from '@features/task';
import { UnavailableRouteError } from '@shared/route-errors';

import type { ListTaskPage, TaskGroupCount } from '../../../models/list-rows/list-rows.interface';
import type { ListTaskQuery } from '../../../models/list-view-config/list-view-config.interface';
import { ListRowsStore } from '../../../state/list-rows/list-rows.store';
import { ListTasksApi, type TaskReadBack } from './list-tasks-api.service';

/**
 * Constant query
 *
 * @description
 * The default query of the `List` view.
 *
 * @type {ListTaskQuery}
 */
const query: ListTaskQuery = { level: 'roots', sort: 'manual' };

/**
 * Function task
 *
 * @description
 * A task summary returned by the gateway for a list query.
 *
 * @param {string} key - Task key.
 * @param {readonly string[]} assignees - Assigned user ids.
 * @returns {TaskSummaryDto} The gateway summary.
 */
function task(key: string, assignees: readonly string[]): TaskSummaryDto {
  return {
    key,
    name: key,
    status: 'todo',
    cancelReason: null,
    priority: 'haute',
    assignees: assignees.map((userId: string) => ({ userId })),
    dueDate: null,
    startDate: null,
    estimateMinutes: null,
    labels: ['Auth'],
    parentKey: null,
    listId: 'sprint-14',
    spaceId: 'product',
    subtaskCounts: { total: 0, closed: 0 },
    checklistCounts: { total: 0, done: 0 },
    completedAt: null,
    createdAt: '2026-11-03T09:00:00Z',
    version: 1,
  };
}

describe('ListTasksApi', () => {
  let countTaskGroups: Mock;
  let queryListTasks: Mock;
  let listSubtasks: Mock;
  let updateTask: Mock;
  let getTask: Mock;
  let api: ListTasksApi;

  beforeEach(() => {
    countTaskGroups = vi.fn();
    queryListTasks = vi.fn();
    listSubtasks = vi.fn(() => of({ items: [], nextCursor: null, total: 0 }));
    updateTask = vi.fn(() => of({ ...task('CAD-482', []), version: 5 }));
    getTask = vi.fn(() =>
      of({
        ...task('CAD-482', ['u-camille']),
        name: 'Sign-in',
        estimateMinutes: 90,
        customFieldValues: { 'cf-points': 3 },
        version: 6,
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: TaskQueriesService, useValue: { countTaskGroups, queryListTasks } },
        { provide: TasksService, useValue: { listSubtasks, updateTask, getTask } },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: { user: () => ({ id: 'a' }), organization: () => ({ id: 'org-a' }) },
        },
        {
          provide: CwToastService,
          useValue: { show: vi.fn(), error: vi.fn(), warning: vi.fn(), dismiss: vi.fn() },
        },
        TaskStatusChangesStore,
        ListRowsStore,
      ],
    });
    api = TestBed.inject(ListTasksApi);
  });

  it('reads every page of groups without the HTTP cache', async () => {
    const pages: TaskGroupPage[] = [
      { groupBy: 'status', items: [{ value: 'todo', count: 4 }], nextCursor: 'g2', total: 6 },
      { groupBy: 'status', items: [{ value: 'done', count: 2 }], nextCursor: null, total: 6 },
    ];
    countTaskGroups.mockReturnValueOnce(of(pages[0])).mockReturnValueOnce(of(pages[1]));

    await expect(
      api.groups('sprint-14', { groupBy: 'status', query: { ...query, search: 'SSO' } }),
    ).resolves.toEqual([
      { value: 'todo', count: 4 },
      { value: 'done', count: 2 },
    ]);
    expect(countTaskGroups).toHaveBeenLastCalledWith(
      'sprint-14',
      { groupBy: 'status', search: 'SSO', level: 'roots', cursor: 'g2', limit: 100 },
      { cache: 'no-store' },
    );
  });

  it('reads a page of a group and maps a failure to the typed route error', async () => {
    queryListTasks.mockReturnValueOnce(of({ items: [], nextCursor: null, total: 0 }));
    await api.page('sprint-14', query, { groupBy: 'status', value: 'todo' }, null, 50);
    expect(queryListTasks).toHaveBeenCalledWith(
      'sprint-14',
      { status: ['todo'], level: 'roots', sort: 'manual', limit: 50 },
      { cache: 'no-store' },
    );

    queryListTasks.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 503,
            error: { status: 503, code: 'service.unavailable' },
          }),
      ),
    );
    await expect(api.page('sprint-14', query, null, null, 50)).rejects.toBeInstanceOf(
      UnavailableRouteError,
    );
  });

  it('keeps the tasks due within a window, both dates included', async () => {
    queryListTasks.mockReturnValueOnce(of({ items: [], nextCursor: null, total: 0 }));
    await api.page('sprint-14', query, null, null, 100, undefined, {
      from: '2026-10-26',
      to: '2026-12-06',
    });
    expect(queryListTasks).toHaveBeenCalledWith(
      'sprint-14',
      {
        dueFrom: '2026-10-26',
        dueTo: '2026-12-06',
        level: 'roots',
        sort: 'manual',
        limit: 100,
      },
      { cache: 'no-store' },
    );
  });

  it('writes only the given fields against the shown version and returns the saved one', async () => {
    await expect(
      api.update('CAD-482', 4, { dueDate: '2026-11-27', startDate: null }),
    ).resolves.toEqual({ kind: 'done', version: 5 });
    expect(updateTask).toHaveBeenCalledWith(
      'CAD-482',
      { dueDate: '2026-11-27', startDate: null },
      { headers: { 'If-Match': '"4"' } },
    );
  });

  it('tells a stale refusal from another refusal and from an uncertain outcome', async () => {
    updateTask.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 412, error: { code: 'task.version' } })),
    );
    await expect(api.update('CAD-482', 4, { name: 'Sign-in' })).resolves.toEqual({
      kind: 'refused',
      stale: true,
    });
    updateTask.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 412,
            error: { status: 412, code: 'organization.context-changed' },
          }),
      ),
    );
    await expect(api.update('CAD-482', 4, { name: 'Sign-in' })).resolves.toEqual({
      kind: 'refused',
      stale: false,
    });
    updateTask.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { status: 422, code: 'task.start-date-invalid' },
          }),
      ),
    );
    await expect(api.update('CAD-482', 4, { dueDate: '2026-11-01' })).resolves.toEqual({
      kind: 'refused',
      stale: false,
    });
    updateTask.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
    await expect(api.update('CAD-482', 4, { name: 'Sign-in' })).resolves.toEqual({
      kind: 'unknown',
    });
    updateTask.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })));
    await expect(api.update('CAD-482', 4, { estimateMinutes: 90 })).resolves.toEqual({
      kind: 'unknown',
    });
  });

  it('reads one task back without the HTTP cache, and null when it cannot', async () => {
    const read: TaskReadBack | null = await api.readBack('CAD-482');
    expect(read?.task).toMatchObject({
      key: 'CAD-482',
      name: 'Sign-in',
      assigneeIds: ['u-camille'],
      version: 6,
    });
    expect(read?.estimateMinutes).toBe(90);
    expect(read?.customFieldValues).toEqual({ 'cf-points': 3 });
    expect(getTask).toHaveBeenCalledWith('CAD-482', { cache: 'no-store' });

    getTask.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 404 })));
    await expect(api.readBack('CAD-482')).resolves.toBeNull();
    getTask.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
    await expect(api.readBack('CAD-482')).resolves.toBeNull();
  });

  it('reads the subtasks of a task', async () => {
    await expect(api.subtasks('CAD-482')).resolves.toEqual([]);
    expect(listSubtasks).toHaveBeenCalledWith('CAD-482', { limit: 100 }, { cache: 'no-store' });
  });

  it('shows only filtered assignee groups and makes a single read for the allowed group', async () => {
    const aOnly: TaskSummaryDto = task('CAD-A', ['a']);
    const bOnly: TaskSummaryDto = task('CAD-B', ['b']);
    const both: TaskSummaryDto = task('CAD-AB', ['a', 'b']);
    const dataset: readonly TaskSummaryDto[] = [aOnly, bOnly, both];
    const sparseGroups: { value: string; count: number }[] = Array.from(
      { length: 80 },
      (_: unknown, index: number) => ({ value: `other-${String(index)}`, count: 1 }),
    );
    countTaskGroups.mockReturnValueOnce(
      of({
        groupBy: 'assignee',
        items: [{ value: 'a', count: 2 }, { value: 'b', count: 1 }, ...sparseGroups],
        nextCursor: null,
        total: 2,
      }),
    );
    queryListTasks.mockImplementation(
      (_list: string, body: { assignee: string[]; cursor?: string }) => {
        const filtered: readonly TaskSummaryDto[] = dataset.filter((item: TaskSummaryDto) =>
          item.assignees.some((assignee) => body.assignee.includes(assignee.userId)),
        );
        const index: number = body.cursor ? Number(body.cursor) : 0;
        return of({
          items: filtered.slice(index, index + 50),
          nextCursor: index + 50 < filtered.length ? String(index + 50) : null,
          total: filtered.length,
        });
      },
    );
    const filtered: ListTaskQuery = { ...query, assignee: ['a'] };
    const groups: readonly TaskGroupCount[] = await api.groups('sprint-14', {
      groupBy: 'assignee',
      query: filtered,
    });
    const firstA: ListTaskPage = await api.page(
      'sprint-14',
      filtered,
      { groupBy: 'assignee', value: 'a' },
      null,
      50,
    );
    const groupB: ListTaskPage = await api.page(
      'sprint-14',
      filtered,
      { groupBy: 'assignee', value: 'b' },
      null,
      50,
    );

    expect(groups).toEqual([{ value: 'a', count: 2 }]);
    expect(firstA.items.map((item) => item.key)).toEqual(['CAD-A', 'CAD-AB']);
    expect(groupB.items).toEqual([]);
    expect(queryListTasks).toHaveBeenCalledTimes(1);
    expect(countTaskGroups).toHaveBeenCalledTimes(1);
    expect(queryListTasks).toHaveBeenCalledWith(
      'sprint-14',
      { assignee: ['a'], level: 'roots', sort: 'manual', limit: 50 },
      { cache: 'no-store' },
    );
    expect(groupB.nextCursor).toBeNull();
  });

  it('resolves me and none when selecting assignee groups', async () => {
    countTaskGroups.mockReturnValue(
      of({
        groupBy: 'assignee',
        items: [
          { value: 'a', count: 1 },
          { value: 'b', count: 1 },
          { value: 'none', count: 1 },
        ],
        nextCursor: null,
        total: 3,
      }),
    );
    const filtered: ListTaskQuery = { ...query, assignee: ['me', 'none'] };
    await expect(
      api.groups('sprint-14', { groupBy: 'assignee', query: filtered }),
    ).resolves.toEqual([
      { value: 'a', count: 1 },
      { value: 'none', count: 1 },
    ]);
    queryListTasks.mockReturnValue(
      of({ items: [task('CAD-A', ['a'])], nextCursor: null, total: 1 }),
    );
    await api.page('sprint-14', filtered, { groupBy: 'assignee', value: 'a' }, null, 50);
    expect(queryListTasks).toHaveBeenCalledWith(
      'sprint-14',
      { assignee: ['a'], level: 'roots', sort: 'manual', limit: 50 },
      { cache: 'no-store' },
    );
  });

  it('renders the filtered assignee group without querying sparse groups', async () => {
    const items: readonly TaskSummaryDto[] = [
      task('CAD-A', ['a']),
      task('CAD-B', ['b']),
      task('CAD-AB', ['a', 'b']),
    ];
    const sparse: { value: string; count: number }[] = Array.from(
      { length: 80 },
      (_: unknown, index: number) => ({ value: `other-${String(index)}`, count: 1 }),
    );
    countTaskGroups.mockReturnValue(
      of({
        groupBy: 'assignee',
        items: [{ value: 'a', count: 2 }, { value: 'b', count: 1 }, ...sparse],
        nextCursor: null,
        total: 2,
      }),
    );
    queryListTasks.mockImplementation((_list: string, body: { assignee: string[] }) =>
      of({
        items: items.filter((item: TaskSummaryDto) =>
          item.assignees.some((person) => body.assignee.includes(person.userId)),
        ),
        nextCursor: null,
        total: 2,
      }),
    );
    const store: InstanceType<typeof ListRowsStore> = TestBed.inject(ListRowsStore);
    const filtered: ListTaskQuery = { ...query, assignee: ['a'] };
    store.load({
      listId: 'sprint-14',
      query: filtered,
      groupQuery: { groupBy: 'assignee', query: filtered },
    });
    await vi.waitFor(() => {
      TestBed.tick();
      expect(store.rows().map((row) => row.id)).toEqual(['a/CAD-A', 'a/CAD-AB']);
    });
    expect(store.groupOrder()).toEqual(['a']);
    expect(countTaskGroups).toHaveBeenCalledTimes(1);
    expect(queryListTasks).toHaveBeenCalledTimes(1);
    store.reload();
    await vi.waitFor(() => {
      TestBed.tick();
      expect(queryListTasks).toHaveBeenCalledTimes(2);
    });
    expect(countTaskGroups).toHaveBeenCalledTimes(2);
  });

  it.each([
    [
      'status',
      { ...query, status: ['todo'] },
      [
        { value: 'todo', count: 1 },
        { value: 'done', count: 0 },
      ],
    ],
    [
      'priority',
      { ...query, priority: ['haute'] },
      [
        { value: 'haute', count: 1 },
        { value: 'basse', count: 0 },
      ],
    ],
  ] as const)('only retains filtered %s groups', async (groupBy, filtered, items) => {
    countTaskGroups.mockReturnValue(of({ groupBy, items, nextCursor: null, total: 1 }));
    await expect(api.groups('sprint-14', { groupBy, query: filtered })).resolves.toEqual([
      items[0],
    ]);
  });

  it('rejects status and priority groups outside the filter without reading tasks', async () => {
    const filtered: ListTaskQuery = {
      ...query,
      status: ['todo'],
      priority: ['haute'],
      label: ['Auth'],
    };
    queryListTasks.mockReturnValue(
      of({ items: [task('CAD-A', ['a'])], nextCursor: null, total: 1 }),
    );
    const status: ListTaskPage = await api.page(
      'sprint-14',
      filtered,
      { groupBy: 'status', value: 'done' },
      null,
      50,
    );
    const priority: ListTaskPage = await api.page(
      'sprint-14',
      filtered,
      { groupBy: 'priority', value: 'basse' },
      null,
      50,
    );

    expect(status.items).toEqual([]);
    expect(priority.items).toEqual([]);
    expect(queryListTasks).not.toHaveBeenCalled();
  });
});
