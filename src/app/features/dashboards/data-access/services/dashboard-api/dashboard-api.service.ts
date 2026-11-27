import { HttpContext } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import {
  MembersService,
  TeamReportsService,
  type GetTeamDashboardClientResult,
  type ListMembersClientResult,
} from '@cadenway/api-client';
import { firstValueFrom, fromEvent, type Observable, takeUntil } from 'rxjs';

import { PASSIVE_REQUEST } from '@core/api';
import { personOf, type Person } from '@features/task';

import type {
  DashboardWeeks,
  TeamDashboard,
} from '../../../models/team-dashboard/team-dashboard.interface';
import { toTeamDashboard } from '../../adapters/team-dashboard/team-dashboard.adapter';

/**
 * Constant MEMBER_PAGE_LIMIT
 *
 * @description
 * Members asked of the gateway per page.
 *
 * @type {number}
 */
const MEMBER_PAGE_LIMIT: number = 100;

/**
 * Constant MAX_MEMBER_PAGES
 *
 * @description
 * Member pages read at most (10,000 members): a cursor still given past them, or given twice,
 * fails the read rather than keep the page reading.
 *
 * @type {number}
 */
const MAX_MEMBER_PAGES: number = 100;

/**
 * Interface DashboardRequest
 *
 * @description
 * What a dashboard read asks for: the caller's day and time zone, which the service does not
 * know, and the weeks of completions.
 */
export interface DashboardRequest {
  // #region Properties
  /**
   * Property today
   *
   * @description
   * The caller's date, `YYYY-MM-DD`.
   *
   * @type {string}
   * @readonly
   */
  readonly today: string;

  /**
   * Property timeZone
   *
   * @description
   * The caller's IANA time zone.
   *
   * @type {string}
   * @readonly
   */
  readonly timeZone: string;

  /**
   * Property weeks
   *
   * @description
   * Weeks of completions, the current week included.
   *
   * @type {DashboardWeeks}
   * @readonly
   */
  readonly weeks: DashboardWeeks;
  // #endregion
}

/**
 * Function abortable
 *
 * @description
 * The first value of a generated call as a promise that a superseded read cancels.
 *
 * @param {Observable<T>} source - The generated call.
 * @param {AbortSignal | undefined} signal - Cancels the read.
 * @returns {Promise<T>} Its answer.
 */
function abortable<T>(source: Observable<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  return firstValueFrom(signal ? source.pipe(takeUntil(fromEvent(signal, 'abort'))) : source);
}

/**
 * Service DashboardApi
 *
 * @description
 * The dashboard's reads: `getTeamDashboard` (`reports.yaml`), always past the HTTP cache since
 * every task change moves it, and fenced as a background read when it refreshes the page; and
 * `listMembers` to its last page, which names the assignees.
 */
@Service()
export class DashboardApi {
  // #region Properties
  /**
   * Property reports
   *
   * @description
   * Generated report operations.
   *
   * @type {TeamReportsService}
   * @readonly
   */
  private readonly reports: TeamReportsService = inject(TeamReportsService);

  /**
   * Property members
   *
   * @description
   * Generated member operations.
   *
   * @type {MembersService}
   * @readonly
   */
  private readonly members: MembersService = inject(MembersService);
  // #endregion

  // #region Methods
  /**
   * Method dashboard
   *
   * @description
   * Reads the team dashboard of the workspace's organization.
   *
   * @param {DashboardRequest} request - The day, time zone and weeks.
   * @param {boolean} passive - Whether the read refreshes the page in the background: it is then
   * refused locally while the workspace context is stale.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<TeamDashboard>} The dashboard.
   */
  public async dashboard(
    request: DashboardRequest,
    passive: boolean,
    signal?: AbortSignal,
  ): Promise<TeamDashboard> {
    const dashboard: GetTeamDashboardClientResult = await abortable(
      this.reports.getTeamDashboard(
        { today: request.today, timeZone: request.timeZone, weeks: request.weeks },
        { cache: 'no-store', context: new HttpContext().set(PASSIVE_REQUEST, passive) },
      ),
      signal,
    );
    return toTeamDashboard(dashboard);
  }

  /**
   * Method people
   *
   * @description
   * Reads every member of the organization, every role, to name the assignees.
   *
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<readonly Person[]>} The members as people.
   * @throws {Error} When the pages do not end.
   */
  public async people(signal?: AbortSignal): Promise<readonly Person[]> {
    const people: Person[] = [];
    const given: Set<string> = new Set<string>();
    let cursor: string | null = null;
    for (let page: number = 0; page === 0 || cursor !== null; page += 1) {
      if (cursor !== null && (given.has(cursor) || page >= MAX_MEMBER_PAGES))
        throw new Error('The member list could not be read to its end.');
      if (cursor !== null) given.add(cursor);
      const members: ListMembersClientResult = await abortable(
        this.members.listMembers({
          limit: MEMBER_PAGE_LIMIT,
          ...(cursor === null ? {} : { cursor }),
        }),
        signal,
      );
      people.push(...members.items.map((member): Person => personOf(member.userId, member.name)));
      cursor = members.nextCursor ?? null;
    }
    return people;
  }
  // #endregion
}
