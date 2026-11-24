import { inject } from '@angular/core';
import {
  type ActivatedRouteSnapshot,
  Router,
  type RouterStateSnapshot,
  type UrlTree,
} from '@angular/router';

import { authProblem } from '../../../utils/auth-problem/auth-problem.util';
import { AuthApi } from '../../../data-access/services/auth-api/auth-api.service';
import { AuthFlowStore } from '../../../state/auth-flow/auth-flow.store';

/**
 * Function requireSession
 *
 * @description
 * Lets a screen that needs a session open only once the gateway confirms the cookie, and records
 * its account in the flow store so the screen does not read it twice. Without a session (`401`) it
 * redirects to `/login?next=<url>`, so the person comes back after signing in. Any other failure
 * lets the screen open: its own reads show the error with Réessayer.
 *
 * @param {ActivatedRouteSnapshot} _route - The guarded route.
 * @param {RouterStateSnapshot} state - The target router state, whose URL becomes `next`.
 * @returns {Promise<boolean | UrlTree>} True, or the sign-in redirect.
 */
export async function requireSession(
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
): Promise<boolean | UrlTree> {
  const router: Router = inject(Router);
  const flow: AuthFlowStore = inject(AuthFlowStore);
  try {
    flow.setAccount(await inject(AuthApi).currentAccount());
    return true;
  } catch (error: unknown) {
    return authProblem(error).status === 401
      ? router.createUrlTree(['/login'], { queryParams: { next: state.url } })
      : true;
  }
}
