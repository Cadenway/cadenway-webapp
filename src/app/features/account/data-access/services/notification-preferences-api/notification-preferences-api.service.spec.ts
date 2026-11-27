import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { AuthService, NotificationPreferencesService } from '@cadenway/api-client';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { NotificationPreferences } from '../../../models/notification-preferences/notification-preferences.interface';
import { AccountChangedError } from './account-changed.error';
import {
  isUncertainWrite,
  isVersionMismatch,
  NotificationPreferencesApi,
} from './notification-preferences-api.service';
import { WriteNotSentError } from './write-not-sent.error';

/**
 * Function answer
 *
 * @description
 * Camille Martin's preferences as the gateway answers them, with an extra field the page ignores.
 *
 * @param {number} version - Version of the preferences.
 * @returns {Record<string, unknown>} The preferences.
 */
function answer(version: number): Record<string, unknown> {
  return {
    channels: {
      mention: { inApp: true, email: true, mobile: true },
      assignment: { inApp: true, email: true, mobile: true },
      comment: { inApp: true, email: false, mobile: false },
      statusChange: { inApp: true, email: false, mobile: false },
      dueDate: { inApp: true, email: true, mobile: true },
      access: { inApp: true, email: true, mobile: false },
      billing: { inApp: true, email: true, mobile: false, sms: true },
    },
    digest: 'daily',
    doNotDisturb: true,
    version,
  };
}

/**
 * Constant versionMismatch
 *
 * @description
 * The gateway's `412 request.version-mismatch`.
 *
 * @type {HttpErrorResponse}
 */
const versionMismatch: HttpErrorResponse = new HttpErrorResponse({
  status: 412,
  error: { type: 'about:blank', status: 412, code: 'request.version-mismatch' },
});

describe('NotificationPreferencesApi', () => {
  let service: { getNotificationPreferences: Mock; updateNotificationPreferences: Mock };
  let auth: { getCurrentUser: Mock };
  let request: Mock;
  let api: NotificationPreferencesApi;

  beforeEach(() => {
    service = {
      getNotificationPreferences: vi.fn(() => of(answer(3))),
      updateNotificationPreferences: vi.fn(() => of(answer(4))),
    };
    auth = { getCurrentUser: vi.fn(() => of({ id: 'u-camille' })) };
    request = vi.fn(
      (_name: string, _options: LockOptions, run: () => Promise<void>): Promise<void> => run(),
    );
    vi.stubGlobal('navigator', { locks: { request } });
    TestBed.configureTestingModule({
      providers: [
        { provide: NotificationPreferencesService, useValue: service },
        { provide: AuthService, useValue: auth },
      ],
    });
    api = TestBed.inject(NotificationPreferencesApi);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the preferences of the signed-in account as display models, under the shared lock', async () => {
    const preferences: NotificationPreferences = await api.read('u-camille');
    expect(preferences.version).toBe(3);
    expect(preferences.channels.billing).toEqual({ inApp: true, email: true, mobile: false });
    expect(request.mock.calls[0]?.[1]).toMatchObject({ mode: 'shared' });
  });

  it('refuses to read the preferences of another account', async () => {
    auth.getCurrentUser.mockReturnValueOnce(of({ id: 'u-lucas' }));
    await expect(api.read('u-camille')).rejects.toBeInstanceOf(AccountChangedError);
    expect(service.getNotificationPreferences).not.toHaveBeenCalled();
  });

  it('sends one matrix box as a merge patch against its version, under the exclusive lock', async () => {
    const saved: NotificationPreferences = await api.write(
      { kind: 'channel', event: 'statusChange', channel: 'mobile', enabled: true },
      3,
      'u-camille',
    );
    expect(saved.version).toBe(4);
    expect(service.updateNotificationPreferences).toHaveBeenCalledWith(
      { channels: { statusChange: { mobile: true } } },
      { headers: { 'If-Match': '"3"' } },
    );
    expect(request.mock.calls[0]?.[1]).toMatchObject({ mode: 'exclusive' });
  });

  it('sends the digest and the quiet hours alone', async () => {
    await api.write({ kind: 'digest', digest: 'weekly' }, 3, 'u-camille');
    await api.write({ kind: 'doNotDisturb', enabled: false }, 4, 'u-camille');
    expect(
      service.updateNotificationPreferences.mock.calls.map(([patch]: unknown[]): unknown => patch),
    ).toEqual([{ digest: 'weekly' }, { doNotDisturb: false }]);
  });

  it('sends nothing once another account or no account holds the session', async () => {
    auth.getCurrentUser
      .mockReturnValueOnce(of({ id: 'u-lucas' }))
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 401 })));

    await expect(
      api.write({ kind: 'digest', digest: 'never' }, 3, 'u-camille'),
    ).rejects.toBeInstanceOf(AccountChangedError);
    await expect(
      api.write({ kind: 'digest', digest: 'never' }, 3, 'u-camille'),
    ).rejects.toBeInstanceOf(AccountChangedError);
    expect(service.updateNotificationPreferences).not.toHaveBeenCalled();
  });

  it('says a write was not sent when the identity check fails', async () => {
    auth.getCurrentUser.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
    const failure: unknown = await api
      .write({ kind: 'digest', digest: 'never' }, 3, 'u-camille')
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(WriteNotSentError);
    expect(isUncertainWrite(failure)).toBe(false);
    expect(service.updateNotificationPreferences).not.toHaveBeenCalled();
  });

  it('rejects a refusal of the patch as it is', async () => {
    service.updateNotificationPreferences.mockReturnValueOnce(throwError(() => versionMismatch));
    await expect(api.write({ kind: 'digest', digest: 'never' }, 3, 'u-camille')).rejects.toBe(
      versionMismatch,
    );
  });
});

describe('isUncertainWrite', () => {
  it('treats no answer and server failures as unknown outcomes', () => {
    expect(isUncertainWrite(new HttpErrorResponse({ status: 0 }))).toBe(true);
    expect(isUncertainWrite(new HttpErrorResponse({ status: 503 }))).toBe(true);
    expect(isUncertainWrite(new HttpErrorResponse({ status: 504 }))).toBe(true);
    expect(isUncertainWrite(new Error('timeout'))).toBe(true);
  });

  it('treats a refusal, a write never sent and a changed account as recording nothing', () => {
    expect(isUncertainWrite(new HttpErrorResponse({ status: 403 }))).toBe(false);
    expect(isUncertainWrite(versionMismatch)).toBe(false);
    expect(isUncertainWrite(new WriteNotSentError(new Error('locks')))).toBe(false);
    expect(isUncertainWrite(new AccountChangedError())).toBe(false);
  });

  it('recognises the version mismatch', () => {
    expect(isVersionMismatch(versionMismatch)).toBe(true);
    expect(isVersionMismatch(new HttpErrorResponse({ status: 412 }))).toBe(false);
  });
});
