import { inject } from '@angular/core';
import {
  type ActivatedRouteSnapshot,
  type CanActivateFn,
  RedirectCommand,
  Router,
  type UrlSegment,
} from '@angular/router';

import { LAYOUT_SEGMENTS } from '../../../constants/view-layouts/view-layouts.constants';
import { RELEASED_VIEWS } from '../../../constants/released-views/released-views.token';
import type { ViewLayout } from '../../../models/saved-view/saved-view.interface';

/**
 * Function releasedLayoutGuard
 *
 * @description
 * Lets a view route open only when its layout is released (`RELEASED_VIEWS`); otherwise it
 * replaces the address with the list's `list` view, keeping the query parameters (a
 * `?savedView=` still applies there) and the fragment. Put it on each view route below
 * `l/:listId` except `list`, which is always released.
 *
 * @param {ViewLayout} layout - Layout of the guarded route.
 * @returns {CanActivateFn} The guard.
 */
export function releasedLayoutGuard(layout: ViewLayout): CanActivateFn {
  return (route: ActivatedRouteSnapshot): true | RedirectCommand => {
    if (inject(RELEASED_VIEWS).layouts.includes(layout)) return true;
    const parent: readonly string[] = route.pathFromRoot
      .slice(0, -1)
      .flatMap((item: ActivatedRouteSnapshot): string[] =>
        item.url.map((segment: UrlSegment): string => segment.path),
      );
    const router: Router = inject(Router);
    return new RedirectCommand(
      router.createUrlTree(['/', ...parent, LAYOUT_SEGMENTS.list], {
        queryParams: route.queryParams,
        fragment: route.fragment ?? undefined,
      }),
      { replaceUrl: true },
    );
  };
}
