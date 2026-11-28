import { inject, Service } from '@angular/core';
import { type ListMembersClientResult, MembersService } from '@cadenway/api-client';
import {
  defer,
  EMPTY,
  expand,
  finalize,
  map,
  type Observable,
  reduce,
  share,
  tap,
  throwError,
} from 'rxjs';

import { OrganizationPin, OrganizationSwitchPendingError } from '@core/api';

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
 * Interface SharedDirectoryRead
 *
 * @description
 * The directory read in flight and the organization context it was begun in.
 */
interface SharedDirectoryRead {
  // #region Properties
  /**
   * Property context
   *
   * @description
   * The organization id and pin revision (`OrganizationPin`) when the read began.
   *
   * @type {string}
   * @readonly
   */
  readonly context: string;

  /**
   * Property read
   *
   * @description
   * The read, shared by the readers of that context.
   *
   * @type {Observable<readonly DirectoryMember[]>}
   * @readonly
   */
  readonly read: Observable<readonly DirectoryMember[]>;
  // #endregion
}

/**
 * Service TaskMembersApi
 *
 * @description
 * The organization's member directory for the task feature, read to its last page. Readers that
 * ask while a read runs in the same organization context share it (the task detail's sections and
 * properties panel open together), so the directory is read once per opening; a read asked after
 * the last one ended reads again, so nothing is kept beyond the read in flight. A read is bound to
 * the organization id and pin revision it began with: once the context changes it requests no
 * further page and fails with `OrganizationSwitchPendingError`, and a reader in the new context
 * starts its own read. Every method returns display models.
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
   * Property pin
   *
   * @description
   * The workspace organization and its revision, which fence the shared read.
   *
   * @type {OrganizationPin}
   * @readonly
   */
  private readonly pin: OrganizationPin = inject(OrganizationPin);

  /**
   * Property shared
   *
   * @description
   * The read in flight, dropped once it ends, fails or loses its last reader.
   *
   * @type {SharedDirectoryRead | null}
   */
  private shared: SharedDirectoryRead | null = null;
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
    return this.directory().pipe(
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
    return this.directory().pipe(
      map((members: readonly DirectoryMember[]): readonly Person[] =>
        members
          .filter((member: DirectoryMember): boolean => ASSIGNABLE_ROLES.has(member.role))
          .map(toPerson),
      ),
    );
  }

  /**
   * Method directory
   *
   * @description
   * Every member of the organization: joins the read in flight of the current organization
   * context, or begins one bound to it.
   *
   * @returns {Observable<readonly DirectoryMember[]>} The members, every page read in turn.
   */
  private directory(): Observable<readonly DirectoryMember[]> {
    return defer((): Observable<readonly DirectoryMember[]> => {
      const context: string = this.context();
      if (this.shared?.context === context) return this.shared.read;
      const read: Observable<readonly DirectoryMember[]> = this.readAll(context).pipe(
        finalize((): void => {
          if (this.shared?.read === read) this.shared = null;
        }),
        share(),
      );
      this.shared = { context, read };
      return read;
    });
  }

  /**
   * Method readAll
   *
   * @description
   * Reads every page in the given organization context, failing before a page is requested or
   * used once the context has changed.
   *
   * @param {string} context - The organization context of the read.
   * @returns {Observable<readonly DirectoryMember[]>} The members.
   */
  private readAll(context: string): Observable<readonly DirectoryMember[]> {
    return this.page(context, undefined).pipe(
      expand((current: ListMembersClientResult) =>
        current.nextCursor ? this.page(context, current.nextCursor) : EMPTY,
      ),
      reduce<ListMembersClientResult, readonly DirectoryMember[]>(
        (items: readonly DirectoryMember[], current: ListMembersClientResult) => [
          ...items,
          ...current.items,
        ],
        [],
      ),
    );
  }

  /**
   * Method page
   *
   * @description
   * One page of the directory, requested and answered within the read's organization context.
   *
   * @param {string} context - The organization context of the read.
   * @param {string | undefined} cursor - Cursor of the page, undefined for the first.
   * @returns {Observable<ListMembersClientResult>} The page.
   */
  private page(context: string, cursor: string | undefined): Observable<ListMembersClientResult> {
    return defer((): Observable<ListMembersClientResult> =>
      this.context() === context
        ? this.members.listMembers({ limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) })
        : throwError(() => new OrganizationSwitchPendingError()),
    ).pipe(
      tap((): void => {
        if (this.context() !== context) throw new OrganizationSwitchPendingError();
      }),
    );
  }

  /**
   * Method context
   *
   * @description
   * The current organization context: its id and the pin revision.
   *
   * @returns {string} The context key.
   */
  private context(): string {
    return `${this.pin.current() ?? ''}#${String(this.pin.revision())}`;
  }
  // #endregion
}
