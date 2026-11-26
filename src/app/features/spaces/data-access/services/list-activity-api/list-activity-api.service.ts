import { inject, Service } from '@angular/core';
import { type ListListActivityClientResult, ListsService } from '@cadenway/api-client';

import type {
  ListActivityFilter,
  ListActivityPage,
} from '../../../models/list-activity/list-activity.interface';
import {
  toListActivityPage,
  toListActivityParams,
} from '../../adapters/list-activity/list-activity.adapter';
import { toRouteError } from '../../adapters/route-error/route-error.adapter';
import { abortableRead } from '../../utils/abortable-read/abortable-read.util';

/**
 * Service ListActivityApi
 *
 * @description
 * The reads of the `Activity` view: the cursor pages of the activity log of a list
 * (`listListActivity`), the most recent entries first, with the view's kinds and person, mapped to
 * display models. Every read bypasses the HTTP cache, so a read after a realtime notice reaches
 * the gateway again. A failed read rejects with the typed route error of the list.
 */
@Service()
export class ListActivityApi {
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
   * Method page
   *
   * @description
   * Reads one page of the activity log of a list.
   *
   * @param {string} listId - The list.
   * @param {ListActivityFilter} filter - The view's kinds and person.
   * @param {string | null} cursor - Cursor of the page, null for the first one.
   * @param {number} limit - Page size, 1 to 100.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<ListActivityPage>} The page.
   * @throws {Error} The typed route error of the failure.
   */
  public async page(
    listId: string,
    filter: ListActivityFilter,
    cursor: string | null,
    limit: number,
    signal?: AbortSignal,
  ): Promise<ListActivityPage> {
    try {
      const page: ListListActivityClientResult = await abortableRead(
        this.lists.listListActivity(listId, toListActivityParams(filter, cursor, limit), {
          cache: 'no-store',
        }),
        signal,
      );
      return toListActivityPage(page);
    } catch (error: unknown) {
      throw toRouteError(error, 'list', listId);
    }
  }
  // #endregion
}
