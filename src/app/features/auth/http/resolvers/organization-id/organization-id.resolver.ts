import { inject } from '@angular/core';
import { RedirectCommand, Router } from '@angular/router';

import { authProblem } from '../../../utils/auth-problem/auth-problem.util';
import { OrganizationApi } from '../../../data-access/services/organization-api/organization-api.service';

/**
 * Function resolveOrganizationId
 *
 * @description
 * Transitional resolver for the routes still mounted outside the workspace (`spaces`, `task`): it
 * pins the routed resource to the session's current organization at navigation, and otherwise
 * redirects to `/login` (`401`) or `/organizations`. The workspace feature's context resolver
 * under `/:org` replaces it; remove it with its last consumer.
 *
 * @returns {Promise<string | RedirectCommand>} The organization id, or the recovery redirect.
 */
export async function resolveOrganizationId(): Promise<string | RedirectCommand> {
  const router: Router = inject(Router);
  try {
    return (await inject(OrganizationApi).current()).id;
  } catch (error: unknown) {
    return new RedirectCommand(
      router.parseUrl(authProblem(error).status === 401 ? '/login' : '/organizations'),
    );
  }
}
