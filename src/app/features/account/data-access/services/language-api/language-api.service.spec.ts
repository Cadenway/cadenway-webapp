import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { AuthService, type CurrentUser } from '@cadenway/api-client';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { AccountChangedError } from '../notification-preferences-api/account-changed.error';
import { WriteNotSentError } from '../notification-preferences-api/write-not-sent.error';
import type { AccountLanguageSettings } from './account-language.interface';
import { LanguageApi, toAccountLanguageSettings } from './language-api.service';

/**
 * Function camille
 *
 * @description
 * Camille Martin's account as the gateway answers it.
 *
 * @param {string} language - The account's language tag.
 * @param {number} version - Version of the account.
 * @returns {CurrentUser} The current user.
 */
function camille(language: string, version: number): CurrentUser {
  return {
    id: 'u-camille',
    name: 'Camille Martin',
    email: 'camille.martin@ateliernord.fr',
    language,
    displayName: null,
    jobTitle: null,
    timeZone: 'Europe/Paris',
    version,
  };
}

describe('LanguageApi', () => {
  let auth: { getCurrentUser: Mock; updateCurrentUser: Mock };
  let request: Mock;
  let api: LanguageApi;

  beforeEach(() => {
    auth = {
      getCurrentUser: vi.fn(() => of(camille('fr', 7))),
      updateCurrentUser: vi.fn(() => of(camille('en', 8))),
    };
    request = vi.fn(
      (_name: string, _options: LockOptions, run: () => Promise<void>): Promise<void> => run(),
    );
    vi.stubGlobal('navigator', { locks: { request } });
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: auth }] });
    api = TestBed.inject(LanguageApi);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the language of the signed-in account, under the shared lock', async () => {
    const settings: AccountLanguageSettings = await api.read('u-camille');

    expect(settings).toEqual({ language: 'fr', version: 7 });
    expect(request.mock.calls[0]?.[1]).toMatchObject({ mode: 'shared' });
  });

  it('refuses to read the language of another account', async () => {
    auth.getCurrentUser.mockReturnValueOnce(of({ ...camille('fr', 7), id: 'u-lucas' }));

    await expect(api.read('u-camille')).rejects.toBeInstanceOf(AccountChangedError);
  });

  it('sends the language alone against its version, under the exclusive lock', async () => {
    const saved: AccountLanguageSettings = await api.write('en', 7, 'u-camille');

    expect(saved).toEqual({ language: 'en', version: 8 });
    expect(auth.updateCurrentUser).toHaveBeenCalledWith(
      { language: 'en' },
      { headers: { 'If-Match': '"7"' } },
    );
    expect(request.mock.calls[0]?.[1]).toMatchObject({ mode: 'exclusive' });
  });

  it('sends nothing once another account or no account holds the session', async () => {
    auth.getCurrentUser
      .mockReturnValueOnce(of({ ...camille('fr', 7), id: 'u-lucas' }))
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 401 })));

    await expect(api.write('en', 7, 'u-camille')).rejects.toBeInstanceOf(AccountChangedError);
    await expect(api.write('en', 7, 'u-camille')).rejects.toBeInstanceOf(AccountChangedError);
    expect(auth.updateCurrentUser).not.toHaveBeenCalled();
  });

  it('says a write was not sent when the account check fails', async () => {
    auth.getCurrentUser.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));

    await expect(api.write('de', 7, 'u-camille')).rejects.toBeInstanceOf(WriteNotSentError);
    expect(auth.updateCurrentUser).not.toHaveBeenCalled();
  });

  it('rejects a refusal of the patch as it is', async () => {
    const mismatch: HttpErrorResponse = new HttpErrorResponse({
      status: 412,
      error: { type: 'about:blank', status: 412, code: 'request.version-mismatch' },
    });
    auth.updateCurrentUser.mockReturnValueOnce(throwError(() => mismatch));

    await expect(api.write('de', 7, 'u-camille')).rejects.toBe(mismatch);
  });
});

describe('toAccountLanguageSettings', () => {
  it('matches the primary subtag and reads an unknown tag as null', () => {
    expect(toAccountLanguageSettings(camille('FR-fr', 2)).language).toBe('fr');
    expect(toAccountLanguageSettings(camille('es', 2)).language).toBe('es');
    expect(toAccountLanguageSettings(camille('it', 2)).language).toBeNull();
  });
});
