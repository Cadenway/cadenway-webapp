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
 * Pages read at most for one report, 1,000 days: far past any sprint, so a cursor still given
 * after them never ends and the read fails rather than keep the dialog reading.
 *
 * @type {number}
 */
const MAX_PAGES: number = 10;

/**
 * Class SprintReportIncompleteError
 *
 * @description
 * The burndown could not be read to its end: the gateway gave a cursor it had already given, or
 * still gave one after `MAX_PAGES` pages. The report is never returned without its last days;
 * the dialog shows its inline error with `Retry`.
 */
export class SprintReportIncompleteError extends Error {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Stable error name for diagnostics.
   *
   * @type {string}
   * @readonly
   */
  public override readonly name: string = 'SprintReportIncompleteError';

  /**
   * Property kind
   *
   * @description
   * Identifies this failure.
   *
   * @type {'incomplete'}
   * @readonly
   */
  public readonly kind: 'incomplete' = 'incomplete';

  /**
   * Property listId
   *
   * @description
   * The sprint whose burndown stopped.
   *
   * @type {string}
   * @readonly
   */
  public readonly listId: string;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Names the sprint whose burndown could not be read to its end.
   *
   * @param {string} listId - The sprint.
   * @constructor
   */
  public constructor(listId: string) {
    super('The sprint burndown could not be read to its end.');
    this.listId = listId;
  }
  // #endregion
}

/**
 * Service SprintReportApi
 *
 * @description
 * Reads the report of a sprint (`getSprintReport`): its points, every day of its burndown and the
 * velocity of the earlier sprints of its space, observed on the caller's day in the caller's time
 * zone. The burndown is paged; the service reads every page and joins the days, and fails rather
 * than return a burndown cut short (`SprintReportIncompleteError`). Each read bypasses
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
   * @throws {SprintReportIncompleteError} When the burndown cannot be read to its end.
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
    const given: Set<string> = new Set<string>();
    let cursor: string | null = first.nextCursor;
    for (let page: number = 1; cursor !== null; page += 1) {
      if (given.has(cursor) || page >= MAX_PAGES) throw new SprintReportIncompleteError(listId);
      given.add(cursor);
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
