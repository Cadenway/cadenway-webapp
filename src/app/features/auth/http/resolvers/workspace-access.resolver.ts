import { inject } from '@angular/core';
import { RedirectCommand, Router } from '@angular/router';
import { map, type Observable } from 'rxjs';

import { AuthEntryService } from '../../data-access/services/entry/auth-entry.service';
import type { OrganizationEntry } from '../../models/auth/auth.interface';
import type { AuthResult } from '../../models/auth/auth.type';
import { accessDestination } from '../../navigation/access-destination.util';

/**
 * Function resolveWorkspaceAccess
 *
 * @description
 * Gives the workspace status page a freshly verified organization or an error it can retry.
 *
 * @returns {Observable<AuthResult<OrganizationEntry> | RedirectCommand>} The workspace or a recovery route.
 */
export function resolveWorkspaceAccess(): Observable<
  AuthResult<OrganizationEntry> | RedirectCommand
> {
  const router: Router = inject(Router);
  return inject(AuthEntryService)
    .currentOrganization()
    .pipe(
      map((result) => {
        if (!result.ok) {
          const destination: string | null = accessDestination(result.problem);
          if (destination) {
            return new RedirectCommand(router.parseUrl(destination), { replaceUrl: true });
          }
        }
        return result;
      }),
    );
}
