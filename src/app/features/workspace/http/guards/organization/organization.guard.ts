import { DOCUMENT, inject } from '@angular/core';
import {
  type ActivatedRouteSnapshot,
  type CanActivateFn,
  Router,
  type RouterStateSnapshot,
  type UrlTree,
} from '@angular/router';
import { map, type Observable, of, switchMap } from 'rxjs';

import { OrganizationPin } from '@core/api';
import { isReservedSlug } from '@core/routing';

import { WorkspaceSession } from '../../../data-access/services/workspace-session/workspace-session.service';
import type {
  WorkspaceOrganization,
  WorkspaceProblem,
  WorkspaceResult,
} from '../../../models/workspace-context/workspace-context.interface';
import {
  accessRedirect,
  organizationChoiceRedirect,
} from '../../../navigation/access-redirect/access-redirect.util';
import { WorkspaceContextStore } from '../../../state/workspace-context/workspace-context.store';
import { WORKSPACE_RECOVERY_NAVIGATION } from '../../../providers/workspace-runtime/workspace-revalidation.service';

/**
 * Constant SWITCHABLE_CODES
 *
 * @description
 * Refusals of the current-organization read after which the slug may still name another
 * organization of the caller: no current organization, a current organization that requires
 * two-step verification, or one the caller left.
 *
 * @type {ReadonlySet<string>}
 */
const SWITCHABLE_CODES: ReadonlySet<string> = new Set([
  'organization.not-selected',
  'organization.mfa-required',
  'organization.not-found',
]);

/**
 * Constant UNKNOWN_SLUG
 *
 * @description
 * Result of a slug that names none of the caller's organizations.
 *
 * @type {WorkspaceResult<WorkspaceOrganization>}
 */
const UNKNOWN_SLUG: WorkspaceResult<WorkspaceOrganization> = {
  ok: false,
  problem: { status: 404, code: 'organization.not-found' },
};

/**
 * Constant RECOVERY_DEFERRED
 *
 * @description
 * Local guard result that cancels recovery after the document leaves the foreground.
 *
 * @type {WorkspaceResult<WorkspaceOrganization>}
 */
const RECOVERY_DEFERRED: WorkspaceResult<WorkspaceOrganization> = {
  ok: false,
  problem: { status: 0, code: null },
};

/**
 * Function mayNameAnotherOrganization
 *
 * @description
 * Whether a failed current-organization read still lets the guard look the slug up among the
 * caller's organizations.
 *
 * @param {WorkspaceProblem} problem - What the gateway answered.
 * @returns {boolean} Whether to look the slug up.
 */
function mayNameAnotherOrganization(problem: WorkspaceProblem): boolean {
  return problem.status === 404 || (problem.code !== null && SWITCHABLE_CODES.has(problem.code));
}

/**
 * Function organizationGuard
 *
 * @description
 * Makes the organization named by the `:org` slug the session's current organization before the
 * workspace activates, and keeps it for the workspace resolver:
 * - the slug is reserved (`login`, `home`... see `RESERVED_SLUGS`): it goes to the organization
 *   choice without reading the gateway;
 * - the slug is the current organization's: it passes;
 * - the slug is another organization of the caller: it switches the session to it, then passes;
 * - the slug is unknown, the switch is refused, or the gateway is unavailable: it goes to the
 *   organization choice (`/organizations`); a `401` goes to sign-in with the return URL.
 *
 * The current-organization read, the lookup and the switch run under one exclusive session lock,
 * so another tab cannot switch in between. A recovery navigation that leaves the foreground before
 * dispatching a switch is cancelled; a dispatched switch completes even if navigation is cancelled.
 * The store only takes the organization when the guard answers.
 *
 * Use it on the route that provides `WorkspaceContextStore` and reruns guards for organization
 * changes and requested context revalidation.
 *
 * @param {ActivatedRouteSnapshot} route - Route whose `org` parameter is the slug.
 * @param {RouterStateSnapshot} state - Target router state, whose URL becomes the return URL.
 * @returns {Observable<boolean | UrlTree>} Whether the route may activate, or its redirect.
 */
export const organizationGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
): Observable<boolean | UrlTree> => {
  const router: Router = inject(Router);
  const session: WorkspaceSession = inject(WorkspaceSession);
  const pin: OrganizationPin = inject(OrganizationPin);
  const document: Document = inject(DOCUMENT);
  const recovery: boolean =
    router.currentNavigation()?.extras.info === WORKSPACE_RECOVERY_NAVIGATION;
  const store: InstanceType<typeof WorkspaceContextStore> = inject(WorkspaceContextStore);
  const slug: string = route.paramMap.get('org') ?? '';
  if (isReservedSlug(slug)) return of(organizationChoiceRedirect(router));

  const switchTo: () => Observable<WorkspaceResult<WorkspaceOrganization>> = (): Observable<
    WorkspaceResult<WorkspaceOrganization>
  > =>
    session.myOrganizations().pipe(
      switchMap(
        (
          organizations: WorkspaceResult<readonly WorkspaceOrganization[]>,
        ): Observable<WorkspaceResult<WorkspaceOrganization>> => {
          if (!organizations.ok) return of(organizations);
          const match: WorkspaceOrganization | undefined = organizations.value.find(
            (organization: WorkspaceOrganization) => organization.slug === slug,
          );
          if (!match) return of(UNKNOWN_SLUG);
          if (recovery && (document.visibilityState !== 'visible' || !document.hasFocus()))
            return of(RECOVERY_DEFERRED);
          pin.beginSwitch();
          return session
            .switchOrganization(match.id)
            .pipe(
              map((switched: WorkspaceResult<void>): WorkspaceResult<WorkspaceOrganization> =>
                switched.ok ? { ok: true, value: match } : switched,
              ),
            );
        },
      ),
    );

  const enter: () => Observable<WorkspaceResult<WorkspaceOrganization>> = (): Observable<
    WorkspaceResult<WorkspaceOrganization>
  > =>
    session.currentOrganization().pipe(
      switchMap(
        (
          current: WorkspaceResult<WorkspaceOrganization>,
        ): Observable<WorkspaceResult<WorkspaceOrganization>> => {
          if (current.ok) return current.value.slug === slug ? of(current) : switchTo();
          return mayNameAnotherOrganization(current.problem) ? switchTo() : of(current);
        },
      ),
    );

  return session.exclusive(enter).pipe(
    map((result: WorkspaceResult<WorkspaceOrganization>): boolean | UrlTree => {
      if (result === RECOVERY_DEFERRED) return false;
      if (!result.ok) return accessRedirect(router, result.problem, state.url);
      store.verifyOrganization(result.value);
      return true;
    }),
  );
};
