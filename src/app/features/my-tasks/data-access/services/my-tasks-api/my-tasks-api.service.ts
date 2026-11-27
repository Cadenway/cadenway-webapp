import { HttpContext } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import {
  type ListMembersClientResult,
  type ListMyTasksClientResult,
  MembersService,
  MyTasksService,
} from '@cadenway/api-client';
import { firstValueFrom, fromEvent, type Observable, takeUntil } from 'rxjs';

import { PASSIVE_REQUEST } from '@core/api';
import type { Person, TaskSummary } from '@features/task';

import type {
  MyTasksCounts,
  MyTasksPage,
  MyTasksTab,
} from '../../../models/my-tasks-read/my-tasks-read.interface';
import {
  type MemberDto,
  type MyTaskDto,
  toMyTask,
  toMyTasksCounts,
  toPerson,
} from '../../adapters/my-task/my-task.adapter';

/**
 * Constant PAGE_SIZE
 *
 * @description
 * Tasks and members asked per page, the gateway's maximum.
 *
 * @type {number}
 */
const PAGE_SIZE: number = 100;

/**
 * Interface MyTasksReadOptions
 *
 * @description
 * How a tab is read.
 */
export interface MyTasksReadOptions {
  // #region Properties
  /**
   * Property passive
   *
   * @description
   * Whether the read was not asked for by the person (a refresh on focus, on a reconnection or
   * after a write): the organization pin then refuses it while its context is stale.
   *
   * @type {boolean}
   * @readonly
   */
  readonly passive: boolean;

  /**
   * Property signal
   *
   * @description
   * Aborts the read, between and during pages.
   *
   * @type {AbortSignal | undefined}
   * @readonly
   */
  readonly signal?: AbortSignal;

  /**
   * Property cursor
   *
   * @description
   * Where the read starts (a `nextCursor`), or the tab's start when omitted.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly cursor?: string;

  /**
   * Property pages
   *
   * @description
   * How many pages to read at most, or every page to the last cursor when omitted.
   *
   * @type {number | undefined}
   * @readonly
   */
  readonly pages?: number;
  // #endregion
}

/**
 * Class MyTasksPartialReadError
 *
 * @description
 * A read whose first page arrived but a later page failed: `page` holds what was read before the
 * failure, and `cause` is the failure of the later page (an organization pin refusal included).
 */
export class MyTasksPartialReadError extends Error {
  // #region Properties
  /**
   * Property page
   *
   * @description
   * The pages read before the failure, `complete` false and `nextCursor` the page that failed.
   *
   * @type {MyTasksPage}
   * @readonly
   */
  public readonly page: MyTasksPage;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Keeps the partial read and the failure of the later page.
   *
   * @param {MyTasksPage} page - The pages read before the failure.
   * @param {unknown} cause - The failure of the later page.
   * @constructor
   */
  public constructor(page: MyTasksPage, cause: unknown) {
    super('A later page of my tasks could not be read', { cause });
    this.name = 'MyTasksPartialReadError';
    this.page = page;
  }
  // #endregion
}

/**
 * Function abortable
 *
 * @description
 * The first value of a request, abandoned when the signal aborts.
 *
 * @param {Observable<T>} source - The request.
 * @param {AbortSignal | undefined} signal - The abort signal, if any.
 * @returns {Promise<T>} The answer.
 */
function abortable<T>(source: Observable<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  return firstValueFrom(signal ? source.pipe(takeUntil(fromEvent(signal, 'abort'))) : source);
}

/**
 * Service MyTasksApi
 *
 * @description
 * The reads of `My tasks` through `@cadenway/api-client`: the caller's assigned tasks of one tab
 * (`MyTasksService.listMyTasks`, to a given depth or to the last cursor) and the organization's members
 * the task menu assigns (`MembersService.listMembers`). It returns display models only.
 */
@Service()
export class MyTasksApi {
  // #region Properties
  /**
   * Property myTasks
   *
   * @description
   * The generated client of `/v1/me/tasks`.
   *
   * @type {MyTasksService}
   * @readonly
   */
  private readonly myTasks: MyTasksService = inject(MyTasksService);

  /**
   * Property members
   *
   * @description
   * The generated client of the organization's members.
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
   * Reads one tab without the browser cache, from its start (or from `cursor`) for `pages` pages,
   * or to its last page when `pages` is omitted. A task a later page repeats (the order shifted
   * between pages) is kept once, where it came first. A failure of the first page rejects with its
   * error; a failure of a later page rejects with `MyTasksPartialReadError`, which carries the
   * pages read before it (`complete` false, `nextCursor` the page that failed) and the failure as
   * its `cause`, so the caller decides whether a partial result may be shown. An aborted read
   * always rejects with the abort.
   *
   * @param {MyTasksTab} tab - The tab (`state`).
   * @param {MyTasksReadOptions} options - Passive flag, abort signal, start and depth.
   * @returns {Promise<MyTasksPage>} The tasks, the counts of both tabs and the next cursor.
   * @throws {MyTasksPartialReadError} When a page after the first fails.
   */
  public async read(tab: MyTasksTab, options: MyTasksReadOptions): Promise<MyTasksPage> {
    const context: HttpContext = new HttpContext().set(PASSIVE_REQUEST, options.passive);
    const page: (cursor: string | undefined) => Promise<ListMyTasksClientResult> = (
      cursor: string | undefined,
    ): Promise<ListMyTasksClientResult> =>
      abortable(
        this.myTasks.listMyTasks(
          { state: tab, limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) },
          { context, cache: 'no-store' },
        ),
        options.signal,
      );
    const first: ListMyTasksClientResult = await page(options.cursor);
    const tasks: Map<string, TaskSummary> = new Map<string, TaskSummary>();
    const add: (items: readonly MyTaskDto[]) => void = (items: readonly MyTaskDto[]): void => {
      for (const item of items) if (!tasks.has(item.key)) tasks.set(item.key, toMyTask(item));
    };
    add(first.items);
    let counts: MyTasksCounts = toMyTasksCounts(first.counts);
    let cursor: string | null = first.nextCursor;
    let pages: number = 1;
    while (cursor !== null && (options.pages === undefined || pages < options.pages)) {
      let next: ListMyTasksClientResult;
      try {
        next = await page(cursor);
      } catch (error: unknown) {
        if (options.signal?.aborted) throw error;
        throw new MyTasksPartialReadError(
          { tasks: [...tasks.values()], counts, complete: false, nextCursor: cursor, pages },
          error,
        );
      }
      add(next.items);
      counts = toMyTasksCounts(next.counts);
      cursor = next.nextCursor;
      pages += 1;
    }
    return { tasks: [...tasks.values()], counts, complete: true, nextCursor: cursor, pages };
  }

  /**
   * Method people
   *
   * @description
   * Reads the owners, admins and members of the organization to the last page, the people the
   * task menu's `Assign` offers (guests are not assignable from it, as in Task's create dialog).
   *
   * @param {AbortSignal} [signal] - Aborts the read.
   * @returns {Promise<readonly Person[]>} The people, in the gateway's order.
   */
  public async people(signal?: AbortSignal): Promise<readonly Person[]> {
    const people: Person[] = [];
    let cursor: string | undefined;
    do {
      const page: ListMembersClientResult = await abortable(
        this.members.listMembers(
          { limit: PAGE_SIZE, role: ['owner', 'admin', 'member'], ...(cursor ? { cursor } : {}) },
          { context: new HttpContext().set(PASSIVE_REQUEST, true) },
        ),
        signal,
      );
      people.push(...page.items.map((member: MemberDto): Person => toPerson(member)));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return people;
  }
  // #endregion
}
