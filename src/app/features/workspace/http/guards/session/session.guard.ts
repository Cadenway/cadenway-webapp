import { inject } from '@angular/core';
import {
  type ActivatedRouteSnapshot,
  type CanActivateFn,
  Router,
  type RouterStateSnapshot,
  type UrlTree,
} from '@angular/router';
import { map, type Observable } from 'rxjs';

import { WorkspaceSession } from '../../../data-access/services/workspace-session/workspace-session.service';
import type {
  WorkspaceResult,
  WorkspaceUser,
} from '../../../models/workspace-context/workspace-context.interface';
import { accessRedirect } from '../../../navigation/access-redirect/access-redirect.util';
import { WorkspaceContextStore } from '../../../state/workspace-context/workspace-context.store';

/**
 * Function sessionGuard
 *
 * @description
 * Requires a signed-in session before a workspace route activates, and keeps the person it read
 * for the workspace resolver. A `401` goes to `/login?returnUrl=<url>`; any other failure goes to
 * the organization choice. Use it on the route that provides `WorkspaceContextStore`.
 *
 * @param {ActivatedRouteSnapshot} _route - Route being activated.
 * @param {RouterStateSnapshot} state - Target router state, whose URL becomes the return URL.
 * @returns {Observable<boolean | UrlTree>} Whether the route may activate, or its redirect.
 */
export const sessionGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
): Observable<boolean | UrlTree> => {
  const router: Router = inject(Router);
  const store: InstanceType<typeof WorkspaceContextStore> = inject(WorkspaceContextStore);
  return inject(WorkspaceSession)
    .currentUser()
    .pipe(
      map((result: WorkspaceResult<WorkspaceUser>): boolean | UrlTree => {
        if (!result.ok) return accessRedirect(router, result.problem, state.url);
        store.verifyUser(result.value);
        return true;
      }),
    );
};
