import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { AccountChangedError } from '../../data-access/services/notification-preferences-api/account-changed.error';
import { SecurityApi } from '../../data-access/services/security-api/security-api.service';
import type { AccountSession } from '../../models/session/session.interface';
import type { SecurityOverview } from '../../models/two-step/security-overview.interface';
import type { BackupCodeSet, TwoStepOverview } from '../../models/two-step/two-step.interface';
import { ReauthenticationCancelledError } from '../../reauthentication/reauthentication-cancelled.error';
import { ReauthenticationService } from '../../reauthentication/reauthentication.service';
import { SecurityKeyRegistration } from '../../services/security-key-registration/security-key-registration.service';
import { SECURITY_REREAD_DELAYS, SECURITY_REREAD_DELAYS_MS } from './security-reread-delays.token';
import { SecurityStore } from './security.store';

/**
 * Constant TWO_STEP_ON
 *
 * @description
 * Camille's two-step verification in the mockup: the app, one key, 7 codes out of 10.
 *
 * @type {TwoStepOverview}
 */
const TWO_STEP_ON: TwoStepOverview = {
  enabled: true,
  appIsPrimary: true,
  appConfiguredAt: '2026-03-03T09:00:00Z',
  securityKeys: [
    { id: 'k1', name: 'YubiKey 5C NFC', createdAt: '2026-03-04T09:00:00Z', lastUsedAt: null },
  ],
  backupCodes: { remaining: 7, total: 10, generatedAt: '2026-03-03T09:00:00Z' },
  requiredBy: [{ organizationId: 'org-nord', requiredFor: 'admins' }],
};

/**
 * Constant TWO_STEP_OFF
 *
 * @description
 * Two-step verification off and required by nobody.
 *
 * @type {TwoStepOverview}
 */
const TWO_STEP_OFF: TwoStepOverview = {
  enabled: false,
  appIsPrimary: false,
  appConfiguredAt: null,
  securityKeys: [],
  backupCodes: null,
  requiredBy: [],
};

/**
 * Function session
 *
 * @description
 * A session of the mockup's list (`Compte.dc.html` lines 1463-1466).
 *
 * @param {string} id - Its id.
 * @param {boolean} current - Whether it is this browser's.
 * @returns {AccountSession} The session.
 */
function session(id: string, current: boolean): AccountSession {
  return {
    id,
    current,
    deviceType: current ? 'desktop' : 'mobile',
    device: current ? 'Firefox 132 · Windows 11' : 'Cadenway · iPhone 15',
    ipAddress: current ? '192.0.2.14' : '198.51.100.7',
    lastActiveAt: '2026-11-08T09:00:00Z',
    inactivityTimeoutMinutes: 720,
  };
}

/**
 * Constant OVERVIEW
 *
 * @description
 * The section as read for Camille.
 *
 * @type {SecurityOverview}
 */
const OVERVIEW: SecurityOverview = {
  email: 'camille.martin@atelier-nord.fr',
  passwordChangedAt: '2026-08-12T09:00:00Z',
  twoStep: TWO_STEP_ON,
  sessions: [session('s1', true), session('s2', false), session('s3', false)],
};

/**
 * Constant CODES
 *
 * @description
 * The mockup's backup codes (`Compte.dc.html` line 1490).
 *
 * @type {BackupCodeSet}
 */
const CODES: BackupCodeSet = {
  codes: [
    '4F7K-2M9Q',
    'H3XP-8D2L',
    'Q9TZ-5W1C',
    'B6NR-7J4E',
    'K2VD-9S8A',
    'M8LC-3F6P',
    'T5QW-1H7Z',
    'R4GY-6B3N',
    'C7EJ-2K5U',
    'W1PS-8V9D',
  ],
  generatedAt: '2026-11-08T09:00:00Z',
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
  return new HttpErrorResponse({ status, error: { type: 'about:blank', status, code, details } });
}

describe('SecurityStore', () => {
  let api: Record<string, Mock>;
  let keys: { supported: Mock; create: Mock };
  let run: Mock;
  let user: WritableSignal<{ id: string }>;

  /**
   * Function store
   *
   * @description
   * Creates the store and waits for its read.
   *
   * @param {readonly number[]} [delays] - The delays before each read that settles a lost
   * answer; none by default, so specs do not wait.
   * @returns {Promise<InstanceType<typeof SecurityStore>>} The store after the read.
   */
  async function store(
    delays: readonly number[] = [0, 0, 0, 0],
  ): Promise<InstanceType<typeof SecurityStore>> {
    TestBed.configureTestingModule({
      providers: [
        SecurityStore,
        { provide: SECURITY_REREAD_DELAYS, useValue: delays },
        { provide: SecurityApi, useValue: api },
        { provide: SecurityKeyRegistration, useValue: keys },
        { provide: ReauthenticationService, useValue: { run } },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: { user, organization: signal({ id: 'org-nord', name: 'Atelier Nord' }) },
        },
      ],
    });
    const instance: InstanceType<typeof SecurityStore> = TestBed.inject(SecurityStore);
    await TestBed.inject(ApplicationRef).whenStable();
    return instance;
  }

  beforeEach(() => {
    api = {
      overview: vi.fn(() => Promise.resolve(OVERVIEW)),
      changePassword: vi.fn(() => Promise.resolve('2026-11-08T10:00:00Z')),
      startAuthenticatorSetup: vi.fn(() => Promise.resolve({ secret: 'JBSWY3DPEHPK3PXP' })),
      confirmAuthenticatorSetup: vi.fn(() =>
        Promise.resolve({ twoStep: TWO_STEP_ON, backupCodes: CODES }),
      ),
      disableTwoStep: vi.fn(() => Promise.resolve()),
      regenerateBackupCodes: vi.fn(() => Promise.resolve(CODES)),
      startSecurityKeyRegistration: vi.fn(() => Promise.resolve({ challenge: 'Zml4dHVyZQ' })),
      addSecurityKey: vi.fn(() =>
        Promise.resolve({
          id: 'k2',
          name: 'Touch ID (MacBook Air)',
          createdAt: '2026-11-08T10:00:00Z',
          lastUsedAt: null,
        }),
      ),
      removeSecurityKey: vi.fn(() => Promise.resolve()),
      revokeSession: vi.fn(() => Promise.resolve()),
      revokeOtherSessions: vi.fn(() => Promise.resolve(2)),
    };
    keys = { supported: vi.fn(() => true), create: vi.fn(() => Promise.resolve({ id: 'cred' })) };
    run = vi.fn((operation: () => Promise<unknown>) => operation());
    user = signal({ id: 'u-camille' });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('reads the section of the workspace account, and again for another account', async () => {
    const instance: InstanceType<typeof SecurityStore> = await store();
    expect(api['overview']).toHaveBeenCalledWith('u-camille', expect.any(AbortSignal));
    expect(instance.overview()?.sessions).toHaveLength(3);
    user.set({ id: 'u-lea' });
    await TestBed.inject(ApplicationRef).whenStable();
    expect(api['overview']).toHaveBeenLastCalledWith('u-lea', expect.any(AbortSignal));
  });

  it('shows the new password date once the change is saved', async () => {
    const instance: InstanceType<typeof SecurityStore> = await store();
    await expect(instance.changePassword('old secret', 'a new long secret')).resolves.toEqual({
      kind: 'saved',
    });
    expect(api['changePassword']).toHaveBeenCalledWith(
      'u-camille',
      'old secret',
      'a new long secret',
    );
    expect(instance.overview()?.passwordChangedAt).toBe('2026-11-08T10:00:00Z');
    expect(instance.busy()).toBeNull();
  });

  it('maps the password refusals of the contract', async () => {
    const instance: InstanceType<typeof SecurityStore> = await store();
    api['changePassword'].mockRejectedValueOnce(
      problem(422, 'auth.password-incorrect', { remainingAttempts: 2 }),
    );
    await expect(instance.changePassword('wrong', 'a new long secret')).resolves.toEqual({
      kind: 'password-incorrect',
      remainingAttempts: 2,
    });
    api['changePassword'].mockRejectedValueOnce(problem(422, 'auth.password-compromised'));
    await expect(instance.changePassword('old', 'password12345')).resolves.toEqual({
      kind: 'password-compromised',
    });
    api['changePassword'].mockRejectedValueOnce(problem(429, 'rate-limit.exceeded'));
    await expect(instance.changePassword('old', 'a new long secret')).resolves.toEqual({
      kind: 'failed',
    });
    expect(instance.overview()?.passwordChangedAt).toBe('2026-08-12T09:00:00Z');
  });

  it('ends silently when the reauthentication dialog is closed', async () => {
    run.mockRejectedValueOnce(new ReauthenticationCancelledError());
    const instance: InstanceType<typeof SecurityStore> = await store();
    await expect(instance.disable()).resolves.toEqual({ kind: 'cancelled' });
    expect(instance.overview()?.twoStep.enabled).toBe(true);
  });

  it('sends nothing once the account changed, the retry after a reauthentication included', async () => {
    let retry: () => Promise<unknown> = (): Promise<unknown> => Promise.resolve();
    run.mockImplementationOnce(async (operation: () => Promise<unknown>) => {
      retry = operation;
      user.set({ id: 'u-lea' });
      return retry();
    });
    const instance: InstanceType<typeof SecurityStore> = await store();
    await expect(instance.revokeOtherSessions()).resolves.toEqual({ kind: 'cancelled' });
    expect(api['revokeOtherSessions']).not.toHaveBeenCalled();
  });

  it('drops the answer of a write whose page is gone', async () => {
    let finish: (count: number) => void = (): void => undefined;
    api['revokeOtherSessions'].mockReturnValueOnce(
      new Promise<number>((resolve: (count: number) => void): void => {
        finish = resolve;
      }),
    );
    const instance: InstanceType<typeof SecurityStore> = await store();
    const pending: Promise<unknown> = instance.revokeOtherSessions();
    expect(instance.sending()).toBe(true);
    TestBed.resetTestingModule();
    finish(2);
    await expect(pending).resolves.toEqual({ kind: 'cancelled' });
  });

  it('treats an account changed under the lock as cancelled', async () => {
    api['revokeSession'].mockRejectedValueOnce(new AccountChangedError());
    const instance: InstanceType<typeof SecurityStore> = await store();
    await expect(instance.revokeSession(session('s2', false))).resolves.toEqual({
      kind: 'cancelled',
    });
    expect(instance.overview()?.sessions).toHaveLength(3);
  });

  it('waits in sent() for the write on its way', async () => {
    let finish: () => void = (): void => undefined;
    api['revokeSession'].mockReturnValueOnce(
      new Promise<void>((resolve: () => void): void => {
        finish = resolve;
      }),
    );
    const instance: InstanceType<typeof SecurityStore> = await store();
    const revoking: Promise<unknown> = instance.revokeSession(session('s2', false));
    let settled: boolean = false;
    void instance.sent().then((): void => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(instance.busyId()).toBe('s2');
    finish();
    await revoking;
    expect(settled).toBe(true);
    expect(instance.overview()?.sessions.map((item: AccountSession): string => item.id)).toEqual([
      's1',
      's3',
    ]);
  });

  it('runs one write at a time', async () => {
    api['revokeSession'].mockReturnValueOnce(new Promise<void>((): void => undefined));
    const instance: InstanceType<typeof SecurityStore> = await store();
    void instance.revokeSession(session('s2', false));
    await expect(instance.revokeOtherSessions()).resolves.toEqual({ kind: 'skipped' });
  });

  it('counts a session already gone as revoked', async () => {
    api['revokeSession'].mockRejectedValueOnce(problem(404, 'session.not-found'));
    const instance: InstanceType<typeof SecurityStore> = await store();
    await expect(instance.revokeSession(session('s3', false))).resolves.toEqual({ kind: 'done' });
    expect(instance.overview()?.sessions).toHaveLength(2);
  });

  it('keeps only this browser once the other sessions are closed', async () => {
    const instance: InstanceType<typeof SecurityStore> = await store();
    await expect(instance.revokeOtherSessions()).resolves.toEqual({ kind: 'done', count: 2 });
    expect(instance.overview()?.sessions.map((item: AccountSession): string => item.id)).toEqual([
      's1',
    ]);
  });

  it('returns the setup key and the first codes without keeping them', async () => {
    const instance: InstanceType<typeof SecurityStore> = await store();
    await expect(instance.startSetup()).resolves.toEqual({
      kind: 'started',
      setup: { secret: 'JBSWY3DPEHPK3PXP' },
    });
    await expect(instance.confirmSetup('123456')).resolves.toEqual({
      kind: 'confirmed',
      backupCodes: CODES,
    });
    expect(JSON.stringify(instance.overview())).not.toContain('JBSWY3DPEHPK3PXP');
    expect(JSON.stringify(instance.overview())).not.toContain('4F7K-2M9Q');
  });

  it('maps a refused or expired setup code', async () => {
    const instance: InstanceType<typeof SecurityStore> = await store();
    api['confirmAuthenticatorSetup'].mockRejectedValueOnce(
      problem(422, 'auth.two-step-code-invalid'),
    );
    await expect(instance.confirmSetup('000000')).resolves.toEqual({ kind: 'code-invalid' });
    api['confirmAuthenticatorSetup'].mockRejectedValueOnce(
      problem(422, 'auth.two-step-setup-expired'),
    );
    await expect(instance.confirmSetup('000000')).resolves.toEqual({ kind: 'expired' });
  });

  it('turns two-step verification off, or says an organization requires it', async () => {
    const instance: InstanceType<typeof SecurityStore> = await store();
    api['disableTwoStep'].mockRejectedValueOnce(problem(409, 'auth.mfa-required-by-organization'));
    await expect(instance.disable()).resolves.toEqual({ kind: 'required' });
    expect(instance.overview()?.twoStep.enabled).toBe(true);
    await expect(instance.disable()).resolves.toEqual({ kind: 'disabled' });
    expect(instance.overview()?.twoStep.securityKeys).toEqual([]);
    expect(instance.overview()?.twoStep.backupCodes).toBeNull();
  });

  it('says how many codes new ones replaced', async () => {
    const instance: InstanceType<typeof SecurityStore> = await store();
    await expect(instance.regenerateBackupCodes()).resolves.toEqual({
      kind: 'generated',
      codes: CODES,
      replaced: 7,
    });
    expect(instance.overview()?.twoStep.backupCodes).toEqual({
      remaining: 10,
      total: 10,
      generatedAt: '2026-11-08T09:00:00Z',
    });
  });

  it('registers a key through the browser prompt', async () => {
    const instance: InstanceType<typeof SecurityStore> = await store();
    await expect(instance.addSecurityKey('Touch ID (MacBook Air)')).resolves.toEqual({
      kind: 'added',
    });
    expect(keys.create).toHaveBeenCalledWith({ challenge: 'Zml4dHVyZQ' });
    expect(api['addSecurityKey']).toHaveBeenCalledWith('u-camille', 'Touch ID (MacBook Air)', {
      id: 'cred',
    });
    expect(instance.overview()?.twoStep.securityKeys).toHaveLength(2);
  });

  it('ends silently when the browser prompt is closed', async () => {
    keys.create.mockRejectedValueOnce(
      Object.assign(new Error('closed'), { name: 'NotAllowedError' }),
    );
    const instance: InstanceType<typeof SecurityStore> = await store();
    await expect(instance.addSecurityKey('YubiKey')).resolves.toEqual({ kind: 'cancelled' });
    expect(api['addSecurityKey']).not.toHaveBeenCalled();
  });

  it('maps a refused key', async () => {
    api['addSecurityKey'].mockRejectedValueOnce(problem(422, 'auth.security-key-refused'));
    const instance: InstanceType<typeof SecurityStore> = await store();
    await expect(instance.addSecurityKey('YubiKey')).resolves.toEqual({ kind: 'refused' });
  });

  it('removes a key', async () => {
    const instance: InstanceType<typeof SecurityStore> = await store();
    const key: TwoStepOverview['securityKeys'][number] = TWO_STEP_ON.securityKeys[0];
    await expect(instance.removeSecurityKey(key)).resolves.toEqual({ kind: 'done' });
    expect(api['removeSecurityKey']).toHaveBeenCalledWith('u-camille', 'k1');
    expect(instance.overview()?.twoStep.securityKeys).toEqual([]);
  });

  describe('when the answer of a write is lost', () => {
    /**
     * Constant LOST
     *
     * @description
     * An answer that never arrived (no status).
     *
     * @type {HttpErrorResponse}
     */
    const LOST: HttpErrorResponse = new HttpErrorResponse({ status: 0 });

    it('counts a password change as saved when the date read again is newer, and never resends it', async () => {
      const instance: InstanceType<typeof SecurityStore> = await store();
      api['changePassword'].mockRejectedValueOnce(LOST);
      api['overview'].mockResolvedValueOnce({
        ...OVERVIEW,
        passwordChangedAt: '2026-11-08T10:00:00Z',
      });
      await expect(instance.changePassword('old secret', 'a new long secret')).resolves.toEqual({
        kind: 'saved',
      });
      expect(api['changePassword']).toHaveBeenCalledOnce();
      expect(instance.overview()?.passwordChangedAt).toBe('2026-11-08T10:00:00Z');
    });

    it('leaves a password change unconfirmed, never failed, when no read shows it', async () => {
      const instance: InstanceType<typeof SecurityStore> = await store();
      api['changePassword'].mockRejectedValueOnce(problem(503, 'gateway.unavailable'));
      await expect(instance.changePassword('old secret', 'a new long secret')).resolves.toEqual({
        kind: 'unconfirmed',
      });
      expect(api['changePassword']).toHaveBeenCalledOnce();
      expect(api['overview']).toHaveBeenCalledTimes(5);
    });

    it('reads again at once, then 2, 4 and 8 seconds later', async () => {
      const instance: InstanceType<typeof SecurityStore> = await store(SECURITY_REREAD_DELAYS_MS);
      expect(SECURITY_REREAD_DELAYS_MS).toEqual([0, 2000, 4000, 8000]);
      vi.useFakeTimers();
      try {
        api['disableTwoStep'].mockRejectedValueOnce(LOST);
        const pending: Promise<unknown> = instance.disable();
        await vi.advanceTimersByTimeAsync(0);
        expect(api['overview']).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(1999);
        expect(api['overview']).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(1);
        expect(api['overview']).toHaveBeenCalledTimes(3);
        await vi.advanceTimersByTimeAsync(4000);
        expect(api['overview']).toHaveBeenCalledTimes(4);
        expect(instance.sending()).toBe(true);
        await vi.advanceTimersByTimeAsync(8000);
        expect(api['overview']).toHaveBeenCalledTimes(5);
        await expect(pending).resolves.toEqual({ kind: 'unconfirmed' });
      } finally {
        vi.useRealTimers();
      }
    });

    it('settles a write the gateway applies only after the first read again', async () => {
      const instance: InstanceType<typeof SecurityStore> = await store();
      api['regenerateBackupCodes'].mockRejectedValueOnce(problem(504, 'gateway.timeout'));
      api['overview']
        .mockResolvedValueOnce(OVERVIEW)
        .mockResolvedValueOnce(OVERVIEW)
        .mockResolvedValueOnce({
          ...OVERVIEW,
          twoStep: {
            ...TWO_STEP_ON,
            backupCodes: { remaining: 10, total: 10, generatedAt: '2026-11-08T09:00:00Z' },
          },
        });
      await expect(instance.regenerateBackupCodes()).resolves.toEqual({ kind: 'codes-unseen' });
      expect(api['overview']).toHaveBeenCalledTimes(4);
      expect(api['regenerateBackupCodes']).toHaveBeenCalledOnce();
    });

    it('stays unconfirmed, outside the error boundary, when the read fails too', async () => {
      const instance: InstanceType<typeof SecurityStore> = await store();
      api['changePassword'].mockRejectedValueOnce(LOST);
      api['overview'].mockRejectedValueOnce(LOST);
      await expect(instance.changePassword('old secret', 'a new long secret')).resolves.toEqual({
        kind: 'unconfirmed',
      });
      expect(instance.security.status()).not.toBe('error');
      expect(instance.overview()?.passwordChangedAt).toBe('2026-08-12T09:00:00Z');
    });

    it('stays sending until the read again settled the write', async () => {
      let finish: (value: SecurityOverview) => void = (): void => undefined;
      const instance: InstanceType<typeof SecurityStore> = await store();
      api['regenerateBackupCodes'].mockRejectedValueOnce(LOST);
      api['overview'].mockReturnValueOnce(
        new Promise<SecurityOverview>((resolve: (value: SecurityOverview) => void): void => {
          finish = resolve;
        }),
      );
      const pending: Promise<unknown> = instance.regenerateBackupCodes();
      await vi.waitFor(() => {
        expect(api['overview']).toHaveBeenCalledTimes(2);
      });
      expect(instance.sending()).toBe(true);
      finish(OVERVIEW);
      await expect(pending).resolves.toEqual({ kind: 'unconfirmed' });
      expect(instance.sending()).toBe(false);
    });

    it('says codes went unseen when the generation date read again is newer', async () => {
      const instance: InstanceType<typeof SecurityStore> = await store();
      api['regenerateBackupCodes'].mockRejectedValueOnce(problem(502, 'gateway.unavailable'));
      api['overview'].mockResolvedValueOnce({
        ...OVERVIEW,
        twoStep: {
          ...TWO_STEP_ON,
          backupCodes: { remaining: 10, total: 10, generatedAt: '2026-11-08T09:00:00Z' },
        },
      });
      await expect(instance.regenerateBackupCodes()).resolves.toEqual({ kind: 'codes-unseen' });
      expect(instance.overview()?.twoStep.backupCodes?.remaining).toBe(10);
    });

    it('says a setup turned two-step verification on without showing its codes', async () => {
      api['overview'].mockResolvedValueOnce({ ...OVERVIEW, twoStep: TWO_STEP_OFF });
      const instance: InstanceType<typeof SecurityStore> = await store();
      api['confirmAuthenticatorSetup'].mockRejectedValueOnce(LOST);
      api['overview'].mockResolvedValueOnce(OVERVIEW);
      await expect(instance.confirmSetup('123456')).resolves.toEqual({
        kind: 'enabled-without-codes',
      });
      expect(instance.overview()?.twoStep.enabled).toBe(true);
    });

    it('leaves a setup unconfirmed while two-step verification still reads off', async () => {
      api['overview'].mockResolvedValue({ ...OVERVIEW, twoStep: TWO_STEP_OFF });
      const instance: InstanceType<typeof SecurityStore> = await store();
      api['confirmAuthenticatorSetup'].mockRejectedValueOnce(problem(408, 'request.timeout'));
      await expect(instance.confirmSetup('123456')).resolves.toEqual({ kind: 'unconfirmed' });
    });

    it('counts a key removal as done once the key is gone from a read again', async () => {
      const instance: InstanceType<typeof SecurityStore> = await store();
      api['removeSecurityKey'].mockRejectedValueOnce(LOST);
      api['overview'].mockResolvedValueOnce({
        ...OVERVIEW,
        twoStep: { ...TWO_STEP_ON, securityKeys: [] },
      });
      await expect(instance.removeSecurityKey(TWO_STEP_ON.securityKeys[0])).resolves.toEqual({
        kind: 'done',
      });
      expect(instance.overview()?.twoStep.securityKeys).toEqual([]);
    });

    it('leaves a revocation unconfirmed while the session still reads open', async () => {
      const instance: InstanceType<typeof SecurityStore> = await store();
      api['revokeSession'].mockRejectedValueOnce(LOST);
      await expect(instance.revokeSession(session('s2', false))).resolves.toEqual({
        kind: 'unconfirmed',
      });
      expect(instance.overview()?.sessions).toHaveLength(3);
    });

    it('counts the other sessions as closed once a read again shows none', async () => {
      const instance: InstanceType<typeof SecurityStore> = await store();
      api['revokeOtherSessions'].mockRejectedValueOnce(LOST);
      api['overview'].mockResolvedValueOnce({ ...OVERVIEW, sessions: [session('s1', true)] });
      await expect(instance.revokeOtherSessions()).resolves.toEqual({ kind: 'done', count: 2 });
    });

    it('counts a key as registered once a read again shows a new key', async () => {
      const instance: InstanceType<typeof SecurityStore> = await store();
      api['addSecurityKey'].mockRejectedValueOnce(LOST);
      api['overview'].mockResolvedValueOnce({
        ...OVERVIEW,
        twoStep: {
          ...TWO_STEP_ON,
          securityKeys: [
            ...TWO_STEP_ON.securityKeys,
            { id: 'k2', name: 'Touch ID', createdAt: '2026-11-08T10:00:00Z', lastUsedAt: null },
          ],
        },
      });
      await expect(instance.addSecurityKey('Touch ID')).resolves.toEqual({ kind: 'added' });
      expect(api['addSecurityKey']).toHaveBeenCalledOnce();
    });

    it('does not read again when the key registration could not start', async () => {
      const instance: InstanceType<typeof SecurityStore> = await store();
      api['startSecurityKeyRegistration'].mockRejectedValueOnce(LOST);
      await expect(instance.addSecurityKey('Touch ID')).resolves.toEqual({ kind: 'failed' });
      expect(api['overview']).toHaveBeenCalledOnce();
      expect(keys.create).not.toHaveBeenCalled();
    });

    it('counts turning off as done when the read again shows it off', async () => {
      const instance: InstanceType<typeof SecurityStore> = await store();
      api['disableTwoStep'].mockRejectedValueOnce(LOST);
      api['overview'].mockResolvedValueOnce({ ...OVERVIEW, twoStep: TWO_STEP_OFF });
      await expect(instance.disable()).resolves.toEqual({ kind: 'disabled' });
      expect(instance.overview()?.twoStep.enabled).toBe(false);
    });

    it('does not read again after a refusal', async () => {
      const instance: InstanceType<typeof SecurityStore> = await store();
      api['disableTwoStep'].mockRejectedValueOnce(
        problem(409, 'auth.mfa-required-by-organization'),
      );
      await expect(instance.disable()).resolves.toEqual({ kind: 'required' });
      expect(api['overview']).toHaveBeenCalledOnce();
    });
  });
});
