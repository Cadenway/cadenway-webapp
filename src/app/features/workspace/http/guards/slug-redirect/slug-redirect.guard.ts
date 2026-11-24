import { inject } from '@angular/core';
import {
  type ActivatedRouteSnapshot,
  type CanActivateFn,
  Router,
  type RouterStateSnapshot,
  type UrlTree,
} from '@angular/router';
import { map, type Observable } from 'rxjs';

import { isReservedSlug } from '@core/routing';

import { WorkspaceSession } from '../../../data-access/services/workspace-session/workspace-session.service';
import type {
  WorkspaceOrganization,
  WorkspaceResult,
} from '../../../models/workspace-context/workspace-context.interface';
import {
  accessRedirect,
  organizationChoiceRedirect,
} from '../../../navigation/access-redirect/access-redirect.util';

/**
 * Function slugRedirectGuard
 *
 * @description
 * Redirects a slug-less address of a backend e-mail (`/home`, `/account/:section`...) to the same
 * screen in the session's current organization, keeping the query parameters and the fragment.
 * Without a session it goes to sign-in with the return URL; without a usable current organization,
 * to the organization choice, as for a current organization whose slug is reserved (`/home` would
 * redirect to itself). Put it on a componentless route with `children: []`.
 *
 * @param {readonly string[]} target - Path below `/<slug>`; a segment starting with `:` is replaced by that route parameter (`['account', ':section']`).
 * @returns {CanActivateFn} The guard, which always redirects.
 */
export function slugRedirectGuard(target: readonly string[]): CanActivateFn {
  return (route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<UrlTree> => {
    const router: Router = inject(Router);
    return inject(WorkspaceSession)
      .currentOrganization()
      .pipe(
        map((result: WorkspaceResult<WorkspaceOrganization>): UrlTree => {
          if (!result.ok) return accessRedirect(router, result.problem, state.url);
          if (isReservedSlug(result.value.slug)) return organizationChoiceRedirect(router);
          const segments: string[] = target.map((segment: string): string =>
            segment.startsWith(':') ? (route.paramMap.get(segment.slice(1)) ?? '') : segment,
          );
          return router.createUrlTree(['/', result.value.slug, ...segments], {
            queryParams: route.queryParams,
            fragment: route.fragment ?? undefined,
          });
        }),
      );
  };
}
