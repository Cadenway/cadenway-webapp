import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SKIP_ORGANIZATION_PIN } from '@core/api';

import type { OrganizationMenuEntry } from '../../../models/organization-menu-entry/organization-menu-entry.interface';
import type {
  WorkspaceOrganization,
  WorkspaceResult,
  WorkspaceUser,
} from '../../../models/workspace-context/workspace-context.interface';
import { WorkspaceSession } from './workspace-session.service';

/**
 * Function myOrganization
 *
 * @description
 * An organization of the caller as `GET /v1/organizations` lists it.
 *
 * @param {string} slug - Organization slug.
 * @param {string} name - Organization name.
 * @returns {Record<string, unknown>} The listed organization.
 */
function myOrganization(slug: string, name: string): Record<string, unknown> {
  return {
    id: `id-${slug}`,
    name,
    slug,
    role: 'member',
    memberCount: 5,
    plan: 'free',
    joinedAt: '2026-11-01T10:00:00Z',
  };
}

describe('WorkspaceSession', () => {
  let http: HttpTestingController;
  let session: WorkspaceSession;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(WorkspaceSession);
  });

  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
  });

  it('reads the signed-in person as a display model', async () => {
    const result: Promise<WorkspaceResult<WorkspaceUser>> = firstValueFrom(session.currentUser());
    http.expectOne('/v1/me').flush({
      id: 'u1',
      name: 'Camille Martin',
      email: 'camille.martin@ateliernord.fr',
      language: 'fr',
      displayName: null,
      jobTitle: null,
      timeZone: 'Europe/Paris',
      version: 2,
    });

    await expect(result).resolves.toEqual({
      ok: true,
      value: {
        id: 'u1',
        name: 'Camille Martin',
        firstName: 'Camille',
        displayName: null,
        email: 'camille.martin@ateliernord.fr',
        initials: 'CM',
      },
    });
  });

  it('reports a missing session with its status and code', async () => {
    const result: Promise<WorkspaceResult<WorkspaceUser>> = firstValueFrom(session.currentUser());
    http.expectOne('/v1/me').flush(
      {
        type: 'about:blank',
        title: 'Session expired',
        status: 401,
        code: 'auth.session-expired',
      },
      { status: 401, statusText: 'Unauthorized' },
    );

    await expect(result).resolves.toEqual({
      ok: false,
      problem: { status: 401, code: 'auth.session-expired' },
    });
  });

  it('reads the current organization without the HTTP cache', async () => {
    const result: Promise<WorkspaceResult<WorkspaceOrganization>> = firstValueFrom(
      session.currentOrganization(),
    );
    const request: TestRequest = http.expectOne('/v1/organization');
    expect(request.request.cache).toBe('no-store');
    expect(request.request.context.get(SKIP_ORGANIZATION_PIN)).toBe(true);
    request.flush({ ...myOrganization('atelier-nord', 'Atelier Nord'), role: 'owner' });

    await expect(result).resolves.toMatchObject({
      ok: true,
      value: { slug: 'atelier-nord', initials: 'AN', role: 'owner' },
    });
  });

  it('reads every page of the organizations of the caller', async () => {
    const result: Promise<WorkspaceResult<readonly WorkspaceOrganization[]>> = firstValueFrom(
      session.myOrganizations(),
    );
    http
      .expectOne((request) => request.url === '/v1/organizations' && !request.params.has('cursor'))
      .flush({ items: [myOrganization('atelier-nord', 'Atelier Nord')], nextCursor: 'page-2' });
    http
      .expectOne((request) => request.params.get('cursor') === 'page-2')
      .flush({ items: [myOrganization('lumen', 'Lumen Cooperative')], nextCursor: null });

    const organizations: WorkspaceResult<readonly WorkspaceOrganization[]> = await result;
    expect(organizations.ok && organizations.value.map((item) => item.slug)).toEqual([
      'atelier-nord',
      'lumen',
    ]);
  });

  it('reads every page of the organizations menu with the member counts', async () => {
    const result: Promise<WorkspaceResult<readonly OrganizationMenuEntry[]>> = firstValueFrom(
      session.menuOrganizations(),
    );
    http
      .expectOne((request) => request.url === '/v1/organizations' && !request.params.has('cursor'))
      .flush({ items: [myOrganization('atelier-nord', 'Atelier Nord')], nextCursor: 'page-2' });
    http
      .expectOne((request) => request.params.get('cursor') === 'page-2')
      .flush({ items: [myOrganization('lumen', 'Lumen Cooperative')], nextCursor: null });

    const entries: WorkspaceResult<readonly OrganizationMenuEntry[]> = await result;
    expect(entries.ok && entries.value.map((item) => [item.slug, item.memberCount])).toEqual([
      ['atelier-nord', 5],
      ['lumen', 5],
    ]);
  });

  it('reports a failed organizations menu read as a problem', async () => {
    const result: Promise<WorkspaceResult<readonly OrganizationMenuEntry[]>> = firstValueFrom(
      session.menuOrganizations(),
    );
    http
      .expectOne('/v1/organizations?limit=100')
      .flush(
        { type: 'about:blank', title: 'x', status: 503, code: 'upstream.unavailable' },
        { status: 503, statusText: 'Service Unavailable' },
      );

    await expect(result).resolves.toEqual({
      ok: false,
      problem: { status: 503, code: 'upstream.unavailable' },
    });
  });

  it('switches the organization without a lock of its own', async () => {
    const result: Promise<WorkspaceResult<void>> = firstValueFrom(
      session.switchOrganization('id-lumen'),
    );
    const request: TestRequest = http.expectOne({ method: 'PUT', url: '/v1/session/organization' });
    expect(request.request.body).toEqual({ organizationId: 'id-lumen' });
    request.flush({ organizationId: 'id-lumen', role: 'member' });

    await expect(result).resolves.toEqual({ ok: true, value: undefined });
  });

  it('runs a read and a switch under one exclusive session lock', async () => {
    const modes: string[] = [];
    vi.stubGlobal('navigator', {
      locks: {
        request: (_name: string, options: LockOptions, run: () => Promise<void>): Promise<void> => {
          modes.push(options.mode ?? 'exclusive');
          return run();
        },
      },
    });

    const result: Promise<WorkspaceResult<void>> = firstValueFrom(
      session.exclusive(() => session.switchOrganization('id-lumen')),
    );
    const request: TestRequest = await vi.waitFor(() =>
      http.expectOne({ method: 'PUT', url: '/v1/session/organization' }),
    );
    request.flush({ organizationId: 'id-lumen', role: 'member' });

    await expect(result).resolves.toEqual({ ok: true, value: undefined });
    expect(modes).toEqual(['exclusive']);
  });

  it('starts nothing when the browser cannot coordinate the session', async () => {
    vi.stubGlobal('navigator', {});

    await expect(
      firstValueFrom(session.exclusive(() => session.switchOrganization('id-lumen'))),
    ).resolves.toEqual({ ok: false, problem: { status: 0, code: null } });
    http.expectNone('/v1/session/organization');
  });
});
