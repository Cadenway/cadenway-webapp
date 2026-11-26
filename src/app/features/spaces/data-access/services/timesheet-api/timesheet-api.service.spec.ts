import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  type ListTimesheetPage,
  type TaskTimeSummary,
  TaskTimeService,
} from '@cadenway/api-client';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { UnavailableRouteError } from '@shared/route-errors';

import type { ListTimesheet } from '../../../models/timesheet/timesheet.interface';
import { TimesheetApi } from './timesheet-api.service';

/**
 * Function page
 *
 * @description
 * A timesheet page of Sprint 14 holding one task of Camille Martin.
 *
 * @param {string} taskKey - Key of the task of the page.
 * @param {string | null} nextCursor - Cursor of the next page.
 * @returns {ListTimesheetPage} The page.
 */
function page(taskKey: string, nextCursor: string | null): ListTimesheetPage {
  return {
    listId: 'l-sprint14',
    weekStart: '2026-11-02',
    days: Array.from({ length: 7 }, (_: unknown, day: number) => ({
      date: `2026-11-0${String(day + 2)}`,
      totalMinutes: 0,
    })),
    totalMinutes: 195,
    items: [
      {
        author: { userId: 'u-cm' },
        taskKey,
        name: taskKey,
        status: 'progress',
        minutesByDay: [0, 0, 0, 0, 0, 150, 45],
        totalMinutes: 195,
      },
    ],
    nextCursor,
  };
}

describe('TimesheetApi', () => {
  let time: Record<string, Mock>;
  let api: TimesheetApi;

  beforeEach(() => {
    time = { getListTimesheet: vi.fn(), getTaskTimeSummary: vi.fn() };
    TestBed.configureTestingModule({
      providers: [TimesheetApi, { provide: TaskTimeService, useValue: time }],
    });
    api = TestBed.inject(TimesheetApi);
  });

  it('reads a week to its last page, bypassing the HTTP cache', async () => {
    time['getListTimesheet']
      .mockReturnValueOnce(of(page('CAD-482', 'c2')))
      .mockReturnValueOnce(of(page('CAD-479', null)));

    const sheet: ListTimesheet = await api.week('l-sprint14', '2026-11-02');

    expect(sheet.entries.map((entry) => entry.taskKey)).toEqual(['CAD-482', 'CAD-479']);
    expect(time['getListTimesheet']).toHaveBeenNthCalledWith(
      1,
      'l-sprint14',
      { weekStart: '2026-11-02', limit: 100 },
      { cache: 'no-store' },
    );
    expect(time['getListTimesheet']).toHaveBeenNthCalledWith(
      2,
      'l-sprint14',
      { weekStart: '2026-11-02', limit: 100, cursor: 'c2' },
      { cache: 'no-store' },
    );
  });

  it('rejects a failed week with the typed route error', async () => {
    time['getListTimesheet'].mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 503, statusText: 'Unavailable' })),
    );

    await expect(api.week('l-sprint14', '2026-11-02')).rejects.toBeInstanceOf(
      UnavailableRouteError,
    );
  });

  it('reads the estimates four at a time, a missing one as null', async () => {
    const answers: Map<string, Subject<TaskTimeSummary>> = new Map<
      string,
      Subject<TaskTimeSummary>
    >();
    time['getTaskTimeSummary'].mockImplementation((key: string) => {
      const answer: Subject<TaskTimeSummary> = new Subject<TaskTimeSummary>();
      answers.set(key, answer);
      return answer;
    });
    const keys: readonly string[] = ['CAD-475', 'CAD-479', 'CAD-482', 'CAD-483', 'CAD-488'];

    const estimates: Promise<ReadonlyMap<string, number | null>> = api.estimates(keys);
    await Promise.resolve();
    expect(time['getTaskTimeSummary']).toHaveBeenCalledTimes(4);
    for (const key of keys.slice(0, 4)) {
      answers.get(key)?.next({ totalMinutes: 60, estimateMinutes: key === 'CAD-483' ? null : 480 });
    }
    await expect.poll(() => time['getTaskTimeSummary'].mock.calls.length).toBe(5);
    answers.get('CAD-488')?.next({ totalMinutes: 75, estimateMinutes: 240 });

    expect([...(await estimates)]).toEqual([
      ['CAD-475', 480],
      ['CAD-479', 480],
      ['CAD-482', 480],
      ['CAD-483', null],
      ['CAD-488', 240],
    ]);
    expect(time['getTaskTimeSummary']).toHaveBeenCalledWith('CAD-475', { cache: 'no-store' });
  });

  it('stops reading estimates after a failure', async () => {
    time['getTaskTimeSummary'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 503 })),
    );

    await expect(
      api.estimates(['CAD-475', 'CAD-479', 'CAD-482', 'CAD-483', 'CAD-488', 'CAD-490']),
    ).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(time['getTaskTimeSummary']).toHaveBeenCalledTimes(4);
  });
});
