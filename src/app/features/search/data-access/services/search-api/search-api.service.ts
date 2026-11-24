import { inject, Service } from '@angular/core';
import { type SearchHit, type SearchPage, SearchService } from '@cadenway/api-client';
import { map, type Observable } from 'rxjs';

import type { SearchResult } from '../../../models/search-result/search-result.interface';
import { toSearchResult } from '../../adapters/search-hit/search-hit.adapter';

/**
 * Constant PAGE_SIZE
 *
 * @description
 * Matches the palette asks for: one page, tasks first then lists, as the gateway orders them.
 *
 * @type {number}
 */
const PAGE_SIZE: number = 20;

/**
 * Service SearchApi
 *
 * @description
 * The palette's access to `GET /v1/search`, mapped to display models.
 */
@Service()
export class SearchApi {
  // #region Properties
  /**
   * Property client
   *
   * @description
   * Generated search operations.
   *
   * @type {SearchService}
   * @readonly
   */
  private readonly client: SearchService = inject(SearchService);
  // #endregion

  // #region Methods
  /**
   * Method search
   *
   * @description
   * Searches the visible tasks and lists whose name (and key, for a task) contains the text,
   * ignoring case. Unsubscribing cancels the request.
   *
   * @param {string} query - Non-blank text typed in the palette.
   * @returns {Observable<readonly SearchResult[]>} The first page of matches.
   */
  public search(query: string): Observable<readonly SearchResult[]> {
    return this.client
      .search({ q: query, limit: PAGE_SIZE })
      .pipe(map((page: SearchPage) => page.items.map((hit: SearchHit) => toSearchResult(hit))));
  }
  // #endregion
}
