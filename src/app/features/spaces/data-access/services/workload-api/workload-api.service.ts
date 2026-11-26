import { inject, Service } from '@angular/core';
import {
  ListsService,
  type ListTimesheetPage,
  type ListWorkloadPage,
  TaskTimeService,
} from '@cadenway/api-client';

import type { ListTaskQuery } from '../../../models/list-view-config/list-view-config.interface';
import type {
  WorkloadItem,
  WorkloadSnapshot,
  WorkloadWindow,
} from '../../../models/workload/workload.interface';
import { toRouteError } from '../../adapters/route-error/route-error.adapter';
import {
  addSpentMinutes,
  toWorkloadQuery,
  toWorkloadWindow,
} from '../../adapters/workload/workload.adapter';
import { abortableRead } from '../../utils/abortable-read/abortable-read.util';

/**
 * Constant PAGE_LIMIT
 *
 * @description
 * Rows asked of the gateway per page: its maximum.
 *
 * @type {number}
 */
const PAGE_LIMIT: number = 100;

/**
 * Constant MAX_PAGES
 *
 * @description
 * Pages read at most for one window: 10,000 allocations, far past a list's two weeks, so a
 * cursor that never ends fails the read rather than keep the view reading.
 *
 * @type {number}
 */
const MAX_PAGES: number = 100;

/**
 * Service WorkloadApi
 *
 * @description
 * The reads of the `Workload` view: the allocations of the list's filtered tasks over two weeks
 * (`queryGetListWorkload`, every page joined), and the minutes each person recorded on the list
 * over the same two weeks (`getListTimesheet`, one read per week, every page joined). Every read
 * bypasses the HTTP cache, so a refresh reads the gateway again. A failed workload read rejects
 * with the typed route error of the list; a failed timesheet read rejects with its own error.
 */
@Service()
export class WorkloadApi {
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
   * Method workload
   *
   * @description
   * Reads the allocations of the two weeks starting on `weekStart`, with the view's filters, to
   * the last page. A cursor given twice, or still given after `MAX_PAGES` pages, fails the read.
   *
   * @param {string} listId - The list.
   * @param {ListTaskQuery} query - The view's query.
   * @param {string} weekStart - Monday of the first week.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<Omit<WorkloadSnapshot, 'key'>>} The window and every allocation.
   * @throws {Error} The typed route error of the failure.
   */
  public async workload(
    listId: string,
    query: ListTaskQuery,
    weekStart: string,
    signal?: AbortSignal,
  ): Promise<Omit<WorkloadSnapshot, 'key'>> {
    try {
      const read: (cursor: string | null) => Promise<WorkloadWindow> = async (
        cursor: string | null,
      ): Promise<WorkloadWindow> => {
        const dto: ListWorkloadPage = await abortableRead(
          this.lists.queryGetListWorkload(
            listId,
            toWorkloadQuery(query, weekStart, cursor, PAGE_LIMIT),
            { cache: 'no-store' },
          ),
          signal,
        );
        return toWorkloadWindow(dto);
      };
      const first: WorkloadWindow = await read(null);
      const items: WorkloadItem[] = [...first.items];
      const given: Set<string> = new Set<string>();
      let cursor: string | null = first.nextCursor;
      for (let page: number = 1; cursor !== null; page++) {
        if (given.has(cursor) || page >= MAX_PAGES) {
          throw new Error('The workload could not be read to its end.');
        }
        given.add(cursor);
        const next: WorkloadWindow = await read(cursor);
        items.push(...next.items);
        cursor = next.nextCursor;
      }
      return { weekStart: first.weekStart, days: first.days, items };
    } catch (error: unknown) {
      throw toRouteError(error, 'list', listId);
    }
  }

  /**
   * Method spent
   *
   * @description
   * Reads the minutes each person recorded on the list's tasks over the two weeks starting on
   * `weekStart`, whatever the view's filters (a timesheet takes none).
   *
   * @param {string} listId - The list.
   * @param {string} weekStart - Monday of the first week.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<Readonly<Record<string, number>>>} Minutes by account id.
   */
  public async spent(
    listId: string,
    weekStart: string,
    signal?: AbortSignal,
  ): Promise<Readonly<Record<string, number>>> {
    const second: Date = new Date(`${weekStart}T00:00:00Z`);
    second.setUTCDate(second.getUTCDate() + 7);
    const weeks: readonly string[] = [weekStart, second.toISOString().slice(0, 10)];
    const pages: readonly (readonly ListTimesheetPage[])[] = await Promise.all(
      weeks.map((week: string) => this.week(listId, week, signal)),
    );
    return pages
      .flat()
      .reduce(
        (spent: Record<string, number>, page: ListTimesheetPage) => addSpentMinutes(spent, page),
        {},
      );
  }

  /**
   * Method week
   *
   * @description
   * Reads every page of one week's timesheet. A cursor given twice, or still given after
   * `MAX_PAGES` pages, fails the read.
   *
   * @param {string} listId - The list.
   * @param {string} weekStart - Monday of the week.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<readonly ListTimesheetPage[]>} The pages.
   */
  private async week(
    listId: string,
    weekStart: string,
    signal?: AbortSignal,
  ): Promise<readonly ListTimesheetPage[]> {
    const pages: ListTimesheetPage[] = [];
    const given: Set<string> = new Set<string>();
    let cursor: string | null = null;
    do {
      const page: ListTimesheetPage = await abortableRead(
        this.time.getListTimesheet(
          listId,
          { weekStart, limit: PAGE_LIMIT, ...(cursor === null ? {} : { cursor }) },
          { cache: 'no-store' },
        ),
        signal,
      );
      pages.push(page);
      cursor = page.nextCursor;
      if (cursor !== null && (given.has(cursor) || pages.length >= MAX_PAGES)) {
        throw new Error('The timesheet could not be read to its end.');
      }
      if (cursor !== null) given.add(cursor);
    } while (cursor !== null);
    return pages;
  }
  // #endregion
}
