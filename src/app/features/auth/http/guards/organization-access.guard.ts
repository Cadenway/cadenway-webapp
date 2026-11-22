import { inject } from '@angular/core';
import { Router, type UrlTree } from '@angular/router';
import { map, type Observable } from 'rxjs';

import { AuthEntryService } from '../../data-access/services/entry/auth-entry.service';
import { accessDestination } from '../../navigation/access-destination.util';

/**
 * Function requireOrganization
 *
 * @description
 * Requires the gateway to confirm the browser's organization before loading a private feature.
 * The workspace status page offers retry after a temporary failure.
 *
 * @returns {Observable<boolean | UrlTree>} A verified entry or its local recovery route.
 */
export function requireOrganization(): Observable<boolean | UrlTree> {
  const router: Router = inject(Router);
  return inject(AuthEntryService)
    .currentOrganization()
    .pipe(
      map(
        (result) => result.ok || router.parseUrl(accessDestination(result.problem) ?? '/accueil'),
      ),
    );
}
