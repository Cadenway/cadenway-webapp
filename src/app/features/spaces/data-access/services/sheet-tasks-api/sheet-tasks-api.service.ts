import { inject, Service } from '@angular/core';
import {
  type CustomFieldDefinition,
  type CustomFieldDefinitionPage,
  ListsService,
  TaskQueriesService,
  type TaskSummaryPage,
  TaskTimeService,
  type TaskTimeSummary,
} from '@cadenway/api-client';
import { type Observable, Subject } from 'rxjs';

import type { GroupFilter, ListTaskPage } from '../../../models/list-rows/list-rows.interface';
import type { DueWindow } from '../../../models/list-tasks/list-tasks.interface';
import type { ListTaskQuery } from '../../../models/list-view-config/list-view-config.interface';
import type {
  SheetCustomField,
  SheetTaskFacts,
} from '../../../models/sheet-view/sheet-view.interface';
import { toListTaskPage, toListTasksQuery } from '../../adapters/list-task/list-task.adapter';
import { toRouteError } from '../../adapters/route-error/route-error.adapter';
import {
  toSheetCustomField,
  toSheetTaskFacts,
  toSpentMinutes,
} from '../../adapters/sheet-task/sheet-task.adapter';
import { abortableRead } from '../../utils/abortable-read/abortable-read.util';
import { ListTasksApi } from '../list-tasks-api/list-tasks-api.service';

/**
 * Constant CUSTOM_FIELD_PAGE_LIMIT
 *
 * @description
 * Page size of the custom field definitions: the gateway's largest page.
 *
 * @type {number}
 */
const CUSTOM_FIELD_PAGE_LIMIT: number = 100;

/**
 * Service SheetTasksApi
 *
 * @description
 * The data access of the `Sheet` view, provided in its route subtree (`SHEET_VIEW_PROVIDERS`)
 * both as itself and in place of `ListTasksApi`, so the shared flat reader (`ListTasksStore`) and
 * the shared writes keep their behaviour while the sheet reads each page only once: a page of the
 * whole list (no group) is read with `queryListTasks` as `ListTasksApi.page` reads it, mapped to
 * task summaries, and the estimate and custom field values of its tasks, which a task summary
 * does not carry, are published on `facts`. A grouped page and every other operation are
 * `ListTasksApi`'s own. It also reads the list's custom fields (`listListCustomFields`, to the
 * last page) and the time spent on one task (`getTaskTimeSummary`). Every read bypasses the HTTP
 * cache; a failed page or custom field read rejects with the typed route error of the list.
 */
@Service({ autoProvided: false })
export class SheetTasksApi extends ListTasksApi {
  // #region Properties
  /**
   * Property sheetQueries
   *
   * @description
   * Generated task query operations.
   *
   * @type {TaskQueriesService}
   * @readonly
   */
  private readonly sheetQueries: TaskQueriesService = inject(TaskQueriesService);

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
   * Generated time tracking operations.
   *
   * @type {TaskTimeService}
   * @readonly
   */
  private readonly time: TaskTimeService = inject(TaskTimeService);

  /**
   * Property factsRead
   *
   * @description
   * The facts of each page read, in the order the pages answer.
   *
   * @type {Subject<readonly SheetTaskFacts[]>}
   * @readonly
   */
  private readonly factsRead: Subject<readonly SheetTaskFacts[]> = new Subject<
    readonly SheetTaskFacts[]
  >();

  /**
   * Property facts
   *
   * @description
   * Emits the estimate and custom field values of the tasks of each ungrouped page read, at their
   * versions, as soon as the page answers; an aborted or failed page emits nothing.
   *
   * @type {Observable<readonly SheetTaskFacts[]>}
   * @readonly
   */
  public readonly facts: Observable<readonly SheetTaskFacts[]> = this.factsRead.asObservable();
  // #endregion

  // #region Methods
  /**
   * Method page
   *
   * @description
   * Reads one page as `ListTasksApi.page` does; a page of the whole list also publishes its
   * tasks' facts on `facts`.
   *
   * @param {string} listId - The list.
   * @param {ListTaskQuery} query - The view's query.
   * @param {GroupFilter | null} group - The group to read, or null for every task.
   * @param {string | null} cursor - Cursor of the page, null for the first one.
   * @param {number} limit - Page size, 100 at most.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @param {DueWindow | null} [due] - The due dates kept, or null for every task.
   * @returns {Promise<ListTaskPage>} The page.
   * @throws {Error} The typed route error of the failure.
   */
  public override async page(
    listId: string,
    query: ListTaskQuery,
    group: GroupFilter | null,
    cursor: string | null,
    limit: number,
    signal?: AbortSignal,
    due: DueWindow | null = null,
  ): Promise<ListTaskPage> {
    if (group) return super.page(listId, query, group, cursor, limit, signal, due);
    let page: TaskSummaryPage;
    try {
      page = await abortableRead(
        this.sheetQueries.queryListTasks(
          listId,
          toListTasksQuery(query, null, cursor, limit, due),
          { cache: 'no-store' },
        ),
        signal,
      );
    } catch (error: unknown) {
      throw toRouteError(error, 'list', listId);
    }
    this.factsRead.next(page.items.map(toSheetTaskFacts));
    return toListTaskPage(page);
  }

  /**
   * Method customFields
   *
   * @description
   * Reads the active custom fields of the list's space, to the last page, in their position
   * order; fields of a kind the sheet does not show are left out.
   *
   * @param {string} listId - The list.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<readonly SheetCustomField[]>} The fields.
   * @throws {Error} The typed route error of the failure.
   */
  public async customFields(
    listId: string,
    signal?: AbortSignal,
  ): Promise<readonly SheetCustomField[]> {
    try {
      const fields: SheetCustomField[] = [];
      let cursor: string | null = null;
      do {
        const page: CustomFieldDefinitionPage = await abortableRead(
          this.lists.listListCustomFields(
            listId,
            { limit: CUSTOM_FIELD_PAGE_LIMIT, ...(cursor === null ? {} : { cursor }) },
            { cache: 'no-store' },
          ),
          signal,
        );
        for (const definition of page.items as readonly CustomFieldDefinition[]) {
          const field: SheetCustomField | null = toSheetCustomField(definition);
          if (field) fields.push(field);
        }
        cursor = page.nextCursor;
      } while (cursor !== null);
      return fields.sort(
        (first: SheetCustomField, second: SheetCustomField): number =>
          first.position - second.position,
      );
    } catch (error: unknown) {
      throw toRouteError(error, 'list', listId);
    }
  }

  /**
   * Method spentMinutes
   *
   * @description
   * Reads the time logged on one task, in minutes (subtasks counted apart).
   *
   * @param {string} taskKey - Key of the task.
   * @param {AbortSignal | undefined} signal - Cancels a read the view no longer needs.
   * @returns {Promise<number>} The minutes; rejects when the read fails.
   */
  public async spentMinutes(taskKey: string, signal?: AbortSignal): Promise<number> {
    const summary: TaskTimeSummary = await abortableRead(
      this.time.getTaskTimeSummary(taskKey, { cache: 'no-store' }),
      signal,
    );
    return toSpentMinutes(summary);
  }
  // #endregion
}
