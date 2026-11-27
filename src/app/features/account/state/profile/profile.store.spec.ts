import { HttpErrorResponse } from '@angular/common/http';
import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { AccountChangedError } from '../../data-access/services/notification-preferences-api/account-changed.error';
import { ProfileApi } from '../../data-access/services/profile-api/profile-api.service';
import type {
  AccountProfile,
  DeletionResult,
  EmailRequestResult,
  ProfileSaveResult,
} from '../../models/profile/profile.interface';
import { ReauthenticationCancelledError } from '../../reauthentication/reauthentication-cancelled.error';
import { ReauthenticationService } from '../../reauthentication/reauthentication.service';
import { ProfileStore } from './profile.store';

/**
 * Constant CAMILLE
 *
 * @description
 * Camille Martin without a photo, version 3.
 *
 * @type {AccountProfile}
 */
const CAMILLE: AccountProfile = {
  id: 'u-camille',
  name: 'Camille Martin',
  displayName: 'camille',
  jobTitle: null,
  email: 'camille.martin@ateliernord.fr',
  timeZone: 'Europe/Paris',
  avatarId: null,
  initials: 'CM',
  version: 3,
};

/**
 * Function problem
 *
 * @description
 * A refused call of the gateway.
 *
 * @param {number} status - HTTP status.
 * @param {string} code - Problem code.
 * @param {Record<string, unknown>} [details] - Problem details.
 * @returns {HttpErrorResponse} The error.
 */
function problem(
  status: number,
  code: string,
  details?: Record<string, unknown>,
): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    error: { type: 'about:blank', title: '', status, code, details },
  });
}

describe('ProfileStore', () => {
  let api: Record<string, Mock>;
  let run: Mock;
  let userId: WritableSignal<string>;
  let store: InstanceType<typeof ProfileStore>;

  beforeEach(async () => {
    userId = signal('u-camille');
    run = vi.fn(<T>(operation: () => Promise<T>): Promise<T> => operation());
    api = {
      current: vi.fn(() => Promise.resolve(CAMILLE)),
      update: vi.fn(() => Promise.resolve({ ...CAMILLE, jobTitle: 'Product lead', version: 4 })),
      refusedFields: vi.fn(() => ['timeZone']),
      resendAvailableAt: vi.fn(() => Date.parse('2026-11-27T10:00:30Z')),
      ownedOrganizationIds: vi.fn(() => ['org-nord']),
      avatar: vi.fn(() => Promise.resolve(new Blob(['png']))),
      reserveAvatar: vi.fn(() =>
        Promise.resolve({ uploadId: 'upload-1', url: 'https://files.test', fields: {} }),
      ),
      sendAvatar: vi.fn(() => Promise.resolve()),
      publishAvatar: vi.fn(() => Promise.resolve()),
      removeAvatar: vi.fn(() => Promise.resolve()),
      requestEmailChange: vi.fn(() =>
        Promise.resolve({ email: 'camille@ateliernord.fr', resendAvailableAt: 1_000 }),
      ),
      confirmEmailChange: vi.fn(() =>
        Promise.resolve({ ...CAMILLE, email: 'camille@ateliernord.fr', version: 4 }),
      ),
      scheduleDeletion: vi.fn(() => Promise.resolve()),
      myOrganizations: vi.fn(() => Promise.resolve([])),
    };
    TestBed.configureTestingModule({
      providers: [
        ProfileStore,
        { provide: ProfileApi, useValue: api },
        { provide: ReauthenticationService, useValue: { run } },
        { provide: WORKSPACE_CONTEXT, useValue: { user: () => ({ id: userId() }) } },
      ],
    });
    store = TestBed.inject(ProfileStore);
    await expect.poll(() => store.current()).toEqual(CAMILLE);
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('reads the account the workspace shows', () => {
    expect(api['current']).toHaveBeenCalledWith('u-camille', expect.any(AbortSignal));
  });

  it('sends a change from the version read and shows the saved account', async () => {
    const result: ProfileSaveResult = await store.save({ jobTitle: 'Product lead' });

    expect(result).toEqual({ outcome: 'saved' });
    expect(api['update']).toHaveBeenCalledWith({ jobTitle: 'Product lead' }, 3, 'u-camille');
    expect(store.current()?.version).toBe(4);
    expect(store.saving()).toBe(false);
  });

  it('maps a refused field of the gateway to that field', async () => {
    api['update'].mockRejectedValueOnce(problem(400, 'request.invalid'));

    expect(await store.save({ timeZone: 'Mars/Olympus' })).toEqual({
      outcome: 'refused',
      refusals: [{ field: 'timeZone' }],
    });
  });

  it('drops the answer of a save once the workspace shows another account', async () => {
    let answer: (profile: AccountProfile) => void = (): void => undefined;
    api['update'].mockReturnValueOnce(
      new Promise<AccountProfile>((resolve: (profile: AccountProfile) => void) => {
        answer = resolve;
      }),
    );
    const saving: Promise<ProfileSaveResult> = store.save({ jobTitle: 'Product lead' });
    userId.set('u-lucas');
    answer({ ...CAMILLE, jobTitle: 'Product lead', version: 4 });

    expect(await saving).toEqual({ outcome: 'cancelled' });
  });

  it('keeps the confirmed account when the reread after a stale version fails', async () => {
    api['update'].mockRejectedValueOnce(problem(412, 'request.version-mismatch'));
    api['current'].mockRejectedValueOnce(problem(503, 'upstream.unavailable'));

    expect(await store.save({ jobTitle: 'Product lead' })).toEqual({ outcome: 'unreconciled' });
    expect(store.refreshFailed()).toBe(true);
    expect(store.current()).toEqual(CAMILLE);

    expect(await store.retryRefresh()).toBe(true);
    expect(store.refreshFailed()).toBe(false);
  });

  it('refuses a too large photo without sending it', async () => {
    const file: File = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: 6 * 1024 * 1024 });

    expect(await store.uploadAvatar(file)).toBe('too-large');
    expect(api['reserveAvatar']).not.toHaveBeenCalled();
  });

  it('publishes the same upload once when the transfer ends without an answer', async () => {
    api['sendAvatar'].mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    api['current'].mockResolvedValueOnce({ ...CAMILLE, avatarId: 'avatar-1', version: 4 });

    expect(await store.uploadAvatar(new File(['png'], 'me.png', { type: 'image/png' }))).toBe(
      'updated',
    );
    expect(api['publishAvatar']).toHaveBeenCalledWith('upload-1', 3, 'u-camille');
    expect(store.current()?.avatarId).toBe('avatar-1');
  });

  it('ends an e-mail request silently when the reauthentication is closed', async () => {
    run.mockRejectedValueOnce(new ReauthenticationCancelledError());

    expect(await store.requestEmailChange('camille@ateliernord.fr')).toEqual({
      outcome: 'cancelled',
    });
  });

  it('tells when another code can be asked for a throttled address', async () => {
    api['requestEmailChange'].mockRejectedValueOnce(
      problem(429, 'auth.code-throttled', { resendAvailableAt: '2026-11-27T10:00:30Z' }),
    );

    const result: EmailRequestResult = await store.requestEmailChange('camille@ateliernord.fr');
    expect(result).toEqual({
      outcome: 'refused',
      reason: 'throttled',
      resendAvailableAt: Date.parse('2026-11-27T10:00:30Z'),
    });
  });

  it('counts a confirmation whose answer was lost as done when the account holds the address', async () => {
    api['confirmEmailChange'].mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    api['current'].mockResolvedValueOnce({
      ...CAMILLE,
      email: 'camille@ateliernord.fr',
      version: 4,
    });

    expect(await store.confirmEmailChange('731406', 'camille@ateliernord.fr')).toBe('confirmed');
    expect(store.current()?.email).toBe('camille@ateliernord.fr');
  });

  it('lists the organizations still owned when the deletion is refused', async () => {
    api['scheduleDeletion'].mockRejectedValueOnce(
      problem(409, 'account.organization-owner', { organizationIds: ['org-nord'] }),
    );

    const result: DeletionResult = await store.scheduleDeletion();
    expect(result).toEqual({ outcome: 'owner', organizationIds: ['org-nord'] });
    expect(store.deleted()).toBe(false);
  });

  it('keeps checking a lost save until a later reread holds it', async () => {
    vi.useFakeTimers();
    api['update'].mockRejectedValueOnce(new HttpErrorResponse({ status: 504 }));
    api['current']
      .mockResolvedValueOnce(CAMILLE)
      .mockResolvedValueOnce({ ...CAMILLE, jobTitle: 'Product lead', version: 4 });

    const saving: Promise<ProfileSaveResult> = store.save({ jobTitle: 'Product lead' });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(store.saving()).toBe(true);
    await vi.advanceTimersByTimeAsync(2_000);

    expect(await saving).toEqual({ outcome: 'saved' });
    expect(store.current()?.jobTitle).toBe('Product lead');
  });

  it('leaves a lost save unconfirmed when no reread within 14 s holds it', async () => {
    vi.useFakeTimers();
    api['update'].mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));

    const saving: Promise<ProfileSaveResult> = store.save({ jobTitle: 'Product lead' });
    await vi.advanceTimersByTimeAsync(15_000);

    expect(await saving).toEqual({ outcome: 'unconfirmed' });
    expect(api['current']).toHaveBeenCalledTimes(1 + 4);
    expect(store.refreshFailed()).toBe(false);
  });

  it('confirms a lost address change once a delayed reread shows the new address', async () => {
    vi.useFakeTimers();
    api['confirmEmailChange'].mockRejectedValueOnce(new HttpErrorResponse({ status: 502 }));
    api['current']
      .mockResolvedValueOnce(CAMILLE)
      .mockResolvedValueOnce(CAMILLE)
      .mockResolvedValueOnce({ ...CAMILLE, email: 'camille@ateliernord.fr', version: 4 });

    const confirming: Promise<string> = store.confirmEmailChange(
      '731406',
      'camille@ateliernord.fr',
    );
    await vi.advanceTimersByTimeAsync(7_000);

    expect(await confirming).toBe('confirmed');
  });

  it('publishes the same upload once when the transfer times out or storage fails', async () => {
    api['sendAvatar'].mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    api['current'].mockResolvedValueOnce({ ...CAMILLE, avatarId: 'avatar-1', version: 4 });

    expect(await store.uploadAvatar(new File(['png'], 'me.png', { type: 'image/png' }))).toBe(
      'updated',
    );
    expect(api['publishAvatar']).toHaveBeenCalledWith('upload-1', 3, 'u-camille');
  });

  it('waits for a photo change on its way before letting the page go', async () => {
    let publish: () => void = (): void => undefined;
    api['publishAvatar'].mockReturnValueOnce(
      new Promise<void>((resolve: () => void) => {
        publish = resolve;
      }),
    );
    api['current'].mockResolvedValueOnce({ ...CAMILLE, avatarId: 'avatar-1', version: 4 });
    const uploading: Promise<unknown> = store.uploadAvatar(
      new File(['png'], 'me.png', { type: 'image/png' }),
    );
    let sent: boolean = false;
    void store.sent().then((): void => {
      sent = true;
    });
    await expect.poll(() => api['publishAvatar'].mock.calls.length).toBe(1);
    expect(sent).toBe(false);

    publish();
    await uploading;
    await expect.poll(() => sent).toBe(true);
  });

  it('reads the photo again after a failed read', async () => {
    api['avatar'].mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    api['current'].mockResolvedValueOnce({ ...CAMILLE, avatarId: 'avatar-1', version: 4 });
    await store.retryRefresh();

    await expect.poll(() => store.avatarFailed()).toBe(true);
    expect(api['avatar']).toHaveBeenCalledWith('u-camille', expect.any(AbortSignal));
    store.retryAvatar();

    await expect.poll(() => store.avatarFailed()).toBe(false);
    await expect.poll(() => store.avatar.hasValue()).toBe(true);
    expect(api['avatar']).toHaveBeenCalledTimes(2);
  });

  it('leaves a lost deletion unconfirmed when the session no longer reads the account', async () => {
    api['scheduleDeletion'].mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    api['current'].mockRejectedValue(new AccountChangedError());

    expect(await store.scheduleDeletion()).toEqual({ outcome: 'unconfirmed' });
    expect(store.deleted()).toBe(false);
  });

  it('leaves a lost deletion unconfirmed even while the account still reads', async () => {
    api['scheduleDeletion'].mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    const reads: number = api['current'].mock.calls.length;

    expect(await store.scheduleDeletion()).toEqual({ outcome: 'unconfirmed' });
    expect(api['current']).toHaveBeenCalledTimes(reads);
    expect(store.deleted()).toBe(false);
  });

  it('counts a lost publication as done once the account shows the reserved upload', async () => {
    api['publishAvatar'].mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    api['current'].mockResolvedValueOnce({ ...CAMILLE, avatarId: 'upload-1', version: 4 });

    expect(await store.uploadAvatar(new File(['png'], 'me.png', { type: 'image/png' }))).toBe(
      'updated',
    );
    expect(store.current()?.avatarId).toBe('upload-1');
  });

  it('does not take a photo another change published for a lost publication', async () => {
    vi.useFakeTimers();
    api['publishAvatar'].mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    api['current'].mockResolvedValue({ ...CAMILLE, avatarId: 'avatar-elsewhere', version: 4 });

    const uploading: Promise<string> = store.uploadAvatar(
      new File(['png'], 'me.png', { type: 'image/png' }),
    );
    await vi.advanceTimersByTimeAsync(15_000);

    expect(await uploading).toBe('unconfirmed');
  });

  it('counts a lost removal as done only once the account has no photo', async () => {
    vi.useFakeTimers();
    const withPhoto: InstanceType<typeof ProfileStore> = await storeWithPhoto();
    api['removeAvatar'].mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    api['current']
      .mockResolvedValueOnce({ ...CAMILLE, avatarId: 'avatar-elsewhere', version: 4 })
      .mockResolvedValueOnce({ ...CAMILLE, version: 5 });

    const removing: Promise<string> = withPhoto.removeAvatar();
    await vi.advanceTimersByTimeAsync(3_000);

    expect(await removing).toBe('removed');
    expect(withPhoto.current()?.avatarId).toBeNull();
  });

  it('does not take a photo another change published for a lost removal', async () => {
    vi.useFakeTimers();
    const withPhoto: InstanceType<typeof ProfileStore> = await storeWithPhoto();
    api['removeAvatar'].mockRejectedValueOnce(new HttpErrorResponse({ status: 504 }));
    api['current'].mockResolvedValue({ ...CAMILLE, avatarId: 'avatar-elsewhere', version: 4 });

    const removing: Promise<string> = withPhoto.removeAvatar();
    await vi.advanceTimersByTimeAsync(15_000);

    expect(await removing).toBe('unconfirmed');
  });

  /**
   * Function storeWithPhoto
   *
   * @description
   * A fresh store whose account has the photo `avatar-1`, once read.
   *
   * @returns {Promise<InstanceType<typeof ProfileStore>>} The store.
   */
  async function storeWithPhoto(): Promise<InstanceType<typeof ProfileStore>> {
    api['current'].mockResolvedValueOnce({ ...CAMILLE, avatarId: 'avatar-1' });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ProfileStore,
        { provide: ProfileApi, useValue: api },
        { provide: ReauthenticationService, useValue: { run } },
        { provide: WORKSPACE_CONTEXT, useValue: { user: () => ({ id: userId() }) } },
      ],
    });
    const withPhoto: InstanceType<typeof ProfileStore> = TestBed.inject(ProfileStore);
    await vi.waitFor(() => {
      expect(withPhoto.current()?.avatarId).toBe('avatar-1');
    });
    return withPhoto;
  }
});
