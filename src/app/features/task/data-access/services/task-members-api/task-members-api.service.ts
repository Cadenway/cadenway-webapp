import { inject, Service } from '@angular/core';
import { type ListMembersClientResult, MembersService } from '@cadenway/api-client';
import { defer, EMPTY, expand, map, type Observable, reduce, share } from 'rxjs';

import type { Person } from '../../../models/person/person.interface';
import { toPerson } from '../../adapters/person/person.adapter';

/**
 * Constant PAGE_SIZE
 *
 * @description
 * Members asked per page of the directory.
 *
 * @type {number}
 */
const PAGE_SIZE: number = 100;

/**
 * Constant ASSIGNABLE_ROLES
 *
 * @description
 * The roles a task can be assigned to: every member but guests, whom the gateway refuses as
 * assignees (`422 task.assignee-invalid`).
 *
 * @type {ReadonlySet<string>}
 */
const ASSIGNABLE_ROLES: ReadonlySet<string> = new Set<string>(['owner', 'admin', 'member']);

/**
 * Type DirectoryMember
 *
 * @description
 * A member of the organization's directory, as the gateway lists it.
 *
 * @type {ListMembersClientResult['items'][number]}
 */
type DirectoryMember = ListMembersClientResult['items'][number];

/**
 * Service TaskMembersApi
 *
 * @description
 * The organization's member directory for the task feature, read to its last page. Readers that
 * ask while a read runs share it (the task detail's sections and properties panel open together),
 * so the directory is read once per opening; a read asked after the last one ended reads again,
 * so nothing is kept beyond the read in flight. Every method returns display models.
 */
@Service()
export class TaskMembersApi {
  // #region Properties
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

  /**
   * Property directory
   *
   * @description
   * Every member of the organization, every page read in turn; the read in flight is shared by
   * its readers and dropped once it ends, fails or loses its last reader.
   *
   * @type {Observable<readonly DirectoryMember[]>}
   * @readonly
   */
  private readonly directory: Observable<readonly DirectoryMember[]> = defer(() =>
    this.page(undefined).pipe(
      expand((current: ListMembersClientResult) =>
        current.nextCursor ? this.page(current.nextCursor) : EMPTY,
      ),
      reduce<ListMembersClientResult, readonly DirectoryMember[]>(
        (items: readonly DirectoryMember[], current: ListMembersClientResult) => [
          ...items,
          ...current.items,
        ],
        [],
      ),
    ),
  ).pipe(share());
  // #endregion

  // #region Methods
  /**
   * Method people
   *
   * @description
   * Every member of the organization, guests included (names of the activity, the approval and
   * the participants).
   *
   * @returns {Observable<readonly Person[]>} The people, in the gateway's order.
   */
  public people(): Observable<readonly Person[]> {
    return this.directory.pipe(
      map((members: readonly DirectoryMember[]): readonly Person[] => members.map(toPerson)),
    );
  }

  /**
   * Method assignable
   *
   * @description
   * The members a task can be assigned to: the directory without its guests.
   *
   * @returns {Observable<readonly Person[]>} The people, in the gateway's order.
   */
  public assignable(): Observable<readonly Person[]> {
    return this.directory.pipe(
      map((members: readonly DirectoryMember[]): readonly Person[] =>
        members
          .filter((member: DirectoryMember): boolean => ASSIGNABLE_ROLES.has(member.role))
          .map(toPerson),
      ),
    );
  }

  /**
   * Method page
   *
   * @description
   * One page of the directory.
   *
   * @param {string | undefined} cursor - Cursor of the page, undefined for the first.
   * @returns {Observable<ListMembersClientResult>} The page.
   */
  private page(cursor: string | undefined): Observable<ListMembersClientResult> {
    return this.members.listMembers({ limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) });
  }
  // #endregion
}
