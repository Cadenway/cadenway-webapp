import { inject } from '@angular/core';
import { RedirectCommand, Router } from '@angular/router';
import { map, type Observable } from 'rxjs';

import { AuthEntryService } from '../../data-access/services/entry/auth-entry.service';
import { accessDestination } from '../../navigation/access-destination.util';

/**
 * Function resolveOrganizationId
 *
 * @description
 * Pins the routed resource to the gateway's active organization at navigation.
 *
 * @returns {Observable<string | RedirectCommand>} The expected organization or a recovery route.
 */
export function resolveOrganizationId(): Observable<string | RedirectCommand> {
  const router: Router = inject(Router);
  return inject(AuthEntryService)
    .currentOrganization()
    .pipe(
      map((result) =>
        result.ok
          ? result.value.id
          : new RedirectCommand(router.parseUrl(accessDestination(result.problem) ?? '/accueil')),
      ),
    );
}
