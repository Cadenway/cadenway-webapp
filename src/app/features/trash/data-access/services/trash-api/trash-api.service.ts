import { HttpContext, HttpErrorResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import {
  type MemberPage,
  MembersService,
  type TrashEmptied,
  type TrashEntryPage,
  type TrashRestored,
  TrashService,
} from '@cadenway/api-client';
import { firstValueFrom, fromEvent, type Observable, takeUntil } from 'rxjs';

import { hasProblemCode, PASSIVE_REQUEST } from '@core/api';

import type { TrashEntry } from '../../../models/trash-entry/trash-entry.interface';
import type { TrashRestore } from '../../../models/trash-restore/trash-restore.interface';
import { toTrashEntry, toTrashRestore } from '../../adapters/trash/trash.adapter';

/**
 * Constant PAGE_LIMIT
 *
 * @description
 * Page size of the trash and member reads, the largest the contract allows.
 *
 * @type {number}
 */
const PAGE_LIMIT: number = 100;

/**
 * Function isUncertainTrashWrite
 *
 * @description
 * Whether a failed write may still have been applied: no answer (a network failure, an abort or
 * a client timeout), a gateway timeout (`408`) or a server failure (`5xx`). Any other `4xx` is a
 * definite refusal.
 *
 * @param {unknown} error - The failed write.
 * @returns {boolean} Whether the outcome is unknown.
 */
export function isUncertainTrashWrite(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse)) return true;
  return error.status === 0 || error.status === 408 || error.status >= 500;
}

/**
 * Function isTrashEntryGone
 *
 * @description
 * Whether a write found no entry the caller may act on: `404 trash-entry.not-found`, for an
 * entry restored or erased already, unknown, or of a list the caller can no longer change.
 *
 * @param {unknown} error - The failed write.
 * @returns {boolean} Whether the entry is no longer in the trash for the caller.
 */
export function isTrashEntryGone(error: unknown): boolean {
  return hasProblemCode(error, 'trash-entry.not-found');
}

/**
 * Function read
 *
 * @description
 * The first answer of a request, given up when the signal aborts.
 *
 * @param {Observable<T>} source - The request.
 * @param {AbortSignal | undefined} signal - Cancels a superseded read.
 * @returns {Promise<T>} The answer.
 */
function read<T>(source: Observable<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  return firstValueFrom(signal ? source.pipe(takeUntil(fromEvent(signal, 'abort'))) : source);
}

/**
 * Service TrashApi
 *
 * @description
 * The trash page's access to the gateway's `trash` operations and the member directory, mapped to
 * display models: every entry the caller may restore (to the last page), their restore, purge
 * and the emptying of the trash. Every call carries `If-Organization-Match` through the
 * organization pin; reads bypass the HTTP cache.
 */
@Service()
export class TrashApi {
  // #region Properties
  /**
   * Property trash
   *
   * @description
   * Generated trash operations.
   *
   * @type {TrashService}
   * @readonly
   */
  private readonly trash: TrashService = inject(TrashService);

  /**
   * Property membersService
   *
   * @description
   * Generated member operations, to name who deleted an entry.
   *
   * @type {MembersService}
   * @readonly
   */
  private readonly membersService: MembersService = inject(MembersService);
  // #endregion

  // #region Methods
  /**
   * Method entries
   *
   * @description
   * Reads every entry of the trash the caller may restore, the most recently deleted first, page
   * after page. A passive read (on focus or reconnection) waits while the organization context is
   * being verified.
   *
   * @param {{ readonly passive?: boolean; readonly signal?: AbortSignal }} options - Whether the read is a background one, and its cancellation.
   * @returns {Promise<readonly TrashEntry[]>} The entries; a failed page rejects.
   */
  public async entries(
    options: { readonly passive?: boolean; readonly signal?: AbortSignal } = {},
  ): Promise<readonly TrashEntry[]> {
    const context: HttpContext = new HttpContext().set(PASSIVE_REQUEST, options.passive === true);
    const items: TrashEntry[] = [];
    let cursor: string | undefined;
    do {
      const page: TrashEntryPage = await read(
        this.trash.listTrash(
          { limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) },
          { cache: 'no-store', context },
        ),
        options.signal,
      );
      items.push(...page.items.map(toTrashEntry));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return items;
  }

  /**
   * Method members
   *
   * @description
   * Reads the member directory, page after page, to name who deleted each entry.
   *
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<ReadonlyMap<string, string>>} Each member's name by account id; a failed page rejects.
   */
  public async members(signal?: AbortSignal): Promise<ReadonlyMap<string, string>> {
    const names: Map<string, string> = new Map<string, string>();
    let cursor: string | undefined;
    do {
      const page: MemberPage = await read(
        this.membersService.listMembers({ limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) }),
        signal,
      );
      for (const member of page.items) names.set(member.userId, member.name);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return names;
  }

  /**
   * Method restore
   *
   * @description
   * Brings an entry back to its list, with its subtasks. A `404 trash-entry.not-found`
   * (`isTrashEntryGone`) means the entry is no longer in the trash.
   *
   * @param {string} entryId - The trash entry.
   * @returns {Promise<TrashRestore>} What came back; a failure rejects.
   */
  public async restore(entryId: string): Promise<TrashRestore> {
    const restored: TrashRestored = await firstValueFrom(this.trash.restoreTrashEntry(entryId, {}));
    return toTrashRestore(restored);
  }

  /**
   * Method purge
   *
   * @description
   * Erases an entry for good, with its subtasks. A `404 trash-entry.not-found`
   * (`isTrashEntryGone`) means the entry is no longer in the trash.
   *
   * @param {string} entryId - The trash entry.
   * @returns {Promise<void>} Completion; a failure rejects.
   */
  public async purge(entryId: string): Promise<void> {
    await firstValueFrom(this.trash.purgeTrashEntry(entryId), { defaultValue: undefined });
  }

  /**
   * Method empty
   *
   * @description
   * Takes every entry the caller may restore out of the trash; a job erases them within minutes.
   *
   * @returns {Promise<number>} How many entries left the trash; a failure rejects.
   */
  public async empty(): Promise<number> {
    const emptied: TrashEmptied = await firstValueFrom(this.trash.emptyTrash({}));
    return emptied.entryCount;
  }
  // #endregion
}
