import type { ListListActivityClientResult, ListListActivityParams } from '@cadenway/api-client';

import type {
  ListActivityChange,
  ListActivityEntry,
  ListActivityFilter,
  ListActivityPage,
} from '../../../models/list-activity/list-activity.interface';

/**
 * Type ActivityEntryDto
 *
 * @description
 * One entry of the generated activity page of a list.
 *
 * @type {ListListActivityClientResult['items'][number]}
 */
type ActivityEntryDto = ListListActivityClientResult['items'][number];

/**
 * Function plainExcerpt
 *
 * @description
 * The text of a comment excerpt without its Markdown (`plain` of `App.dc.html` line 7690): a
 * link keeps its text, the marks `* _ ~ \` # >` go, and white space folds into single spaces.
 *
 * @param {string} excerpt - The excerpt as the gateway gives it.
 * @returns {string} The plain text.
 */
export function plainExcerpt(excerpt: string): string {
  return excerpt
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
    .replace(/[*_~`#>]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * Function toChange
 *
 * @description
 * Reads what an entry records; a kind without its member, or a later kind, is a generic change.
 *
 * @param {ActivityEntryDto} entry - The generated entry.
 * @returns {ListActivityChange} The change.
 */
function toChange(entry: ActivityEntryDto): ListActivityChange {
  switch (entry.kind) {
    case 'create':
      return { kind: 'create' };
    case 'status':
      return entry.status
        ? { kind: 'status', from: entry.status.from, to: entry.status.to }
        : { kind: 'other' };
    case 'priority':
      return entry.priority
        ? { kind: 'priority', from: entry.priority.from, to: entry.priority.to }
        : { kind: 'other' };
    case 'due':
      return entry.dueDate
        ? { kind: 'due', from: entry.dueDate.from, to: entry.dueDate.to }
        : { kind: 'other' };
    case 'assign':
      return entry.assignee
        ? { kind: 'assign', userId: entry.assignee.userId, added: entry.assignee.added }
        : { kind: 'other' };
    case 'comment':
      return { kind: 'comment', excerpt: plainExcerpt(entry.commentExcerpt ?? '') };
    default:
      return { kind: 'other' };
  }
}

/**
 * Function toListActivityPage
 *
 * @description
 * Maps a page of the activity log of a list (`listListActivity`).
 *
 * @param {ListListActivityClientResult} page - The generated page.
 * @returns {ListActivityPage} The display model.
 */
export function toListActivityPage(page: ListListActivityClientResult): ListActivityPage {
  return {
    total: page.total,
    nextCursor: page.nextCursor,
    items: page.items.map((entry: ActivityEntryDto): ListActivityEntry => ({
      id: entry.id,
      at: entry.occurredAt,
      actor: {
        type: entry.actor.type,
        id: entry.actor.id,
        provider: entry.actor.provider ?? null,
      },
      task: { key: entry.task.key, name: entry.task.name, status: entry.task.status },
      change: toChange(entry),
    })),
  };
}

/**
 * Function toListActivityParams
 *
 * @description
 * The query parameters of a page: the kinds and the person only when they filter (absent means
 * every kind and everyone), the cursor only after the first page.
 *
 * @param {ListActivityFilter} filter - The view's filters.
 * @param {string | null} cursor - Cursor of the page, null for the first one.
 * @param {number} limit - Page size, 1 to 100.
 * @returns {ListListActivityParams} The generated parameters.
 */
export function toListActivityParams(
  filter: ListActivityFilter,
  cursor: string | null,
  limit: number,
): ListListActivityParams {
  return {
    limit,
    ...(filter.kinds.length > 0 ? { kind: [...filter.kinds] } : {}),
    ...(filter.actorId !== null ? { actorId: [filter.actorId] } : {}),
    ...(cursor !== null ? { cursor } : {}),
  };
}
