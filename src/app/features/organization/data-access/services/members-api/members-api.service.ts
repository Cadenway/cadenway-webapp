import { inject, Service } from '@angular/core';
import {
  type ListMembersParams,
  type Member,
  type MemberPage as MemberPageDto,
  MembersService,
} from '@cadenway/api-client';
import { firstValueFrom, fromEvent, type Observable, takeUntil } from 'rxjs';

import type {
  AssignableMemberRole,
  MemberPage,
  MemberQuery,
  OrganizationMember,
} from '../../../models/member/member.interface';
import { toMemberPage, toOrganizationMember } from '../../adapters/member/member.adapter';

/**
 * Constant COMPLETE_READ_LIMIT
 *
 * @description
 * Page size of a complete read, the largest the contract accepts.
 *
 * @type {number}
 */
const COMPLETE_READ_LIMIT: number = 100;

/**
 * Constant SEARCH_MAX_LENGTH
 *
 * @description
 * Longest `search` the contract accepts.
 *
 * @type {number}
 */
const SEARCH_MAX_LENGTH: number = 100;

/**
 * Function abortable
 *
 * @description
 * Reads the first value of a request, given up when the signal aborts.
 *
 * @template T
 * @param {Observable<T>} source - Request of the generated client.
 * @param {AbortSignal} [signal] - Abort signal of the resource.
 * @returns {Promise<T>} The answer.
 */
function abortable<T>(source: Observable<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  return firstValueFrom(signal ? source.pipe(takeUntil(fromEvent(signal, 'abort'))) : source);
}

/**
 * Function paramsOf
 *
 * @description
 * Turns a query into the parameters of `listMembers`: a blank search and no role are left out.
 *
 * @param {MemberQuery} query - Search and roles.
 * @param {number} limit - Page size.
 * @param {string | null} cursor - Cursor of the page, null for the first.
 * @returns {ListMembersParams} The parameters.
 */
function paramsOf(query: MemberQuery, limit: number, cursor: string | null): ListMembersParams {
  const search: string = query.search.trim().slice(0, SEARCH_MAX_LENGTH);
  return {
    limit,
    ...(cursor === null ? {} : { cursor }),
    ...(search === '' ? {} : { search }),
    ...(query.roles.length === 0 ? {} : { role: [...query.roles] }),
  };
}

/**
 * Service MembersApi
 *
 * @description
 * The organization feature's access to the members of the current organization, mapped to display
 * models. Reads are owner, administrator and member only (a guest gets `403`); writes are owner
 * and administrator only.
 */
@Service()
export class MembersApi {
  // #region Properties
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
   * Method page
   *
   * @description
   * Reads one page of the members matching the query, sorted by name.
   *
   * @param {MemberQuery} query - Search and roles.
   * @param {number} limit - Page size (1 to 100).
   * @param {string | null} cursor - Cursor of the page, null for the first.
   * @param {AbortSignal} [signal] - Abort signal of the resource.
   * @returns {Promise<MemberPage>} The page, its total and the counts by role.
   */
  public async page(
    query: MemberQuery,
    limit: number,
    cursor: string | null,
    signal?: AbortSignal,
  ): Promise<MemberPage> {
    const page: MemberPageDto = await abortable(
      this.members.listMembers(paramsOf(query, limit, cursor)),
      signal,
    );
    return toMemberPage(page);
  }

  /**
   * Method all
   *
   * @description
   * Reads every member matching the query, page after page, for a filter the API does not offer
   * (presence). Its `nextCursor` is null.
   *
   * @param {MemberQuery} query - Search and roles.
   * @param {AbortSignal} [signal] - Abort signal of the resource.
   * @returns {Promise<MemberPage>} Every matching member, the total and the counts by role.
   */
  public async all(query: MemberQuery, signal?: AbortSignal): Promise<MemberPage> {
    const items: OrganizationMember[] = [];
    let cursor: string | null = null;
    let last: MemberPage;
    do {
      last = await this.page(query, COMPLETE_READ_LIMIT, cursor, signal);
      items.push(...last.items);
      cursor = last.nextCursor;
    } while (cursor !== null);
    return { ...last, items, nextCursor: null };
  }

  /**
   * Method changeRole
   *
   * @description
   * Gives a member another role. Rejects with `409 organization.seat-quota-exceeded` when a guest
   * would take a seat beyond the plan, and `422 member.owner-protected` for the owner.
   *
   * @param {string} memberId - The membership.
   * @param {AssignableMemberRole} role - The new role.
   * @returns {Promise<OrganizationMember>} The membership as the API now holds it.
   */
  public async changeRole(
    memberId: string,
    role: AssignableMemberRole,
  ): Promise<OrganizationMember> {
    const member: Member = await firstValueFrom(this.members.changeMemberRole(memberId, { role }));
    return toOrganizationMember(member);
  }

  /**
   * Method remove
   *
   * @description
   * Removes a member from the organization; their tasks stay assigned and a seat is freed.
   *
   * @param {string} memberId - The membership.
   * @returns {Promise<void>} Resolves once removed.
   */
  public async remove(memberId: string): Promise<void> {
    await firstValueFrom(this.members.removeMember(memberId), { defaultValue: undefined });
  }
  // #endregion
}
