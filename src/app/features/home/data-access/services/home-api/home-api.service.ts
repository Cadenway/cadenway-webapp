import { HttpContext } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import {
  type GetHomeClientResult,
  type ListMembersClientResult,
  MembersService,
  MyTasksService,
} from '@cadenway/api-client';
import { firstValueFrom, fromEvent, type Observable, takeUntil } from 'rxjs';

import { PASSIVE_REQUEST } from '@core/api';
import type { Person } from '@features/task';

import type { HomeSnapshot } from '../../../models/home-read/home-read.interface';
import { toHomeSnapshot } from '../../adapters/home/home.adapter';
import { type MemberDto, toPerson } from '../../adapters/task-summary/task-summary.adapter';

/**
 * Constant MEMBERS_PAGE_SIZE
 *
 * @description
 * Members asked per page, the gateway's maximum.
 *
 * @type {number}
 */
const MEMBERS_PAGE_SIZE: number = 100;

/**
 * Interface HomeReadOptions
 *
 * @description
 * How the home screen is read.
 */
export interface HomeReadOptions {
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
   * Aborts the read.
   *
   * @type {AbortSignal | undefined}
   * @readonly
   */
  readonly signal?: AbortSignal;
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
 * Service HomeApi
 *
 * @description
 * The reads of the home screen through `@cadenway/api-client`: the caller's counters, priorities,
 * current sprints and lists (`MyTasksService.getHome`) and the organization's members the task
 * menu assigns (`MembersService.listMembers`). It returns display models only.
 */
@Service()
export class HomeApi {
  // #region Properties
  /**
   * Property myTasks
   *
   * @description
   * The generated client of `/v1/me/home`.
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
   * Reads the home screen without the browser cache, counted against `today`. A failure, an abort
   * included, rejects with its error.
   *
   * @param {string} today - The caller's local day (`YYYY-MM-DD`).
   * @param {HomeReadOptions} options - Passive flag and abort signal.
   * @returns {Promise<HomeSnapshot>} The display models.
   */
  public async read(today: string, options: HomeReadOptions): Promise<HomeSnapshot> {
    const home: GetHomeClientResult = await abortable(
      this.myTasks.getHome(
        { today },
        {
          context: new HttpContext().set(PASSIVE_REQUEST, options.passive),
          cache: 'no-store',
        },
      ),
      options.signal,
    );
    return toHomeSnapshot(home);
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
          {
            limit: MEMBERS_PAGE_SIZE,
            role: ['owner', 'admin', 'member'],
            ...(cursor ? { cursor } : {}),
          },
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
