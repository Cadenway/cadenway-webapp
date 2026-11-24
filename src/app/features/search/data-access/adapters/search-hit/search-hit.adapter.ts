import type { SearchHit } from '@cadenway/api-client';

import type { SearchResult } from '../../../models/search-result/search-result.interface';

/**
 * Function toSearchResult
 *
 * @description
 * Maps a search hit to the palette's display model; a list without a visible space keeps a null
 * space name.
 *
 * @param {SearchHit} hit - A task or list hit.
 * @returns {SearchResult} Display model of the hit.
 */
export function toSearchResult(hit: SearchHit): SearchResult {
  return hit.kind === 'task'
    ? { kind: 'task', key: hit.taskKey, name: hit.name, status: hit.status }
    : { kind: 'list', listId: hit.listId, name: hit.name, spaceName: hit.spaceName ?? null };
}
