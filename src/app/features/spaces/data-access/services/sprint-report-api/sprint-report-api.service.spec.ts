import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ListsService, type SprintReport as SprintReportDto } from '@cadenway/api-client';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { SprintReport } from '../../../models/sprint-report/sprint-report.interface';
import { SprintReportApi, SprintReportIncompleteError } from './sprint-report-api.service';

/**
 * Function page
 *
 * @description
 * A page of the mockup's `Sprint 14` report holding the given days.
 *
 * @param {readonly string[]} dates - Days of the page.
 * @param {string | null} nextCursor - Cursor of the next page.
 * @returns {SprintReportDto} The page.
 */
function page(dates: readonly string[], nextCursor: string | null): SprintReportDto {
  return {
    listId: 'l-sprint14',
    name: 'Sprint 14',
    startDate: '2026-11-03',
    endDate: '2026-11-17',
    observedAt: '2026-11-08T18:00:00Z',
    coverageStartedAt: null,
    openingPoints: 42,
    delivered: { points: 15, taskCount: 6, items: [] },
    remaining: { points: 27, taskCount: 9, items: [] },
    projectedRemainingPoints: 4,
    items: dates.map((date: string) => ({
      date,
      actualRemainingPoints: null,
      idealRemainingPoints: 42,
      projectedRemainingPoints: null,
    })),
    nextCursor,
    velocity: [],
  };
}

describe('SprintReportApi', () => {
  let getSprintReport: Mock;
  let api: SprintReportApi;

  beforeEach(() => {
    getSprintReport = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: ListsService, useValue: { getSprintReport } }],
    });
    api = TestBed.inject(SprintReportApi);
  });

  it('reads every page of the burndown with the caller day and time zone, bypassing the cache', async () => {
    getSprintReport
      .mockReturnValueOnce(of(page(['2026-11-03', '2026-11-04'], 'c-2')))
      .mockReturnValueOnce(of(page(['2026-11-05'], null)));

    const report: SprintReport = await api.report('l-sprint14', '2026-11-08', 'Europe/Paris');

    expect(getSprintReport).toHaveBeenNthCalledWith(
      1,
      'l-sprint14',
      { today: '2026-11-08', timeZone: 'Europe/Paris', limit: 100 },
      { cache: 'no-store' },
    );
    expect(getSprintReport).toHaveBeenNthCalledWith(
      2,
      'l-sprint14',
      { today: '2026-11-08', timeZone: 'Europe/Paris', cursor: 'c-2', limit: 100 },
      { cache: 'no-store' },
    );
    expect(report.days.map((day: { date: string }) => day.date)).toEqual([
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
    ]);
    expect(report.projected).toBe(4);
  });

  it('fails the read when a page fails', async () => {
    getSprintReport
      .mockReturnValueOnce(of(page(['2026-11-03'], 'c-2')))
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })));

    await expect(api.report('l-sprint14', '2026-11-08', 'Europe/Paris')).rejects.toBeInstanceOf(
      HttpErrorResponse,
    );
  });

  it('fails rather than return a burndown cut short by a repeated cursor', async () => {
    getSprintReport
      .mockReturnValueOnce(of(page(['2026-11-03'], 'c-2')))
      .mockReturnValueOnce(of(page(['2026-11-04'], 'c-2')));

    await expect(api.report('l-sprint14', '2026-11-08', 'Europe/Paris')).rejects.toBeInstanceOf(
      SprintReportIncompleteError,
    );
    expect(getSprintReport).toHaveBeenCalledTimes(2);
  });

  it('fails rather than return a burndown cut short at the page limit', async () => {
    let read: number = 0;
    getSprintReport.mockImplementation(() => {
      read += 1;
      return of(page([`day-${String(read)}`], `c-${String(read + 1)}`));
    });

    await expect(api.report('l-sprint14', '2026-11-08', 'Europe/Paris')).rejects.toBeInstanceOf(
      SprintReportIncompleteError,
    );
    expect(getSprintReport).toHaveBeenCalledTimes(10);
  });
});
