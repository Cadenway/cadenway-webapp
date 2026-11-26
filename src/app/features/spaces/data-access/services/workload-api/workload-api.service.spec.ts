import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  ListsService,
  type ListTimesheetPage,
  type ListWorkloadPage,
  TaskTimeService,
} from '@cadenway/api-client';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { isRouteError } from '@shared/route-errors';

import type { WorkloadSnapshot } from '../../../models/workload/workload.interface';
import { WorkloadApi } from './workload-api.service';

/**
 * Function workloadPage
 *
 * @description
 * A page of the Sprint 14 workload holding one allocation per task key.
 *
 * @param {readonly string[]} keys - Task keys of the page.
 * @param {string | null} nextCursor - Cursor of the next page.
 * @returns {ListWorkloadPage} The page.
 */
function workloadPage(keys: readonly string[], nextCursor: string | null): ListWorkloadPage {
  return {
    listId: 'sprint-14',
    weekStart: '2026-11-23',
    days: [{ date: '2026-11-23', totalMinutes: 120, dailyCapacityMinutes: 360 }],
    totalMinutes: 120,
    items: keys.map((taskKey: string) => ({
      assignee: { userId: 'u-camille' },
      taskKey,
      name: taskKey,
      status: 'todo',
      minutesByDay: [60],
      totalMinutes: 60,
    })),
    nextCursor,
  };
}

/**
 * Function timesheetPage
 *
 * @description
 * A page of a Sprint 14 timesheet where Camille recorded minutes.
 *
 * @param {number} minutes - Minutes recorded.
 * @param {string | null} nextCursor - Cursor of the next page.
 * @returns {ListTimesheetPage} The page.
 */
function timesheetPage(minutes: number, nextCursor: string | null): ListTimesheetPage {
  return {
    listId: 'sprint-14',
    weekStart: '2026-11-23',
    days: [],
    totalMinutes: minutes,
    items: [
      {
        author: { userId: 'u-camille' },
        taskKey: 'CAD-482',
        name: 'Redesign the SSO sign-in screen',
        status: 'progress',
        minutesByDay: [minutes, 0, 0, 0, 0, 0, 0],
        totalMinutes: minutes,
      },
    ],
    nextCursor,
  };
}

describe('WorkloadApi', () => {
  let queryGetListWorkload: Mock;
  let getListTimesheet: Mock;
  let api: WorkloadApi;

  beforeEach(() => {
    queryGetListWorkload = vi.fn();
    getListTimesheet = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: ListsService, useValue: { queryGetListWorkload } },
        { provide: TaskTimeService, useValue: { getListTimesheet } },
      ],
    });
    api = TestBed.inject(WorkloadApi);
  });

  it('reads every page of the window with the view filters, bypassing the cache', async () => {
    queryGetListWorkload
      .mockReturnValueOnce(of(workloadPage(['CAD-482'], 'c-2')))
      .mockReturnValueOnce(of(workloadPage(['CAD-483'], null)));

    const snapshot: Omit<WorkloadSnapshot, 'key'> = await api.workload(
      'sprint-14',
      { status: ['todo'], level: 'roots', sort: 'manual' },
      '2026-11-23',
    );

    expect(snapshot.items.map((item) => item.taskKey)).toEqual(['CAD-482', 'CAD-483']);
    expect(snapshot.days).toEqual([
      { date: '2026-11-23', totalMinutes: 120, capacityMinutes: 360 },
    ]);
    expect(queryGetListWorkload).toHaveBeenNthCalledWith(
      1,
      'sprint-14',
      { weekStart: '2026-11-23', status: ['todo'], level: 'roots', limit: 100 },
      { cache: 'no-store' },
    );
    expect(queryGetListWorkload).toHaveBeenNthCalledWith(
      2,
      'sprint-14',
      { weekStart: '2026-11-23', status: ['todo'], level: 'roots', cursor: 'c-2', limit: 100 },
      { cache: 'no-store' },
    );
  });

  it('fails rather than read a cursor it was already given', async () => {
    queryGetListWorkload
      .mockReturnValueOnce(of(workloadPage(['CAD-482'], 'c-2')))
      .mockReturnValueOnce(of(workloadPage(['CAD-483'], 'c-2')));

    await expect(
      api.workload('sprint-14', { level: 'roots', sort: 'manual' }, '2026-11-23'),
    ).rejects.toThrow('The workload could not be read to its end.');
    expect(queryGetListWorkload).toHaveBeenCalledTimes(2);
  });

  it('rejects a missing list with the typed route error', async () => {
    queryGetListWorkload.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 404,
            error: { status: 404, code: 'list.not-found', title: 'Not found' },
          }),
      ),
    );

    const error: unknown = await api
      .workload('sprint-14', { level: 'roots', sort: 'manual' }, '2026-11-23')
      .catch((caught: unknown) => caught);

    expect(error instanceof Error && isRouteError(error)).toBe(true);
  });

  it('sums the minutes each person recorded over the two weeks, every page read', async () => {
    getListTimesheet.mockImplementation(
      (_listId: string, params: { weekStart: string; cursor?: string }) =>
        of(
          params.weekStart === '2026-11-23'
            ? params.cursor
              ? timesheetPage(30, null)
              : timesheetPage(60, 't-2')
            : timesheetPage(15, null),
        ),
    );

    const spent: Readonly<Record<string, number>> = await api.spent('sprint-14', '2026-11-23');

    expect(spent).toEqual({ 'u-camille': 105 });
    expect(getListTimesheet).toHaveBeenCalledWith(
      'sprint-14',
      { weekStart: '2026-11-30', limit: 100 },
      { cache: 'no-store' },
    );
    expect(getListTimesheet).toHaveBeenCalledWith(
      'sprint-14',
      { weekStart: '2026-11-23', limit: 100, cursor: 't-2' },
      { cache: 'no-store' },
    );
  });
});
