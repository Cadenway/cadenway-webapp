import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  provideRouter,
  Router,
  type Routes,
  withRouterConfig,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import type {
  WorkspaceOrganization,
  WorkspaceRole,
} from '../../../models/workspace-context/workspace-context.interface';
import { WorkspaceContextStore } from '../../../state/workspace-context/workspace-context.store';
import { organizationRoleGuard } from './organization-role.guard';

/**
 * Component SectionStub
 *
 * @description
 * Stands for an organization settings section.
 */
@Component({ selector: 'cw-section-stub', template: '<p>section</p>' })
class SectionStub {}

/**
 * Function organization
 *
 * @description
 * Builds an organization of the mockup with the person's role in it.
 *
 * @param {string} slug - Organization slug.
 * @param {WorkspaceRole} role - Role of the person.
 * @returns {WorkspaceOrganization} The organization.
 */
function organization(slug: string, role: WorkspaceRole): WorkspaceOrganization {
  return { id: `id-${slug}`, slug, name: slug, initials: 'AN', role, plan: 'team' };
}

describe('organizationRoleGuard', () => {
  let roles: Record<string, WorkspaceRole>;

  beforeEach(() => {
    roles = { 'atelier-nord': 'owner', lumen: 'owner' };
    const routes: Routes = [
      {
        path: ':org',
        providers: [WorkspaceContextStore],
        runGuardsAndResolvers: (from: ActivatedRouteSnapshot, to: ActivatedRouteSnapshot) =>
          from.paramMap.get('org') !== to.paramMap.get('org'),
        canActivate: [
          (route: ActivatedRouteSnapshot): boolean => {
            const store: InstanceType<typeof WorkspaceContextStore> = inject(WorkspaceContextStore);
            const slug: string = route.paramMap.get('org') ?? '';
            store.verifyUser({
              id: 'u1',
              name: 'Camille Martin',
              firstName: 'Camille',
              displayName: null,
              email: 'camille.martin@ateliernord.fr',
              initials: 'CM',
            });
            store.verifyOrganization(
              organization(slug, roles[slug]),
              inject(Router).currentNavigation()?.id ?? null,
            );
            return true;
          },
        ],
        resolve: { context: () => inject(WorkspaceContextStore).commit() },
        children: [
          { path: '', component: SectionStub },
          {
            path: 'organization/general',
            canActivate: [organizationRoleGuard('member')],
            component: SectionStub,
          },
          {
            path: 'organization/billing',
            canActivate: [
              organizationRoleGuard('owner', [
                { least: 'member', path: ['organization', 'general'] },
              ]),
            ],
            component: SectionStub,
          },
          { path: 'blocked', canActivate: [() => false], component: SectionStub },
        ],
      },
    ];
    TestBed.configureTestingModule({
      providers: [provideRouter(routes, withRouterConfig({ paramsInheritanceStrategy: 'always' }))],
    });
  });

  it('opens a deep link for a role verified during the same navigation', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/atelier-nord/organization/billing');

    expect(TestBed.inject(Router).url).toBe('/atelier-nord/organization/billing');
  });

  it('redirects a role below the least one to the first fallback it meets', async () => {
    roles['atelier-nord'] = 'admin';
    const harness: RouterTestingHarness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/atelier-nord/organization/billing');

    expect(TestBed.inject(Router).url).toBe('/atelier-nord/organization/general');
  });

  it('redirects to the workspace when no fallback fits the role', async () => {
    roles['atelier-nord'] = 'guest';
    const harness: RouterTestingHarness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/atelier-nord/organization/billing');

    expect(TestBed.inject(Router).url).toBe('/atelier-nord');
  });

  it('checks the committed role when the workspace guards do not run again', async () => {
    roles['atelier-nord'] = 'member';
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/atelier-nord/organization/general');

    await harness.navigateByUrl('/atelier-nord/organization/billing');

    expect(TestBed.inject(Router).url).toBe('/atelier-nord/organization/general');
  });

  it('checks the role of the organization a switch opens, not the one it leaves', async () => {
    roles = { 'atelier-nord': 'owner', lumen: 'member' };
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/atelier-nord/organization/billing');
    expect(TestBed.inject(Router).url).toBe('/atelier-nord/organization/billing');

    await harness.navigateByUrl('/lumen/organization/billing');

    expect(TestBed.inject(Router).url).toBe('/lumen/organization/general');
    await harness.navigateByUrl('/atelier-nord/organization/billing');
    expect(TestBed.inject(Router).url).toBe('/atelier-nord/organization/billing');
  });

  it('ignores a role verified by a navigation that was cancelled', async () => {
    roles['atelier-nord'] = 'member';
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/atelier-nord/organization/general');
    const router: Router = TestBed.inject(Router);
    expect(await router.navigateByUrl('/lumen/blocked')).toBe(false);

    await harness.navigateByUrl('/atelier-nord/organization/billing');

    expect(router.url).toBe('/atelier-nord/organization/general');
  });
});
