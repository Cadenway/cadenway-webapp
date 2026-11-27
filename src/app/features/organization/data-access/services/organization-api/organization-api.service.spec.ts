import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  type Organization as OrganizationDto,
  OrganizationsService,
  ProfileMediaService,
} from '@cadenway/api-client';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { OrganizationProfile } from '../../../models/organization/organization-profile.interface';
import { OrganizationApi } from './organization-api.service';

/**
 * Constant ATELIER_NORD
 *
 * @description
 * Atelier Nord as the gateway answers it, version 3.
 *
 * @type {OrganizationDto}
 */
const ATELIER_NORD: OrganizationDto = {
  id: 'org-nord',
  name: 'Atelier Nord',
  slug: 'atelier-nord',
  description: null,
  website: 'https://ateliernord.fr',
  defaultLanguage: 'fr',
  plan: 'team',
  memberCount: 18,
  role: 'owner',
  createdAt: '2026-03-02T09:00:00Z',
  version: 3,
};

describe('OrganizationApi', () => {
  let organizations: Record<string, Mock>;
  let media: Record<string, Mock>;
  let api: OrganizationApi;

  beforeEach(() => {
    organizations = {
      getCurrentOrganization: vi.fn(() => of(ATELIER_NORD)),
      updateCurrentOrganization: vi.fn(() => of({ ...ATELIER_NORD, slug: 'nord', version: 4 })),
    };
    media = {
      getOrganizationLogo: vi.fn(() => of(new Blob(['png'], { type: 'image/png' }))),
      startOrganizationLogoUpload: vi.fn(() =>
        of({
          uploadId: 'upload-1',
          method: 'POST',
          url: 'https://files.example.test/upload',
          fields: { key: 'logos/upload-1', 'Content-Type': 'image/svg+xml' },
          expiresAt: '2026-11-08T08:10:00Z',
        }),
      ),
      setOrganizationLogo: vi.fn(() => of(undefined)),
      deleteOrganizationLogo: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: OrganizationsService, useValue: organizations },
        { provide: ProfileMediaService, useValue: media },
      ],
    });
    api = TestBed.inject(OrganizationApi);
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('reads the current organization', async () => {
    const profile: OrganizationProfile = await api.current();

    expect(profile.name).toBe('Atelier Nord');
    expect(profile.initials).toBe('AN');
    expect(profile.version).toBe(3);
  });

  it('sends only the changed members, from the version read', async () => {
    const profile: OrganizationProfile = await api.update({ slug: 'nord' }, 3);

    expect(organizations['updateCurrentOrganization']).toHaveBeenCalledWith(
      { slug: 'nord' },
      { headers: { 'If-Match': '"3"' } },
    );
    expect(profile.slug).toBe('nord');
    expect(profile.version).toBe(4);
  });

  it('reserves an SVG logo, sends it with the signed fields first, then publishes it', async () => {
    const file: File = new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' });

    const upload: Awaited<ReturnType<OrganizationApi['reserveLogo']>> = await api.reserveLogo(file);
    expect(media['startOrganizationLogoUpload']).toHaveBeenCalledWith(
      { contentType: 'image/svg+xml', sizeBytes: file.size },
      { headers: { 'Idempotency-Key': expect.any(String) as string } },
    );

    const sending: Promise<void> = api.sendLogo(upload, file);
    const request: ReturnType<HttpTestingController['expectOne']> = TestBed.inject(
      HttpTestingController,
    ).expectOne('https://files.example.test/upload');
    const body: FormData = request.request.body as FormData;
    expect([...body.keys()]).toEqual(['key', 'Content-Type', 'file']);
    expect(request.request.withCredentials).toBe(false);
    request.flush('');
    await sending;

    await api.publishLogo(upload.uploadId, 4);
    expect(media['setOrganizationLogo']).toHaveBeenCalledWith(
      { uploadId: 'upload-1' },
      { headers: { 'If-Match': '"4"' } },
    );
  });

  it('removes the logo from the version read', async () => {
    await api.removeLogo(5);

    expect(media['deleteOrganizationLogo']).toHaveBeenCalledWith({
      headers: { 'If-Match': '"5"' },
    });
  });

  it('names the fields a 400 request.invalid refuses', () => {
    expect(
      api.refusedFields(
        new HttpErrorResponse({
          status: 400,
          error: {
            type: 'about:blank',
            title: 'Bad Request',
            status: 400,
            code: 'request.invalid',
            details: { issues: [{ in: 'body', path: 'website', code: 'invalid_format' }] },
          },
        }),
      ),
    ).toEqual(['website']);
    expect(api.refusedFields(new Error('offline'))).toEqual([]);
  });

  it('reads the logo image', async () => {
    const image: Blob = await api.logo();

    expect(image.type).toBe('image/png');
  });
});
