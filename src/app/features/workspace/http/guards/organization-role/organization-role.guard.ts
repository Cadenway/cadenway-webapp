import { inject } from '@angular/core';
import {
  type ActivatedRouteSnapshot,
  type CanActivateFn,
  Router,
  type UrlTree,
} from '@angular/router';

import type { OrganizationRoleFallback } from '../../../models/organization-role-fallback/organization-role-fallback.interface';
import type { WorkspaceRole } from '../../../models/workspace-context/workspace-context.interface';
import { WorkspaceContextStore } from '../../../state/workspace-context/workspace-context.store';
import { meetsRole } from '../../../utils/role-rank/role-rank.util';

/**
 * Function organizationRoleGuard
 *
 * @description
 * Lets a route below `/:org` open only for a person whose role in the organization is at least
 * `least` (owner, admin, member, guest, the most privileged first), the ranking of
 * `WORKSPACE_CONTEXT.can()`. Child guards run before the `/:org` resolver commits the context, so
 * it checks the role the organization guard verified during the same navigation, or the committed
 * role when the `/:org` guards did not run again. A person below `least` is redirected, with a
 * `UrlTree`, to the first `fallbacks` entry their role meets, below `/<slug>`, or else to
 * `/<slug>`. It is a deep-link fallback: navigation entries are filtered with `can()` already.
 *
 * @param {WorkspaceRole} least - Least role the route requires.
 * @param {readonly OrganizationRoleFallback[]} [fallbacks] - Places to try, in order, when refused.
 * @returns {CanActivateFn} The guard.
 */
export function organizationRoleGuard(
  least: WorkspaceRole,
  fallbacks: readonly OrganizationRoleFallback[] = [],
): CanActivateFn {
  return (route: ActivatedRouteSnapshot): boolean | UrlTree => {
    const router: Router = inject(Router);
    const role: WorkspaceRole | null = inject(WorkspaceContextStore).roleDuring(
      router.currentNavigation()?.id ?? null,
    );
    if (role !== null && meetsRole(role, least)) return true;
    const slug: string = route.paramMap.get('org') ?? '';
    const fallback: OrganizationRoleFallback | undefined =
      role === null
        ? undefined
        : fallbacks.find((candidate: OrganizationRoleFallback) => meetsRole(role, candidate.least));
    return router.createUrlTree(['/', slug, ...(fallback?.path ?? [])]);
  };
}
