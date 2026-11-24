import { inject, Service } from '@angular/core';
import {
  AuthService,
  type CurrentUser,
  type MyOrganization,
  type MyOrganizationPage,
  type Organization,
  OrganizationsService,
} from '@cadenway/api-client';
import { catchError, EMPTY, expand, map, type Observable, of, reduce } from 'rxjs';

import { type ApiProblem, readProblem } from '@core/api';
import { withSessionLock } from '@features/auth';

import type {
  WorkspaceOrganization,
  WorkspaceResult,
  WorkspaceUser,
} from '../../../models/workspace-context/workspace-context.interface';
import {
  toWorkspaceOrganization,
  toWorkspaceUser,
} from '../../adapters/workspace-context/workspace-context.adapter';

/**
 * Function workspaceResult
 *
 * @description
 * Turns a gateway failure into a typed problem the guards can branch on, and keeps the request
 * cancellable by its subscriber. A failure that is not an HTTP response, such as an unavailable
 * browser lock, has status zero and no code.
 *
 * @template T
 * @param {Observable<T>} request - Request already mapped to a display model.
 * @returns {Observable<WorkspaceResult<T>>} The value, or the problem.
 */
function workspaceResult<T>(request: Observable<T>): Observable<WorkspaceResult<T>> {
  return request.pipe(
    map((value: T): WorkspaceResult<T> => ({ ok: true, value })),
    catchError((error: unknown) => {
      const problem: ApiProblem | null = readProblem(error);
      return of<WorkspaceResult<T>>({
        ok: false,
        problem: { status: problem?.status ?? 0, code: problem?.code ?? null },
      });
    }),
  );
}

/**
 * Service WorkspaceSession
 *
 * @description
 * Reads the signed-in person and their organizations, and changes the session's current
 * organization, for the workspace guards. Every method returns display models or the gateway's
 * problem; none caches anything, so a guard always sees the session as the gateway knows it.
 */
@Service()
export class WorkspaceSession {
  // #region Properties
  /**
   * Property auth
   *
   * @description
   * Generated account operations.
   *
   * @type {AuthService}
   * @readonly
   */
  private readonly auth: AuthService = inject(AuthService);

  /**
   * Property organizations
   *
   * @description
   * Generated organization and session-organization operations.
   *
   * @type {OrganizationsService}
   * @readonly
   */
  private readonly organizations: OrganizationsService = inject(OrganizationsService);
  // #endregion

  // #region Methods
  /**
   * Method currentUser
   *
   * @description
   * Reads the signed-in account. A missing or expired session answers `401`.
   *
   * @returns {Observable<WorkspaceResult<WorkspaceUser>>} The person, or the problem.
   */
  public currentUser(): Observable<WorkspaceResult<WorkspaceUser>> {
    return workspaceResult(
      this.auth.getCurrentUser().pipe(map((user: CurrentUser) => toWorkspaceUser(user))),
    );
  }

  /**
   * Method currentOrganization
   *
   * @description
   * Reads the session's current organization, bypassing the HTTP cache since another tab may have
   * switched it. Without one the gateway answers `403 organization.not-selected`.
   *
   * @returns {Observable<WorkspaceResult<WorkspaceOrganization>>} The organization, or the problem.
   */
  public currentOrganization(): Observable<WorkspaceResult<WorkspaceOrganization>> {
    return workspaceResult(
      this.organizations
        .getCurrentOrganization({ cache: 'no-store' })
        .pipe(map((organization: Organization) => toWorkspaceOrganization(organization))),
    );
  }

  /**
   * Method myOrganizations
   *
   * @description
   * Reads every page of the caller's organizations, following `nextCursor` until the last page.
   *
   * @returns {Observable<WorkspaceResult<readonly WorkspaceOrganization[]>>} All organizations, or the problem of the first failing page.
   */
  public myOrganizations(): Observable<WorkspaceResult<readonly WorkspaceOrganization[]>> {
    return workspaceResult(
      this.organizations.listMyOrganizations({ limit: 100 }).pipe(
        expand((page: MyOrganizationPage) =>
          page.nextCursor
            ? this.organizations.listMyOrganizations({ cursor: page.nextCursor, limit: 100 })
            : EMPTY,
        ),
        reduce(
          (all: readonly WorkspaceOrganization[], page: MyOrganizationPage) => [
            ...all,
            ...page.items.map((organization: MyOrganization) =>
              toWorkspaceOrganization(organization),
            ),
          ],
          [] as readonly WorkspaceOrganization[],
        ),
      ),
    );
  }

  /**
   * Method switchOrganization
   *
   * @description
   * Makes an organization of the caller the session's current organization. It takes no lock
   * itself: call it inside `exclusive`, together with the read that decided the switch, so the
   * read and the switch never interleave with a sign-in, a sign-out, a switch or a protected write
   * of another tab.
   *
   * @param {string} organizationId - Organization the caller belongs to.
   * @returns {Observable<WorkspaceResult<void>>} Completion, or the problem.
   */
  public switchOrganization(organizationId: string): Observable<WorkspaceResult<void>> {
    return workspaceResult(
      this.organizations.switchOrganization({ organizationId }).pipe(map((): void => undefined)),
    );
  }

  /**
   * Method exclusive
   *
   * @description
   * Runs a sequence of session reads and writes under one exclusive browser session lock. Once the
   * lock is granted the whole sequence runs to its end, even if the subscriber unsubscribes (a
   * cancelled navigation), so a read is never followed by half a switch. Without Web Locks the
   * sequence is not started and the result is status zero.
   *
   * @template T
   * @param {() => Observable<WorkspaceResult<T>>} operation - The sequence; it emits once.
   * @returns {Observable<WorkspaceResult<T>>} The sequence's result, or the lock failure.
   */
  public exclusive<T>(
    operation: () => Observable<WorkspaceResult<T>>,
  ): Observable<WorkspaceResult<T>> {
    return withSessionLock(operation, 'exclusive').pipe(
      catchError(() => of<WorkspaceResult<T>>({ ok: false, problem: { status: 0, code: null } })),
    );
  }
  // #endregion
}
