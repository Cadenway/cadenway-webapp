import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { TaskQueriesService, TasksService, type TaskGroupPage } from '@cadenway/api-client';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { UnavailableRouteError } from '@shared/route-errors';

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
});
