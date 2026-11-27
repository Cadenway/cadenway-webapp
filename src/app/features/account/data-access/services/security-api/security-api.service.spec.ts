import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  AccountService,
  AuthService,
  SessionsService,
  TwoStepVerificationService,
} from '@cadenway/api-client';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { SecurityOverview } from '../../../models/two-step/security-overview.interface';
import { AccountChangedError } from '../notification-preferences-api/account-changed.error';
import { IncompleteSessionListError, SecurityApi } from './security-api.service';

/**
 * Function openSession
 *
 * @description
 * A session as the gateway lists it.
 *
 * @param {string} id - Its id.
 * @param {boolean} current - Whether it is the request's.
 * @param {string} lastActiveAt - Its last activity.
 * @returns {Record<string, unknown>} The session.
 */
function openSession(id: string, current: boolean, lastActiveAt: string): Record<string, unknown> {
  return {
    id,
    current,
    device: {
      type: 'desktop',
      browser: 'Firefox',
      browserVersion: '132',
      os: 'Windows',
      osVersion: '11',
    },
    ipAddress: '192.0.2.14',
    signedInAt: '2026-11-01T08:00:00Z',
    lastActiveAt,
    expiresAt: '2026-12-01T08:00:00Z',
    inactivityTimeoutMinutes: 720,
  };
}

/**
 * Constant TWO_STEP_OFF
 *
 * @description
 * Two-step verification off, as the gateway answers it.
 *
 * @type {Record<string, unknown>}
 */
const TWO_STEP_OFF: Record<string, unknown> = {
  enabled: false,
  primaryMethod: null,
  methods: [],
  authenticatorApp: null,
  securityKeys: [],
  backupCodes: null,
  requiredBy: [],
};

describe('SecurityApi', () => {
  let auth: { getCurrentUser: Mock };
  let account: { changePassword: Mock };
  let twoStep: Record<string, Mock>;
  let sessions: { listSessions: Mock; revokeSession: Mock; revokeOtherSessions: Mock };
  let request: Mock;
  let api: SecurityApi;

  beforeEach(() => {
    auth = {
      getCurrentUser: vi.fn(() =>
        of({
          id: 'u-camille',
          email: 'camille.martin@atelier-nord.fr',
          passwordChangedAt: '2026-08-12T09:00:00Z',
        }),
      ),
    };
    account = {
      changePassword: vi.fn(() =>
        of({ id: 'u-camille', passwordChangedAt: '2026-11-08T09:00:00Z' }),
      ),
    };
    twoStep = {
      getTwoStepVerification: vi.fn(() => of(TWO_STEP_OFF)),
      startAuthenticatorAppSetup: vi.fn(() =>
        of({
          secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
          otpauthUri: 'otpauth://totp/x',
          expiresAt: '',
        }),
      ),
      disableTwoStepVerification: vi.fn(() => of(undefined)),
    };
    sessions = {
      listSessions: vi.fn(() =>
        of({
          items: [
            openSession('s2', false, '2026-11-08T07:00:00Z'),
            openSession('s1', true, '2026-11-08T09:00:00Z'),
          ],
          nextCursor: null,
        }),
      ),
      revokeSession: vi.fn(() => of(undefined)),
      revokeOtherSessions: vi.fn(() => of({ revokedCount: 3 })),
    };
    request = vi.fn(
      (_name: string, _options: LockOptions, run: () => Promise<void>): Promise<void> => run(),
    );
    vi.stubGlobal('navigator', { locks: { request } });
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: AccountService, useValue: account },
        { provide: TwoStepVerificationService, useValue: twoStep },
        { provide: SessionsService, useValue: sessions },
      ],
    });
    api = TestBed.inject(SecurityApi);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('reads the section under the shared session lock, the current session first', async () => {
    const overview: SecurityOverview = await api.overview('u-camille');
    expect(request.mock.calls[0]?.[1]).toMatchObject({ mode: 'shared' });
    expect(overview.email).toBe('camille.martin@atelier-nord.fr');
    expect(overview.passwordChangedAt).toBe('2026-08-12T09:00:00Z');
    expect(overview.twoStep.enabled).toBe(false);
    expect(overview.sessions.map((session) => session.id)).toEqual(['s1', 's2']);
  });

  it('refuses to read another account', async () => {
    await expect(api.overview('u-someone-else')).rejects.toBeInstanceOf(AccountChangedError);
    expect(twoStep['getTwoStepVerification']).not.toHaveBeenCalled();
  });

  it('follows the session cursor and fails on a cursor that repeats', async () => {
    sessions.listSessions
      .mockReturnValueOnce(
        of({ items: [openSession('s1', true, '2026-11-08T09:00:00Z')], nextCursor: 'c1' }),
      )
      .mockReturnValueOnce(of({ items: [], nextCursor: 'c1' }));
    await expect(api.overview('u-camille')).rejects.toBeInstanceOf(IncompleteSessionListError);
    expect(sessions.listSessions).toHaveBeenLastCalledWith({ cursor: 'c1', limit: 100 });
  });

  it('writes under the exclusive lock once the account is checked', async () => {
    await expect(api.changePassword('u-camille', 'old secret', 'a new long secret')).resolves.toBe(
      '2026-11-08T09:00:00Z',
    );
    expect(request.mock.calls[0]?.[1]).toMatchObject({ mode: 'exclusive' });
    expect(account.changePassword).toHaveBeenCalledWith({
      currentPassword: 'old secret',
      newPassword: 'a new long secret',
    });
  });

  it('sends nothing when the session belongs to no account any more', async () => {
    auth.getCurrentUser.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    await expect(api.revokeOtherSessions('u-camille')).rejects.toBeInstanceOf(AccountChangedError);
    expect(sessions.revokeOtherSessions).not.toHaveBeenCalled();
  });

  it('returns only the key of a setup, not its address', async () => {
    await expect(api.startAuthenticatorSetup('u-camille')).resolves.toEqual({
      secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
    });
  });

  it('answers how many sessions it closed', async () => {
    await expect(api.revokeOtherSessions('u-camille')).resolves.toBe(3);
  });
});
