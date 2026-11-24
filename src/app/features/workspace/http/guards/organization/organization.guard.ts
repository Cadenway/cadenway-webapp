import { inject } from '@angular/core';
import {
  type ActivatedRouteSnapshot,
  type CanActivateFn,
  Router,
  type RouterStateSnapshot,
  type UrlTree,
} from '@angular/router';
import { map, type Observable, of, switchMap } from 'rxjs';

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
 * - the slug is the current organization's: it passes;
 * - the slug is another organization of the caller: it switches the session to it, then passes;
 * - the slug is unknown, the switch is refused, or the gateway is unavailable: it goes to the
 *   organization choice (`/organizations`); a `401` goes to sign-in with the return URL.
 *
 * Use it with `runGuardsAndResolvers: 'pathParamsChange'` on the route that provides
 * `WorkspaceContextStore`.
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
  const store: InstanceType<typeof WorkspaceContextStore> = inject(WorkspaceContextStore);
  const slug: string = route.paramMap.get('org') ?? '';

  const accept: (organization: WorkspaceOrganization) => true = (
    organization: WorkspaceOrganization,
  ): true => {
    store.verifyOrganization(organization);
    return true;
  };

  const switchTo: () => Observable<boolean | UrlTree> = (): Observable<boolean | UrlTree> =>
    session.myOrganizations().pipe(
      switchMap(
        (
          organizations: WorkspaceResult<readonly WorkspaceOrganization[]>,
        ): Observable<boolean | UrlTree> => {
          if (!organizations.ok) {
            return of(accessRedirect(router, organizations.problem, state.url));
          }
          const match: WorkspaceOrganization | undefined = organizations.value.find(
            (organization: WorkspaceOrganization) => organization.slug === slug,
          );
          if (!match) return of(organizationChoiceRedirect(router));
          return session
            .switchOrganization(match.id)
            .pipe(
              map((switched: WorkspaceResult<void>): boolean | UrlTree =>
                switched.ok ? accept(match) : accessRedirect(router, switched.problem, state.url),
              ),
            );
        },
      ),
    );

  return session.currentOrganization().pipe(
    switchMap((current: WorkspaceResult<WorkspaceOrganization>): Observable<boolean | UrlTree> => {
      if (current.ok) return current.value.slug === slug ? of(accept(current.value)) : switchTo();
      if (mayNameAnotherOrganization(current.problem)) return switchTo();
      return of(accessRedirect(router, current.problem, state.url));
    }),
  );
};
