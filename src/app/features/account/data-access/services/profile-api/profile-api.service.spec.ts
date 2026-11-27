import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  AccountService,
  AuthService,
  OrganizationsService,
  ProfileMediaService,
} from '@cadenway/api-client';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { AccountProfile } from '../../../models/profile/profile.interface';
import { AccountChangedError } from '../notification-preferences-api/account-changed.error';
import { ProfileApi } from './profile-api.service';

/**
 * Constant CAMILLE
 *
 * @description
 * Camille Martin's account as the gateway answers it.
 *
 * @type {Record<string, unknown>}
 */
const CAMILLE: Record<string, unknown> = {
  id: 'u-camille',
  name: 'Camille Martin',
  email: 'camille.martin@ateliernord.fr',
  language: 'fr',
  displayName: 'camille',
  jobTitle: null,
  timeZone: 'Europe/Paris',
  version: 3,
};

describe('ProfileApi', () => {
  let auth: { getCurrentUser: Mock; updateCurrentUser: Mock };
  let account: {
    requestEmailChange: Mock;
    confirmEmailChange: Mock;
    scheduleAccountDeletion: Mock;
  };
  let media: { setAvatar: Mock; deleteAvatar: Mock; startAvatarUpload: Mock; getAvatar: Mock };
  let organizations: { listMyOrganizations: Mock };
  let request: Mock;
  let api: ProfileApi;

  beforeEach(() => {
    auth = {
      getCurrentUser: vi.fn(() => of(CAMILLE)),
      updateCurrentUser: vi.fn(() => of({ ...CAMILLE, jobTitle: 'Product lead', version: 4 })),
    };
    account = {
      requestEmailChange: vi.fn(() =>
        of({
          email: 'camille@ateliernord.fr',
          expiresAt: '2026-11-27T10:15:00Z',
          resendAvailableAt: '2026-11-27T10:00:30Z',
        }),
      ),
      confirmEmailChange: vi.fn(() => of({ ...CAMILLE, email: 'camille@ateliernord.fr' })),
      scheduleAccountDeletion: vi.fn(() => of({ deleteAt: '2026-12-27T10:00:00Z' })),
    };
    media = {
      setAvatar: vi.fn(() => of(undefined)),
      deleteAvatar: vi.fn(() => of(undefined)),
      startAvatarUpload: vi.fn(() =>
        of({ uploadId: 'upload-1', method: 'POST', url: 'https://files.test', fields: { a: 'b' } }),
      ),
      getAvatar: vi.fn(() => of(new Blob(['png']))),
    };
    organizations = { listMyOrganizations: vi.fn() };
    request = vi.fn(
      (_name: string, _options: LockOptions, run: () => Promise<void>): Promise<void> => run(),
    );
    vi.stubGlobal('navigator', { locks: { request } });
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: AccountService, useValue: account },
        { provide: ProfileMediaService, useValue: media },
        { provide: OrganizationsService, useValue: organizations },
        { provide: HttpClient, useValue: { post: vi.fn(() => of('')) } },
      ],
    });
    api = TestBed.inject(ProfileApi);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the account of the session under the shared lock', async () => {
    const profile: AccountProfile = await api.current('u-camille');

    expect(profile).toMatchObject({ name: 'Camille Martin', initials: 'CM', avatarId: null });
    expect(request.mock.calls[0]?.[1]).toMatchObject({ mode: 'shared' });
  });

  it('refuses to read another account', async () => {
    await expect(api.current('u-lucas')).rejects.toBeInstanceOf(AccountChangedError);
  });

  it('sends a merge patch from the version, under the exclusive lock', async () => {
    await api.update({ jobTitle: 'Product lead', displayName: null }, 3, 'u-camille');

    expect(auth.updateCurrentUser).toHaveBeenCalledWith(
      { displayName: null, jobTitle: 'Product lead' },
      { headers: { 'If-Match': '"3"' } },
    );
    expect(request.mock.calls[0]?.[1]).toMatchObject({ mode: 'exclusive' });
  });

  it('sends nothing once the session holds another account or none', async () => {
    auth.getCurrentUser.mockReturnValueOnce(of({ ...CAMILLE, id: 'u-lucas' }));
    await expect(api.removeAvatar(3, 'u-camille')).rejects.toBeInstanceOf(AccountChangedError);

    auth.getCurrentUser.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 401 })),
    );
    await expect(api.scheduleDeletion('u-camille')).rejects.toBeInstanceOf(AccountChangedError);

    expect(media.deleteAvatar).not.toHaveBeenCalled();
    expect(account.scheduleAccountDeletion).not.toHaveBeenCalled();
  });

  it('reserves a photo with a fresh idempotency key and publishes it from the version', async () => {
    const file: File = new File(['jpeg'], 'me.jpg', { type: 'image/jpeg' });

    const upload: { uploadId: string } = await api.reserveAvatar(file, 'u-camille');
    await api.publishAvatar(upload.uploadId, 3, 'u-camille');

    const [body, options]: [unknown, { headers: Record<string, string> }] = media.startAvatarUpload
      .mock.calls[0] as [unknown, { headers: Record<string, string> }];
    expect(body).toEqual({ contentType: 'image/jpeg', sizeBytes: 4 });
    expect(options.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/u);
    expect(media.setAvatar).toHaveBeenCalledWith(
      { uploadId: 'upload-1' },
      { headers: { 'If-Match': '"3"' } },
    );
  });

  it('maps the code of an e-mail change request', async () => {
    expect(await api.requestEmailChange('camille@ateliernord.fr', 'u-camille')).toEqual({
      email: 'camille@ateliernord.fr',
      resendAvailableAt: Date.parse('2026-11-27T10:00:30Z'),
    });
  });

  it('reads every page of the organizations', async () => {
    organizations.listMyOrganizations
      .mockReturnValueOnce(
        of({ items: [{ id: 'org-nord', name: 'Atelier Nord', role: 'owner' }], nextCursor: 'c1' }),
      )
      .mockReturnValueOnce(
        of({ items: [{ id: 'org-lumen', name: 'Lumen', role: 'member' }], nextCursor: null }),
      );

    expect(await api.myOrganizations('u-camille')).toEqual([
      { id: 'org-nord', name: 'Atelier Nord', owned: true },
      { id: 'org-lumen', name: 'Lumen', owned: false },
    ]);
    expect(organizations.listMyOrganizations).toHaveBeenLastCalledWith({
      limit: 100,
      cursor: 'c1',
    });
  });

  it('fails the organizations read on a repeated cursor', async () => {
    organizations.listMyOrganizations.mockReturnValue(of({ items: [], nextCursor: 'c1' }));

    await expect(api.myOrganizations('u-camille')).rejects.toThrow();
  });

  it('reads the photo and the organizations under the shared lock, for the account only', async () => {
    organizations.listMyOrganizations.mockReturnValue(of({ items: [], nextCursor: null }));

    await api.avatar('u-camille');
    await api.myOrganizations('u-camille');
    expect(request.mock.calls.map((call: unknown[]) => (call[1] as LockOptions).mode)).toEqual([
      'shared',
      'shared',
    ]);

    auth.getCurrentUser.mockReturnValue(of({ ...CAMILLE, id: 'u-lucas' }));
    await expect(api.avatar('u-camille')).rejects.toBeInstanceOf(AccountChangedError);
    await expect(api.myOrganizations('u-camille')).rejects.toBeInstanceOf(AccountChangedError);
    expect(media.getAvatar).toHaveBeenCalledTimes(1);
    expect(organizations.listMyOrganizations).toHaveBeenCalledTimes(1);
  });

  it('names the refused fields of a 400', () => {
    const error: HttpErrorResponse = new HttpErrorResponse({
      status: 400,
      error: {
        status: 400,
        code: 'request.invalid',
        details: { issues: [{ path: 'timeZone' }, { path: 'language' }, { path: 'timeZone' }] },
      },
    });

    expect(api.refusedFields(error)).toEqual(['timeZone']);
  });
});
