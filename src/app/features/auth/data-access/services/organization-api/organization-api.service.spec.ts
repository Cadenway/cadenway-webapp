import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  OrganizationChoice,
  ReceivedInvitation,
} from '../../../models/organization/organization.interface';
import { OrganizationApi } from './organization-api.service';

/**
 * Constant atelierNord
 *
 * @description
 * Atelier Nord as the gateway lists it.
 *
 * @type {Record<string, unknown>}
 */
const atelierNord: Record<string, unknown> = {
  id: 'org-atelier-nord',
  name: 'Atelier Nord',
  slug: 'atelier-nord',
  role: 'owner',
  memberCount: 18,
  plan: 'team',
  joinedAt: '2026-11-01T10:00:00Z',
};

/**
 * Constant currentOrganization
 *
 * @description
 * Atelier Nord as the current organization of the session.
 *
 * @type {Record<string, unknown>}
 */
const currentOrganization: Record<string, unknown> = {
  ...atelierNord,
  description: null,
  website: null,
  defaultLanguage: 'fr',
  createdAt: '',
  version: 1,
};

/**
 * Function http
 *
 * @description
 * The HTTP testing controller of the current test bed.
 *
 * @returns {HttpTestingController} The controller.
 */
function http(): HttpTestingController {
  return TestBed.inject(HttpTestingController);
}

/**
 * Function settle
 *
 * @description
 * Lets pending promise steps run.
 *
 * @returns {Promise<void>} Resolves after pending microtasks.
 */
async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

describe('OrganizationApi', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    vi.stubGlobal('navigator', {
      locks: {
        request: (_name: string, _options: LockOptions, run: () => Promise<void>): Promise<void> =>
          run(),
      },
    });
  });

  afterEach(() => {
    http().verify();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('follows the pages of the organizations and the invitations', async () => {
    const api: OrganizationApi = TestBed.inject(OrganizationApi);

    const organizations: Promise<readonly OrganizationChoice[]> = api.listMine();
    http()
      .expectOne((request) => request.url === '/v1/organizations' && !request.params.has('cursor'))
      .flush({ items: [atelierNord], nextCursor: 'page-2' });
    await settle();
    http()
      .expectOne((request) => request.params.get('cursor') === 'page-2')
      .flush({
        items: [{ ...atelierNord, id: 'org-pivot', name: 'Studio Pivot' }],
        nextCursor: null,
      });
    expect((await organizations).map((item: OrganizationChoice) => item.name)).toEqual([
      'Atelier Nord',
      'Studio Pivot',
    ]);

    const invitations: Promise<readonly ReceivedInvitation[]> = api.listReceivedInvitations();
    http()
      .expectOne((request) => request.url === '/v1/me/invitations')
      .flush({
        items: [
          {
            id: 'invitation-lumen',
            organization: {
              id: 'org-lumen',
              name: 'Coopérative Lumen',
              slug: 'lumen',
              description: null,
              memberCount: 41,
            },
            role: 'member',
            invitedBy: { userId: 'user-ines', name: 'Inès Robert' },
            expiresAt: '2026-11-15T10:00:00Z',
          },
        ],
        nextCursor: null,
      });
    expect(await invitations).toHaveLength(1);
  });

  it('retries the switch to a just joined organization while it answers 404', async () => {
    const choice: Promise<void> = TestBed.inject(OrganizationApi).choose('org-lumen', true);
    await settle();
    http()
      .expectOne('/v1/session/organization')
      .flush({ code: 'organization.not-found' }, { status: 404, statusText: 'Not Found' });
    await vi.advanceTimersByTimeAsync(1_000);
    const retried: TestRequest = http().expectOne('/v1/session/organization');
    expect(retried.request.body).toEqual({ organizationId: 'org-lumen' });
    retried.flush({ organizationId: 'org-lumen', role: 'member' });
    await expect(choice).resolves.toBeUndefined();
  });

  it('does not retry the switch to a listed organization', async () => {
    const choice: Promise<void> = TestBed.inject(OrganizationApi).choose('org-gone');
    await settle();
    http()
      .expectOne('/v1/session/organization')
      .flush({ code: 'organization.not-found' }, { status: 404, statusText: 'Not Found' });
    await expect(choice).rejects.toBeTruthy();
  });

  it('creates the organization with distinct invitations and no logo field', async () => {
    const created: Promise<OrganizationChoice> = TestBed.inject(OrganizationApi).create({
      name: 'Studio Nord',
      teamSize: '6-20',
      primaryUse: 'other',
      inviteEmails: ['ines@ateliernord.fr'],
      logo: null,
    });
    const request: TestRequest = http().expectOne('/v1/organizations');
    expect(request.request.body).toEqual({
      name: 'Studio Nord',
      teamSize: '6-20',
      primaryUse: 'other',
      inviteEmails: ['ines@ateliernord.fr'],
    });
    request.flush({
      organization: { ...atelierNord, id: 'org-studio', name: 'Studio Nord', slug: 'studio-nord' },
      invitations: [],
    });
    await expect(created).resolves.toMatchObject({ slug: 'studio-nord', role: 'owner' });
  });

  it('enters the created organization, checks it is current, then uploads its logo', async () => {
    const api: OrganizationApi = TestBed.inject(OrganizationApi);
    const logo: File = new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' });

    const entered: Promise<{ readonly logoFailed: boolean }> = api.enterCreated(
      'org-atelier-nord',
      logo,
    );
    await settle();
    http()
      .expectOne('/v1/session/organization')
      .flush({ organizationId: 'org-atelier-nord', role: 'owner' });
    await settle();
    http().expectOne('/v1/organization').flush(currentOrganization);
    await settle();
    const reserve: TestRequest = http().expectOne('/v1/organization/logo/uploads');
    expect(reserve.request.body).toEqual({ contentType: 'image/svg+xml', sizeBytes: logo.size });
    expect(reserve.request.headers.has('Idempotency-Key')).toBe(true);
    reserve.flush({
      uploadId: 'upload-1',
      method: 'POST',
      url: 'https://storage.example/upload',
      fields: { key: 'k' },
      expiresAt: '',
    });
    await settle();
    const bytes: TestRequest = http().expectOne('https://storage.example/upload');
    expect((bytes.request.body as FormData).get('key')).toBe('k');
    bytes.flush('');
    await settle();
    const publish: TestRequest = http().expectOne('/v1/organization/logo');
    expect(publish.request.body).toEqual({ uploadId: 'upload-1' });
    publish.flush(null, { status: 204, statusText: 'No Content' });
    await expect(entered).resolves.toEqual({ logoFailed: false });
  });

  it('does not upload the logo when another organization became current', async () => {
    const entered: Promise<{ readonly logoFailed: boolean }> = TestBed.inject(
      OrganizationApi,
    ).enterCreated('org-studio', new File(['png'], 'logo.png', { type: 'image/png' }));
    await settle();
    http()
      .expectOne('/v1/session/organization')
      .flush({ organizationId: 'org-studio', role: 'owner' });
    await settle();
    http().expectOne('/v1/organization').flush(currentOrganization);

    await expect(entered).resolves.toEqual({ logoFailed: true });
    http().expectNone('/v1/organization/logo/uploads');
  });

  it('reads the current organization', async () => {
    const current: Promise<{ readonly id: string; readonly slug: string }> =
      TestBed.inject(OrganizationApi).current();
    http().expectOne('/v1/organization').flush(currentOrganization);
    await expect(current).resolves.toEqual({ id: 'org-atelier-nord', slug: 'atelier-nord' });
  });
});
