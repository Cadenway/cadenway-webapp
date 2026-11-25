import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  TaskQueriesService,
  TasksService,
  type TaskGroupPage,
  type TaskSummary as TaskSummaryDto,
} from '@cadenway/api-client';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { UnavailableRouteError } from '@shared/route-errors';

import type { ListTaskPage } from '../../../models/list-rows/list-rows.interface';
import type { ListTaskQuery } from '../../../models/list-view-config/list-view-config.interface';
import { ListTasksApi } from './list-tasks-api.service';

/**
 * Constant query
 *
 * @description
 * The default query of the « Liste » view.
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
    spaceId: 'produit',
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
  let api: ListTasksApi;

  beforeEach(() => {
    countTaskGroups = vi.fn();
    queryListTasks = vi.fn();
    listSubtasks = vi.fn(() => of({ items: [], nextCursor: null, total: 0 }));
    TestBed.configureTestingModule({
      providers: [
        { provide: TaskQueriesService, useValue: { countTaskGroups, queryListTasks } },
        { provide: TasksService, useValue: { listSubtasks } },
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

  it('reads the subtasks of a task', async () => {
    await expect(api.subtasks('CAD-482')).resolves.toEqual([]);
    expect(listSubtasks).toHaveBeenCalledWith('CAD-482', { limit: 100 }, { cache: 'no-store' });
  });

  it('preserves the assignee filter and scans pages for each overlapping group', async () => {
    const aOnly: TaskSummaryDto = task('CAD-A', ['a']);
    const bOnly: TaskSummaryDto = task('CAD-B', ['b']);
    const both: TaskSummaryDto = task('CAD-AB', ['a', 'b']);
    const dataset: readonly TaskSummaryDto[] = [aOnly, bOnly, both];
    queryListTasks.mockImplementation(
      (_list: string, body: { assignee: string[]; cursor?: string }) => {
        const filtered: readonly TaskSummaryDto[] = dataset.filter((item: TaskSummaryDto) =>
          item.assignees.some((assignee) => body.assignee.includes(assignee.userId)),
        );
        const index: number = body.cursor ? Number(body.cursor) : 0;
        return of({
          items: filtered.slice(index, index + 1),
          nextCursor: index + 1 < filtered.length ? String(index + 1) : null,
          total: filtered.length,
        });
      },
    );
    const filtered: ListTaskQuery = { ...query, assignee: ['a'] };
    const firstA: ListTaskPage = await api.page(
      'sprint-14',
      filtered,
      { groupBy: 'assignee', value: 'a' },
      null,
      1,
    );
    const nextA: ListTaskPage = await api.page(
      'sprint-14',
      filtered,
      { groupBy: 'assignee', value: 'a' },
      firstA.nextCursor,
      1,
    );
    const groupB: ListTaskPage = await api.page(
      'sprint-14',
      filtered,
      { groupBy: 'assignee', value: 'b' },
      null,
      1,
    );

    expect([...firstA.items, ...nextA.items].map((item) => item.key)).toEqual(['CAD-A', 'CAD-AB']);
    expect(groupB.items.map((item) => item.key)).toEqual(['CAD-AB']);
    expect(
      queryListTasks.mock.calls.every(
        (call: unknown[]) => (call[1] as { assignee: string[] }).assignee.join(',') === 'a',
      ),
    ).toBe(true);
    expect(groupB.nextCursor).toBeNull();
  });

  it('preserves status, priority and label filters while checking group membership', async () => {
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
    expect(queryListTasks).toHaveBeenCalledTimes(2);
    expect(queryListTasks).toHaveBeenLastCalledWith(
      'sprint-14',
      {
        status: ['todo'],
        priority: ['haute'],
        label: ['Auth'],
        level: 'roots',
        sort: 'manual',
        limit: 50,
      },
      { cache: 'no-store' },
    );
  });
});
