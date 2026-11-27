import { HttpContext, HttpErrorResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import {
  type ArchivedList,
  type ArchivedTask,
  ArchivesService,
  type ListMembersClientResult,
  MembersService,
} from '@cadenway/api-client';
import { firstValueFrom, fromEvent, type Observable, takeUntil } from 'rxjs';

import { OrganizationSwitchPendingError, PASSIVE_REQUEST } from '@core/api';

import type { ArchivedListItem } from '../../../models/archived-list/archived-list.interface';
import type { ArchivedTaskItem } from '../../../models/archived-task/archived-task.interface';
import type { ArchivesRead } from '../../../models/archives-read/archives-read.interface';
import {
  toArchivedListItem,
  toArchivedTaskItem,
  toMemberName,
} from '../../adapters/archives/archives.adapter';

/**
 * Constant PAGE_SIZE
 *
 * @description
 * Items asked for per page, the largest the contract allows.
 *
 * @type {number}
 */
const PAGE_SIZE: number = 100;

/**
 * Constant REQUEST_TIMEOUT_MS
 *
 * @description
 * Time given to each request, in milliseconds. A read past it fails (the page offers `Retry`); a
 * write past it has an unknown outcome, settled by reading the archives again.
 *
 * @type {number}
 */
export const REQUEST_TIMEOUT_MS: number = 10_000;

/**
 * Function isUncertainRestore
 *
 * @description
 * Whether a failed unarchive may still have been applied: no answer (a network failure, a
 * timeout), `408` or a server failure (`5xx`). A write refused before it left, because the
 * workspace organization was changing, and any other `4xx` are definite refusals.
 *
 * @param {unknown} error - The failure.
 * @returns {boolean} Whether its outcome is unknown.
 */
export function isUncertainRestore(error: unknown): boolean {
  if (error instanceof OrganizationSwitchPendingError) return false;
  if (!(error instanceof HttpErrorResponse)) return true;
  return error.status === 0 || error.status === 408 || error.status >= 500;
}

/**
 * Function untilAborted
 *
 * @description
 * Subscribes to a gateway read until its resource is superseded or destroyed.
 *
 * @param {Observable<T>} source - Gateway read.
 * @param {AbortSignal | undefined} signal - Resource cancellation signal.
 * @returns {Promise<T>} The first response.
 */
function untilAborted<T>(source: Observable<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  return firstValueFrom(signal ? source.pipe(takeUntil(fromEvent(signal, 'abort'))) : source);
}

/**
 * Interface PageAnswer
 *
 * @description
 * The shape every archives page shares: its entries, the cursor of the next page and the total.
 */
interface PageAnswer<E> {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The entries of the page.
   *
   * @type {E[]}
   */
  items: E[];

  /**
   * Property nextCursor
   *
   * @description
   * Cursor of the next page, or null on the last one.
   *
   * @type {string | null}
   */
  nextCursor: string | null;

  /**
   * Property total
   *
   * @description
   * Every entry the gateway counted, on every page.
   *
   * @type {number}
   */
  total: number;
  // #endregion
}

/**
 * Interface Paged
 *
 * @description
 * Every item of a paged read, with the total of its last page.
 */
interface Paged<T> {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The items of every page, in order.
   *
   * @type {readonly T[]}
   * @readonly
   */
  readonly items: readonly T[];

  /**
   * Property total
   *
   * @description
   * The total the gateway counted on the last page.
   *
   * @type {number}
   * @readonly
   */
  readonly total: number;
  // #endregion
}

/**
 * Function readAll
 *
 * @description
 * Reads a paged archives collection to its last cursor, one page after the other.
 *
 * @param {(cursor: string | undefined) => Observable<PageAnswer<E>>} page - Reads one page after
 * a cursor.
 * @param {(entry: E) => T} map - Maps an entry to its display model.
 * @param {AbortSignal | undefined} signal - Resource cancellation signal.
 * @returns {Promise<Paged<T>>} Every item and the last total.
 */
async function readAll<E, T>(
  page: (cursor: string | undefined) => Observable<PageAnswer<E>>,
  map: (entry: E) => T,
  signal: AbortSignal | undefined,
): Promise<Paged<T>> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (;;) {
    const answer: PageAnswer<E> = await untilAborted(page(cursor), signal);
    items.push(...answer.items.map(map));
    cursor = answer.nextCursor ?? undefined;
    if (!cursor) return { items, total: answer.total };
  }
}

/**
 * Service ArchivesApi
 *
 * @description
 * The archives page's access to `archives` and `members` of the gateway, mapped to display
 * models: both tabs read to their last page, the names of the members, and the unarchiving of a
 * list or a task. Every operation needs the session's current organization, which the
 * organization pin attaches.
 */
@Service()
export class ArchivesApi {
  // #region Properties
  /**
   * Property archives
   *
   * @description
   * Generated archives operations.
   *
   * @type {ArchivesService}
   * @readonly
   */
  private readonly archives: ArchivesService = inject(ArchivesService);

  /**
   * Property members
   *
   * @description
   * Generated members operations.
   *
   * @type {MembersService}
   * @readonly
   */
  private readonly members: MembersService = inject(MembersService);
  // #endregion

  // #region Methods
  /**
   * Method read
   *
   * @description
   * Reads the archived lists and the archived tasks, both to their last page, side by side.
   *
   * @param {boolean} passive - Whether the read was triggered in the background (focus,
   * reconnection, after a write), which waits for a verified workspace context.
   * @param {AbortSignal} [signal] - Cancels the read when its resource is superseded.
   * @returns {Promise<ArchivesRead>} Both tabs and their totals.
   */
  public async read(passive: boolean, signal?: AbortSignal): Promise<ArchivesRead> {
    const context: HttpContext = new HttpContext().set(PASSIVE_REQUEST, passive);
    const options: { context: HttpContext; timeout: number } = {
      context,
      timeout: REQUEST_TIMEOUT_MS,
    };
    const [lists, tasks]: [Paged<ArchivedListItem>, Paged<ArchivedTaskItem>] = await Promise.all([
      readAll(
        (cursor: string | undefined) =>
          this.archives.listArchivedLists(
            { limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) },
            options,
          ),
        (entry: ArchivedList) => toArchivedListItem(entry),
        signal,
      ),
      readAll(
        (cursor: string | undefined) =>
          this.archives.listArchivedTasks(
            { limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) },
            options,
          ),
        (entry: ArchivedTask) => toArchivedTaskItem(entry),
        signal,
      ),
    ]);
    return {
      lists: lists.items,
      listTotal: lists.total,
      tasks: tasks.items,
      taskTotal: tasks.total,
    };
  }

  /**
   * Method memberNames
   *
   * @description
   * Reads every member of the organization, guests included, to its last page, for the `by` of
   * the rows.
   *
   * @param {AbortSignal} [signal] - Cancels the read when its resource is superseded.
   * @returns {Promise<ReadonlyMap<string, string>>} Member names by account id.
   */
  public async memberNames(signal?: AbortSignal): Promise<ReadonlyMap<string, string>> {
    const names: Map<string, string> = new Map<string, string>();
    let cursor: string | undefined;
    do {
      const page: ListMembersClientResult = await untilAborted(
        this.members.listMembers(
          { limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) },
          { context: new HttpContext().set(PASSIVE_REQUEST, true), timeout: REQUEST_TIMEOUT_MS },
        ),
        signal,
      );
      for (const member of page.items) names.set(...toMemberName(member));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return names;
  }

  /**
   * Method unarchiveList
   *
   * @description
   * Restores an archived list at the end of its space. A list that is not archived any more
   * answers as restored. No `If-Match` is sent: the restore applies to whatever version is
   * current.
   *
   * @param {string} listId - The list.
   * @returns {Promise<void>} Resolves once the gateway confirmed it.
   */
  public async unarchiveList(listId: string): Promise<void> {
    await firstValueFrom(this.archives.unarchiveList(listId, {}, { timeout: REQUEST_TIMEOUT_MS }));
  }

  /**
   * Method unarchiveTask
   *
   * @description
   * Restores the archive a task belongs to, from its root, with its list when that list is
   * archived too. A task that is not archived any more answers as restored.
   *
   * @param {string} taskKey - The task.
   * @returns {Promise<void>} Resolves once the gateway confirmed it.
   */
  public async unarchiveTask(taskKey: string): Promise<void> {
    await firstValueFrom(this.archives.unarchiveTask(taskKey, {}, { timeout: REQUEST_TIMEOUT_MS }));
  }
  // #endregion
}
