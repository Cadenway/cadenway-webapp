import { inject } from '@angular/core';
import { Router, type UrlTree } from '@angular/router';

import { authProblem } from '../../../utils/auth-problem/auth-problem.util';
import { OrganizationApi } from '../../../data-access/services/organization-api/organization-api.service';

/**
 * Function requireOrganization
 *
 * @description
 * Transitional guard for the routes still mounted outside the workspace (`errors`, `spaces`): it
 * lets a route open once the gateway confirms the session's current organization, and otherwise
 * redirects to `/login` (`401`) or `/organizations`. The workspace feature's session and slug
 * guards under `/:org` replace it; remove it with its last consumer.
 *
 * @returns {Promise<boolean | UrlTree>} True, or the recovery redirect.
 */
export async function requireOrganization(): Promise<boolean | UrlTree> {
  const router: Router = inject(Router);
  try {
    await inject(OrganizationApi).current();
    return true;
  } catch (error: unknown) {
    return router.parseUrl(authProblem(error).status === 401 ? '/login' : '/organizations');
  }
}
