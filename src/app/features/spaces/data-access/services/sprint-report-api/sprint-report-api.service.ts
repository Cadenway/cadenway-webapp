import { inject, Service } from '@angular/core';
import {
  ListsService,
  type SprintBurndownDay as SprintBurndownDayDto,
  type SprintReport as SprintReportDto,
} from '@cadenway/api-client';

import type { SprintReport } from '../../../models/sprint-report/sprint-report.interface';
import { toSprintReport } from '../../adapters/sprint-report/sprint-report.adapter';
import { abortableRead } from '../../utils/abortable-read/abortable-read.util';

/**
 * Constant PAGE_LIMIT
 *
 * @description
 * Burndown days asked of the gateway per page: its maximum, so a sprint of up to 100 days is one
 * request.
 *
 * @type {number}
 */
const PAGE_LIMIT: number = 100;

/**
 * Constant MAX_PAGES
 *
 * @description
 * Pages read at most for one report (a year and more of days): a cursor that never ends cannot
 * keep the dialog reading.
 *
 * @type {number}
 */
const MAX_PAGES: number = 10;

/**
 * Service SprintReportApi
 *
 * @description
 * Reads the report of a sprint (`getSprintReport`): its points, every day of its burndown and the
 * velocity of the earlier sprints of its space, observed on the caller's day in the caller's time
 * zone. The burndown is paged; the service reads every page and joins the days. Each read bypasses
 * the HTTP cache, since the figures move with every task change. A failed page fails the read.
 */
@Service()
export class SprintReportApi {
  // #region Properties
  /**
   * Property lists
   *
   * @description
   * Generated list operations.
   *
   * @type {ListsService}
   * @readonly
   */
  private readonly lists: ListsService = inject(ListsService);
  // #endregion

  // #region Methods
  /**
   * Method report
   *
   * @description
   * Reads the report of a sprint with every day of its burndown.
   *
   * @param {string} listId - The sprint.
   * @param {string} today - The caller's date, `YYYY-MM-DD`.
   * @param {string} timeZone - The caller's IANA time zone.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<SprintReport>} The report.
   */
  public async report(
    listId: string,
    today: string,
    timeZone: string,
    signal?: AbortSignal,
  ): Promise<SprintReport> {
    const first: SprintReportDto = await abortableRead(
      this.lists.getSprintReport(
        listId,
        { today, timeZone, limit: PAGE_LIMIT },
        { cache: 'no-store' },
      ),
      signal,
    );
    const days: SprintBurndownDayDto[] = [...first.items];
    let cursor: string | null = first.nextCursor;
    for (let page: number = 1; cursor !== null && page < MAX_PAGES; page += 1) {
      const next: SprintReportDto = await abortableRead(
        this.lists.getSprintReport(
          listId,
          { today, timeZone, cursor, limit: PAGE_LIMIT },
          { cache: 'no-store' },
        ),
        signal,
      );
      days.push(...next.items);
      cursor = next.nextCursor;
    }
    return toSprintReport(first, days);
  }
  // #endregion
}
