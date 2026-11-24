import type { Router, UrlTree } from '@angular/router';

import type { WorkspaceProblem } from '../../models/workspace-context/workspace-context.interface';

/**
 * Function signInRedirect
 *
 * @description
 * Sends a caller without a session to Auth's sign-in, which brings them back to `url` once signed
 * in.
 *
 * @param {Router} router - Router building the tree.
 * @param {string} url - Address the caller asked for.
 * @returns {UrlTree} `/login?returnUrl=<url>`.
 */
export function signInRedirect(router: Router, url: string): UrlTree {
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: url } });
}

/**
 * Function organizationChoiceRedirect
 *
 * @description
 * Sends a signed-in caller to Auth's organization choice, which lists their organizations and
 * handles an unavailable gateway with its own retry.
 *
 * @param {Router} router - Router building the tree.
 * @returns {UrlTree} `/organizations`.
 */
export function organizationChoiceRedirect(router: Router): UrlTree {
  return router.createUrlTree(['/organizations']);
}

/**
 * Function accessRedirect
 *
 * @description
 * Recovery route of a failed workspace read: sign-in for a missing session (`401`), the
 * organization choice for anything else.
 *
 * @param {Router} router - Router building the tree.
 * @param {WorkspaceProblem} problem - What the gateway answered.
 * @param {string} url - Address the caller asked for.
 * @returns {UrlTree} The recovery route.
 */
export function accessRedirect(router: Router, problem: WorkspaceProblem, url: string): UrlTree {
  return problem.status === 401 ? signInRedirect(router, url) : organizationChoiceRedirect(router);
}
