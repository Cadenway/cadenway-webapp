import { inject, Service } from '@angular/core';
import {
  type ListTimesheetPage,
  type TaskTimeSummary,
  TaskTimeService,
} from '@cadenway/api-client';

import type { ListTimesheet } from '../../../models/timesheet/timesheet.interface';
import { toListTimesheet } from '../../adapters/timesheet/timesheet.adapter';
import { toRouteError } from '../../adapters/route-error/route-error.adapter';
import { abortableRead } from '../../utils/abortable-read/abortable-read.util';

/**
 * Constant TIMESHEET_PAGE_LIMIT
 *
 * @description
 * Rows per `getListTimesheet` page, the contract's largest.
 *
 * @type {number}
 */
const TIMESHEET_PAGE_LIMIT: number = 100;

/**
 * Constant ESTIMATE_READS
 *
 * @description
 * `getTaskTimeSummary` reads in flight at once, as the other per-item reads of the feature.
 *
 * @type {number}
 */
const ESTIMATE_READS: number = 4;

/**
 * Service TimesheetApi
 *
 * @description
 * The reads of the `Timesheet` view: one week of the list's recorded time (`getListTimesheet`,
 * read to its last page) and the estimates of the tasks it names (`getTaskTimeSummary`, four at a
 * time), since timesheet rows carry no estimate (gap G7). Every read bypasses the HTTP cache, so a
 * refresh after the task detail closes reads the gateway again.
 */
@Service()
export class TimesheetApi {
  // #region Properties
  /**
   * Property time
   *
   * @description
   * Generated time operations.
   *
   * @type {TaskTimeService}
   * @readonly
   */
  private readonly time: TaskTimeService = inject(TaskTimeService);
  // #endregion

  // #region Methods
  /**
   * Method week
   *
   * @description
   * Reads the time recorded on the list's tasks over the week starting on `weekStart`, every page.
   *
   * @param {string} listId - The list.
   * @param {string} weekStart - Monday of the week, `YYYY-MM-DD`.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<ListTimesheet>} The week.
   * @throws {Error} The typed route error of the failure.
   */
  public async week(
    listId: string,
    weekStart: string,
    signal?: AbortSignal,
  ): Promise<ListTimesheet> {
    try {
      const pages: ListTimesheetPage[] = [];
      let cursor: string | null = null;
      do {
        const page: ListTimesheetPage = await abortableRead(
          this.time.getListTimesheet(
            listId,
            { weekStart, limit: TIMESHEET_PAGE_LIMIT, ...(cursor === null ? {} : { cursor }) },
            { cache: 'no-store' },
          ),
          signal,
        );
        pages.push(page);
        cursor = page.nextCursor;
      } while (cursor !== null);
      return toListTimesheet(pages);
    } catch (error: unknown) {
      throw toRouteError(error, 'list', listId);
    }
  }

  /**
   * Method estimates
   *
   * @description
   * Reads the estimate of each task, four at a time. A task without an estimate (or with a zero
   * one) maps to null.
   *
   * @param {readonly string[]} taskKeys - Keys of the tasks.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<ReadonlyMap<string, number | null>>} Estimated minutes by task key.
   * @throws {Error} The failure of the first read that failed.
   */
  public async estimates(
    taskKeys: readonly string[],
    signal?: AbortSignal,
  ): Promise<ReadonlyMap<string, number | null>> {
    const estimates: Map<string, number | null> = new Map<string, number | null>();
    const queue: string[] = [...taskKeys];
    const worker: () => Promise<void> = async (): Promise<void> => {
      for (let key: string | undefined = queue.shift(); key !== undefined; key = queue.shift()) {
        try {
          const summary: TaskTimeSummary = await abortableRead(
            this.time.getTaskTimeSummary(key, { cache: 'no-store' }),
            signal,
          );
          estimates.set(key, summary.estimateMinutes ?? null);
        } catch (error: unknown) {
          queue.length = 0;
          throw error;
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(ESTIMATE_READS, queue.length) }, () => worker()),
    );
    return estimates;
  }
  // #endregion
}
