import { HttpContext, HttpErrorResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import {
  type ArchivedList,
  type ArchivedTask,
  ArchivesService,
  type GetListClientResult,
  type GetTaskClientResult,
  type ListMembersClientResult,
  ListsService,
  MembersService,
  TasksService,
} from '@cadenway/api-client';
import { firstValueFrom, fromEvent, type Observable, takeUntil } from 'rxjs';

import { hasProblemCode, OrganizationSwitchPendingError, PASSIVE_REQUEST } from '@core/api';

import type { ArchiveCheck } from '../../../models/archive-check/archive-check.type';
import type { ArchivedListItem } from '../../../models/archived-list/archived-list.interface';
import type { ArchivedTaskItem } from '../../../models/archived-task/archived-task.interface';
import type {
  ArchivesDepth,
  ArchivesMore,
  ArchivesRead,
} from '../../../models/archives-read/archives-read.interface';
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
 * Constant MAX_PAGES
 *
 * @description
 * Pages read per tab by the first read and by each `Show more`, so one read costs at most
 * 1,000 items per tab however large the archives grow (they never expire). A background read
 * refreshes each tab down to the depth already shown.
 *
 * @type {number}
 */
export const MAX_PAGES: number = 10;

/**
 * Constant REQUEST_TIMEOUT_MS
 *
 * @description
 * Time given to each read, in milliseconds. A first read past it fails (the page offers `Retry`).
 *
 * @type {number}
 */
export const REQUEST_TIMEOUT_MS: number = 10_000;

/**
 * Constant RESTORE_TIMEOUT_MS
 *
 * @description
 * Time given to an unarchive, in milliseconds, longer than a read's: restoring a task restores
 * its whole subtree, and its list with it. A write past it has an unknown outcome.
 *
 * @type {number}
 */
export const RESTORE_TIMEOUT_MS: number = 30_000;

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
 * Function isForbiddenRestore
 *
 * @description
 * Whether an unarchive was refused because the caller lacks `edit` on the list
 * (`403 access.role-insufficient`).
 *
 * @param {unknown} error - The failure.
 * @returns {boolean} Whether the role was insufficient.
 */
export function isForbiddenRestore(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    error.status === 403 &&
    hasProblemCode(error, 'access.role-insufficient')
  );
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
 * Function readPages
 *
 * @description
 * Reads a paged archives collection one page after the other, from a cursor (or the start), to
 * its last page or to `pages` pages, whichever comes first; the total stays the gateway's.
 *
 * @param {(cursor: string | undefined) => Observable<PageAnswer<E>>} page - Reads one page after
 * a cursor.
 * @param {(entry: E) => T} map - Maps an entry to its display model.
 * @param {number} pages - Pages to read at most, at least one.
 * @param {string | undefined} from - Cursor to start from, or undefined for the first page.
 * @param {AbortSignal | undefined} signal - Resource cancellation signal.
 * @returns {Promise<ArchivesMore<T>>} The items read, the last total and the next cursor.
 */
async function readPages<E, T>(
  page: (cursor: string | undefined) => Observable<PageAnswer<E>>,
  map: (entry: E) => T,
  pages: number,
  from: string | undefined,
  signal: AbortSignal | undefined,
): Promise<ArchivesMore<T>> {
  const items: T[] = [];
  let cursor: string | undefined = from;
  for (let read: number = 1; ; read += 1) {
    const answer: PageAnswer<E> = await untilAborted(page(cursor), signal);
    items.push(...answer.items.map(map));
    cursor = answer.nextCursor ?? undefined;
    if (!cursor || read >= Math.max(1, pages)) {
      return { items, total: answer.total, cursor: cursor ?? null };
    }
  }
}

/**
 * Service ArchivesApi
 *
 * @description
 * The archives page's access to `archives`, `members`, `lists` and `tasks` of the gateway, mapped
 * to display models: both tabs (down to a given depth each) and their next pages, the names of
 * the members, the unarchiving of a list or a task, and the read of one item that settles an
 * unknown outcome.
 * Every operation needs the session's current organization, which the organization pin attaches.
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

  /**
   * Property lists
   *
   * @description
   * Generated lists operations, to read one list after an unknown outcome.
   *
   * @type {ListsService}
   * @readonly
   */
  private readonly lists: ListsService = inject(ListsService);

  /**
   * Property tasks
   *
   * @description
   * Generated tasks operations, to read one task after an unknown outcome.
   *
   * @type {TasksService}
   * @readonly
   */
  private readonly tasks: TasksService = inject(TasksService);
  // #endregion

  // #region Methods
  /**
   * Method read
   *
   * @description
   * Reads the archived lists and the archived tasks side by side, each from its first page down
   * to its depth (or its last page), with the gateway's totals and the cursors that continue them.
   *
   * @param {boolean} passive - Whether the read was triggered in the background (focus,
   * reconnection, after a write), which waits for a verified workspace context.
   * @param {AbortSignal} [signal] - Cancels the read when its resource is superseded.
   * @param {ArchivesDepth} [depth] - Pages per tab; `MAX_PAGES` each by default.
   * @returns {Promise<ArchivesRead>} Both tabs, their totals and their cursors.
   */
  public async read(
    passive: boolean,
    signal?: AbortSignal,
    depth: ArchivesDepth = { lists: MAX_PAGES, tasks: MAX_PAGES },
  ): Promise<ArchivesRead> {
    const [lists, tasks]: [ArchivesMore<ArchivedListItem>, ArchivesMore<ArchivedTaskItem>] =
      await Promise.all([
        this.listPages(passive, depth.lists, undefined, signal),
        this.taskPages(passive, depth.tasks, undefined, signal),
      ]);
    return {
      lists: lists.items,
      listTotal: lists.total,
      listCursor: lists.cursor,
      tasks: tasks.items,
      taskTotal: tasks.total,
      taskCursor: tasks.cursor,
    };
  }

  /**
   * Method moreLists
   *
   * @description
   * Reads the next `MAX_PAGES` pages of archived lists from a cursor (`Show more`).
   *
   * @param {string} cursor - The cursor the tab stopped at.
   * @returns {Promise<ArchivesMore<ArchivedListItem>>} The lists, the total and the next cursor.
   */
  public moreLists(cursor: string): Promise<ArchivesMore<ArchivedListItem>> {
    return this.listPages(false, MAX_PAGES, cursor, undefined);
  }

  /**
   * Method moreTasks
   *
   * @description
   * Reads the next `MAX_PAGES` pages of archived roots from a cursor (`Show more`).
   *
   * @param {string} cursor - The cursor the tab stopped at.
   * @returns {Promise<ArchivesMore<ArchivedTaskItem>>} The roots, the total and the next cursor.
   */
  public moreTasks(cursor: string): Promise<ArchivesMore<ArchivedTaskItem>> {
    return this.taskPages(false, MAX_PAGES, cursor, undefined);
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
    await firstValueFrom(this.archives.unarchiveList(listId, {}, { timeout: RESTORE_TIMEOUT_MS }));
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
    await firstValueFrom(this.archives.unarchiveTask(taskKey, {}, { timeout: RESTORE_TIMEOUT_MS }));
  }

  /**
   * Method checkList
   *
   * @description
   * Reads one list by its id, passively and bypassing the HTTP cache, to tell whether an
   * unarchive with an unknown outcome was applied.
   *
   * @param {string} listId - The list.
   * @returns {Promise<ArchiveCheck>} Its state; rejects when the read itself fails.
   */
  public async checkList(listId: string): Promise<ArchiveCheck> {
    try {
      const list: GetListClientResult = await firstValueFrom(
        this.lists.getList(listId, {
          cache: 'no-store',
          context: new HttpContext().set(PASSIVE_REQUEST, true),
          timeout: REQUEST_TIMEOUT_MS,
        }),
      );
      return list.archivedAt ? 'archived' : 'restored';
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && error.status === 404) return 'gone';
      throw error;
    }
  }

  /**
   * Method checkTask
   *
   * @description
   * Reads one task by its key, passively and bypassing the HTTP cache, to tell whether an
   * unarchive with an unknown outcome was applied.
   *
   * @param {string} taskKey - The task.
   * @returns {Promise<ArchiveCheck>} Its state; rejects when the read itself fails.
   */
  public async checkTask(taskKey: string): Promise<ArchiveCheck> {
    try {
      const task: GetTaskClientResult = await firstValueFrom(
        this.tasks.getTask(taskKey, {
          cache: 'no-store',
          context: new HttpContext().set(PASSIVE_REQUEST, true),
          timeout: REQUEST_TIMEOUT_MS,
        }),
      );
      return task.archivedAt ? 'archived' : 'restored';
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && error.status === 404) return 'gone';
      throw error;
    }
  }

  /**
   * Method listPages
   *
   * @description
   * Reads pages of archived lists.
   *
   * @param {boolean} passive - Whether the read runs in the background.
   * @param {number} pages - Pages to read at most.
   * @param {string | undefined} from - Cursor to start from, or undefined for the first page.
   * @param {AbortSignal | undefined} signal - Cancels the read.
   * @returns {Promise<ArchivesMore<ArchivedListItem>>} The lists, the total and the next cursor.
   */
  private listPages(
    passive: boolean,
    pages: number,
    from: string | undefined,
    signal: AbortSignal | undefined,
  ): Promise<ArchivesMore<ArchivedListItem>> {
    const options: { context: HttpContext; timeout: number } = {
      context: new HttpContext().set(PASSIVE_REQUEST, passive),
      timeout: REQUEST_TIMEOUT_MS,
    };
    return readPages(
      (cursor: string | undefined) =>
        this.archives.listArchivedLists(
          { limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) },
          options,
        ),
      (entry: ArchivedList) => toArchivedListItem(entry),
      pages,
      from,
      signal,
    );
  }

  /**
   * Method taskPages
   *
   * @description
   * Reads pages of archived roots.
   *
   * @param {boolean} passive - Whether the read runs in the background.
   * @param {number} pages - Pages to read at most.
   * @param {string | undefined} from - Cursor to start from, or undefined for the first page.
   * @param {AbortSignal | undefined} signal - Cancels the read.
   * @returns {Promise<ArchivesMore<ArchivedTaskItem>>} The roots, the total and the next cursor.
   */
  private taskPages(
    passive: boolean,
    pages: number,
    from: string | undefined,
    signal: AbortSignal | undefined,
  ): Promise<ArchivesMore<ArchivedTaskItem>> {
    const options: { context: HttpContext; timeout: number } = {
      context: new HttpContext().set(PASSIVE_REQUEST, passive),
      timeout: REQUEST_TIMEOUT_MS,
    };
    return readPages(
      (cursor: string | undefined) =>
        this.archives.listArchivedTasks(
          { limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) },
          options,
        ),
      (entry: ArchivedTask) => toArchivedTaskItem(entry),
      pages,
      from,
      signal,
    );
  }
  // #endregion
}
