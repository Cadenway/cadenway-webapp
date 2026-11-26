import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  ListsService,
  TaskQueriesService,
  TasksService,
  type TaskSummary as TaskSummaryDto,
  TaskTimeService,
} from '@cadenway/api-client';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import type { ListTaskPage } from '../../../models/list-rows/list-rows.interface';
import type { ListTaskQuery } from '../../../models/list-view-config/list-view-config.interface';
import type {
  SheetCustomField,
  SheetTaskFacts,
} from '../../../models/sheet-view/sheet-view.interface';
import { SheetTasksApi } from './sheet-tasks-api.service';

/**
 * Constant query
 *
 * @description
 * The default query of the views.
 *
 * @type {ListTaskQuery}
 */
const query: ListTaskQuery = { level: 'roots', sort: 'manual' };

/**
 * Function dto
 *
 * @description
 * A task of Sprint 14 as `queryListTasks` answers it.
 *
 * @param {string} key - Task key.
 * @param {Partial<TaskSummaryDto>} [changes] - Other members.
 * @returns {TaskSummaryDto} The task.
 */
function dto(key: string, changes: Partial<TaskSummaryDto> = {}): TaskSummaryDto {
  return {
    key,
    name: key,
    status: 'todo',
    cancelReason: null,
    priority: 'haute',
    assignees: [],
    dueDate: null,
    startDate: null,
    estimateMinutes: null,
    labels: [],
    parentKey: null,
    listId: 'sprint-14',
    spaceId: 'product',
    subtaskCounts: { total: 0, closed: 0 },
    checklistCounts: { total: 0, done: 0 },
    completedAt: null,
    createdAt: '2026-11-03T09:00:00Z',
    version: 4,
    ...changes,
  };
}

describe('SheetTasksApi', () => {
  let queryListTasks: Mock;
  let listListCustomFields: Mock;
  let getTaskTimeSummary: Mock;
  let api: SheetTasksApi;

  beforeEach(() => {
    queryListTasks = vi.fn(() =>
      of({
        items: [
          dto('CAD-482', {
            estimateMinutes: 240,
            customFieldValues: { 'f-points': 5, 'f-client': 'Studio Pivot' },
          }),
        ],
        nextCursor: null,
        total: 1,
      }),
    );
    listListCustomFields = vi.fn();
    getTaskTimeSummary = vi.fn(() => of({ totalMinutes: 290, estimateMinutes: 240 }));
    TestBed.configureTestingModule({
      providers: [
        SheetTasksApi,
        { provide: TaskQueriesService, useValue: { queryListTasks, countTaskGroups: vi.fn() } },
        { provide: TasksService, useValue: { listSubtasks: vi.fn(), updateTask: vi.fn() } },
        { provide: ListsService, useValue: { listListCustomFields } },
        { provide: TaskTimeService, useValue: { getTaskTimeSummary } },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: { organization: () => ({ id: 'org-atelier-nord' }), user: () => ({ id: 'u' }) },
        },
      ],
    });
    api = TestBed.inject(SheetTasksApi);
  });

  it('reads a page once and publishes the estimate and custom field values of its tasks', async () => {
    const published: (readonly SheetTaskFacts[])[] = [];
    api.facts.subscribe((facts: readonly SheetTaskFacts[]) => published.push(facts));

    const page: ListTaskPage = await api.page('sprint-14', query, null, null, 100);

    expect(queryListTasks).toHaveBeenCalledTimes(1);
    expect(queryListTasks).toHaveBeenCalledWith(
      'sprint-14',
      { level: 'roots', sort: 'manual', limit: 100 },
      { cache: 'no-store' },
    );
    expect(page.items.map((task) => task.key)).toEqual(['CAD-482']);
    expect(published).toEqual([
      [
        {
          key: 'CAD-482',
          version: 4,
          estimateMinutes: 240,
          customFieldValues: { 'f-points': 5, 'f-client': 'Studio Pivot' },
        },
      ],
    ]);
  });

  it('rejects a failed page with the typed route error and publishes nothing', async () => {
    queryListTasks.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 503, statusText: 'Unavailable' })),
    );
    const published: Mock = vi.fn();
    api.facts.subscribe(published);
    await expect(api.page('sprint-14', query, null, null, 100)).rejects.toBeInstanceOf(Error);
    expect(published).not.toHaveBeenCalled();
  });

  it('reads the custom fields to the last page in their position order', async () => {
    listListCustomFields
      .mockReturnValueOnce(
        of({
          items: [
            {
              id: 'f-client',
              spaceId: 'product',
              name: 'Client',
              type: 'text',
              position: 1,
              sprintPoints: false,
              version: 1,
            },
          ],
          nextCursor: 'next',
        }),
      )
      .mockReturnValueOnce(
        of({
          items: [
            {
              id: 'f-points',
              spaceId: 'product',
              name: 'Points',
              type: 'number',
              position: 0,
              sprintPoints: true,
              version: 2,
            },
            {
              id: 'f-due',
              spaceId: 'product',
              name: 'Review date',
              type: 'date',
              position: 2,
              sprintPoints: false,
              version: 1,
            },
          ],
          nextCursor: null,
        }),
      );

    const fields: readonly SheetCustomField[] = await api.customFields('sprint-14');

    expect(listListCustomFields).toHaveBeenLastCalledWith(
      'sprint-14',
      { limit: 100, cursor: 'next' },
      { cache: 'no-store' },
    );
    expect(fields).toEqual([
      { id: 'f-points', name: 'Points', type: 'number', position: 0, sprintPoints: true },
      { id: 'f-client', name: 'Client', type: 'text', position: 1, sprintPoints: false },
    ]);
  });

  it('reads the time spent on a task in minutes', async () => {
    await expect(api.spentMinutes('CAD-482')).resolves.toBe(290);
    expect(getTaskTimeSummary).toHaveBeenCalledWith('CAD-482', { cache: 'no-store' });
  });
});
