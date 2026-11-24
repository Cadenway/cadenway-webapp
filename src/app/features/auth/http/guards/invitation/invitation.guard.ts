import { inject } from '@angular/core';
import { type ActivatedRouteSnapshot, Router, type UrlTree } from '@angular/router';

import { authProblem } from '../../../utils/auth-problem/auth-problem.util';
import { AuthApi } from '../../../data-access/services/auth-api/auth-api.service';

/**
 * Function openInvitation
 *
 * @description
 * Resolves the invitation link of the e-mails (`/invite/:invitationId`), which renders nothing
 * itself. Signed in, it opens `/organizations?invitation=<id>`, where the invitation stands out;
 * signed out (`401`), it opens `/login?next=/invite/<id>` so the link is followed again after
 * sign-in.
 *
 * @param {ActivatedRouteSnapshot} route - The invitation route, with `invitationId`.
 * @returns {Promise<UrlTree>} The chooser or the sign-in redirect.
 */
export async function openInvitation(route: ActivatedRouteSnapshot): Promise<UrlTree> {
  const router: Router = inject(Router);
  const invitationId: string = route.paramMap.get('invitationId') ?? '';
  try {
    await inject(AuthApi).currentAccount();
  } catch (error: unknown) {
    if (authProblem(error).status === 401) {
      return router.createUrlTree(['/login'], {
        queryParams: { next: `/invite/${encodeURIComponent(invitationId)}` },
      });
    }
  }
  return router.createUrlTree(['/organizations'], { queryParams: { invitation: invitationId } });
}
