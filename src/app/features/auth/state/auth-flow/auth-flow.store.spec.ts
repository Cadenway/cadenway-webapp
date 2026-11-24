import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

import { AuthApi } from '../../data-access/services/auth-api/auth-api.service';
import { OrganizationApi } from '../../data-access/services/organization-api/organization-api.service';
import type {
  SignedInAccount,
  SignInOutcome,
  TwoStepChallenge,
} from '../../models/session/session.interface';
import { RememberedAccountsService } from '../../services/remembered-accounts/remembered-accounts.service';
import { AuthFlowStore, type SessionResult } from './auth-flow.store';

/**
 * Constant camille
 *
 * @description
 * Camille's Atelier Nord account.
 *
 * @type {SignedInAccount}
 */
const camille: SignedInAccount = { name: 'Camille Martin', email: 'camille.martin@ateliernord.fr' };

/**
 * Constant challenge
 *
 * @description
 * A pending challenge offering the app and backup codes.
 *
 * @type {TwoStepChallenge}
 */
const challenge: TwoStepChallenge = {
  email: camille.email,
  name: camille.name,
  methods: ['authenticator-app', 'backup-code'],
  securityKeys: [],
  backupCodesRemaining: 7,
};

/**
 * Function problem
 *
 * @description
 * Builds a gateway refusal.
 *
 * @param {number} status - HTTP status.
 * @param {string} code - Problem code.
 * @returns {HttpErrorResponse} The refusal.
 */
function problem(status: number, code: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { code } });
}

/**
 * Function setup
 *
 * @description
 * Provides the store with faked data-access services.
 *
 * @param {Partial<Record<keyof AuthApi, unknown>>} auth - Faked auth operations.
 * @param {Partial<Record<keyof OrganizationApi, unknown>>} organizations - Faked organization
 * operations; the current organization defaults to Atelier Nord.
 * @returns {AuthFlowStore} The store.
 */
function setup(
  auth: Partial<Record<keyof AuthApi, unknown>>,
  organizations: Partial<Record<keyof OrganizationApi, unknown>> = {},
): AuthFlowStore {
  TestBed.configureTestingModule({
    providers: [
      AuthFlowStore,
      { provide: AuthApi, useValue: auth },
      {
        provide: OrganizationApi,
        useValue: {
          current: vi.fn(() => Promise.resolve({ id: 'org-atelier-nord', slug: 'atelier-nord' })),
          ...organizations,
        },
      },
    ],
  });
  return TestBed.inject(AuthFlowStore);
}

describe('AuthFlowStore', () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('opens the session organization, remembers the account and keeps the preference', async () => {
    const signInWithPassword: Mock = vi.fn((): Promise<SignInOutcome> =>
      Promise.resolve({ kind: 'signed-in', account: camille }),
    );
    const store: AuthFlowStore = setup({ signInWithPassword });
    store.setRememberMe(false);

    await expect(store.signInWithPassword(camille.email, 'secret')).resolves.toEqual({
      kind: 'signed-in',
      destination: '/atelier-nord',
    });
    expect(signInWithPassword).toHaveBeenCalledWith(camille.email, 'secret', false);
    expect(TestBed.inject(RememberedAccountsService).accounts()).toEqual([camille]);
  });

  it('opens the chooser without a current organization and prefers a ?next= path', async () => {
    const signInWithPassword: () => Promise<SignInOutcome> = () =>
      Promise.resolve({ kind: 'signed-in', account: camille });
    const store: AuthFlowStore = setup(
      { signInWithPassword },
      { current: vi.fn().mockRejectedValue(problem(403, 'organization.not-selected')) },
    );

    await expect(store.signInWithPassword(camille.email, 'secret')).resolves.toMatchObject({
      destination: '/organizations',
    });
    store.setReturnUrl('/invite/invitation-lumen');
    await expect(store.signInWithPassword(camille.email, 'secret')).resolves.toMatchObject({
      destination: '/invite/invitation-lumen',
    });
    store.setReturnUrl('https://evil.example');
    await expect(store.signInWithPassword(camille.email, 'secret')).resolves.toMatchObject({
      destination: '/organizations',
    });
  });

  it('keeps a refused password as a problem with its remaining attempts', async () => {
    const store: AuthFlowStore = setup({
      signInWithPassword: vi.fn().mockRejectedValue(
        new HttpErrorResponse({
          status: 422,
          error: { code: 'auth.invalid-credentials', details: { remainingAttempts: 3 } },
        }),
      ),
    });

    await expect(store.signInWithPassword(camille.email, 'wrong')).resolves.toEqual({
      kind: 'failed',
      problem: { status: 422, code: 'auth.invalid-credentials', remainingAttempts: 3 },
    });
  });

  it('keeps a challenge for the tab, answers it and reads it again after a reload', async () => {
    const answerWithAuthenticatorApp: Mock = vi.fn(() => Promise.resolve(camille));
    const inspectChallenge: Mock = vi.fn(() => Promise.resolve(challenge));
    const store: AuthFlowStore = setup({
      signInWithPassword: (): Promise<SignInOutcome> =>
        Promise.resolve({ kind: 'challenge', token: 'challenge-token', challenge }),
      answerWithAuthenticatorApp,
      inspectChallenge,
    });

    await expect(store.signInWithPassword(camille.email, 'secret')).resolves.toEqual({
      kind: 'challenge',
    });
    expect(store.challenge()).toEqual(challenge);
    expect(sessionStorage.getItem('cadenway-sign-in-challenge')).toBe('challenge-token');
    await expect(store.loadChallenge()).resolves.toBe(true);
    expect(inspectChallenge).not.toHaveBeenCalled();

    TestBed.resetTestingModule();
    const reloaded: AuthFlowStore = setup({ answerWithAuthenticatorApp, inspectChallenge });
    await expect(reloaded.loadChallenge()).resolves.toBe(true);
    expect(inspectChallenge).toHaveBeenCalledWith('challenge-token');

    await expect(
      reloaded.answerChallenge({ method: 'authenticator-app', code: '123456' }, true),
    ).resolves.toEqual({ kind: 'signed-in', destination: '/atelier-nord' });
    expect(answerWithAuthenticatorApp).toHaveBeenCalledWith('challenge-token', '123456', true);
    expect(sessionStorage.getItem('cadenway-sign-in-challenge')).toBeNull();
    expect(reloaded.challenge()).toBeNull();
  });

  it('keeps a challenge after a wrong code and drops an expired one', async () => {
    const answerWithBackupCode: Mock = vi
      .fn()
      .mockRejectedValueOnce(problem(422, 'auth.two-step-code-invalid'))
      .mockRejectedValueOnce(problem(422, 'auth.challenge-expired'));
    const store: AuthFlowStore = setup({
      signInWithCode: (): Promise<SignInOutcome> =>
        Promise.resolve({ kind: 'challenge', token: 'challenge-token', challenge }),
      answerWithBackupCode,
    });
    await store.signInWithCode('123456');

    await store.answerChallenge({ method: 'backup-code', code: 'ABCD-EFGH' }, false);
    expect(store.challenge()).toEqual(challenge);
    const expired: SessionResult = await store.answerChallenge(
      { method: 'backup-code', code: 'ABCD-EFGH' },
      false,
    );
    expect(expired).toMatchObject({ problem: { code: 'auth.challenge-expired' } });
    expect(store.challenge()).toBeNull();
    await expect(store.loadChallenge()).resolves.toBe(false);
  });

  it('redeems the federated continuation once', async () => {
    const finishFederatedSignIn: Mock = vi.fn((): Promise<SignInOutcome> =>
      Promise.resolve({ kind: 'signed-in', account: camille }),
    );
    const store: AuthFlowStore = setup({ finishFederatedSignIn });

    const first: SessionResult = await store.finishFederatedSignIn();
    const second: SessionResult = await store.finishFederatedSignIn();

    expect(finishFederatedSignIn).toHaveBeenCalledOnce();
    expect(second).toEqual(first);
  });

  it('starts SSO only for a domain with a SAML connection', async () => {
    const startFederatedSignIn: Mock = vi.fn(() =>
      Promise.resolve('https://idp.ateliernord.fr/sso'),
    );
    const discoverSignInMethods: Mock = vi
      .fn()
      .mockResolvedValueOnce(['password', 'email-code'])
      .mockResolvedValueOnce(['password', 'saml']);
    const store: AuthFlowStore = setup({ discoverSignInMethods, startFederatedSignIn });

    await expect(store.startSso('camille@gmail.com')).resolves.toEqual({ kind: 'no-sso' });
    expect(startFederatedSignIn).not.toHaveBeenCalled();
    await expect(store.startSso(camille.email)).resolves.toEqual({
      kind: 'redirect',
      url: 'https://idp.ateliernord.fr/sso',
    });
    expect(startFederatedSignIn).toHaveBeenCalledWith({ email: camille.email }, true);
  });

  it('prepares one provider redirect at a time', async () => {
    let release: (url: string) => void = () => undefined;
    const store: AuthFlowStore = setup({
      startFederatedSignIn: () =>
        new Promise<string>((resolve: (url: string) => void) => {
          release = resolve;
        }),
    });

    const first: Promise<unknown> = store.startFederatedSignIn('github');
    expect(store.federatedStarting()).toBe(true);
    await expect(store.startFederatedSignIn('google')).resolves.toBeNull();
    release('https://github.com/login/oauth');
    await expect(first).resolves.toEqual({ ok: true, value: 'https://github.com/login/oauth' });
    expect(store.federatedStarting()).toBe(false);
  });

  it('verifies a sign-up with the password typed in the form', async () => {
    const verifySignUp: Mock = vi.fn(() => Promise.resolve(camille));
    const store: AuthFlowStore = setup({
      signUp: () => Promise.resolve(),
      verifySignUp,
      resendSignUpCode: vi.fn(() => Promise.resolve()),
    });

    await expect(store.verifySignUp('123456')).resolves.toMatchObject({ kind: 'failed' });
    await store.signUp({ name: camille.name, email: camille.email, password: 'long-password-1' });
    expect(store.signUpEmail()).toBe(camille.email);
    await expect(store.resendSignUpCode()).resolves.toEqual({ ok: true, value: undefined });
    await expect(store.verifySignUp('123456')).resolves.toMatchObject({ kind: 'signed-in' });
    expect(verifySignUp).toHaveBeenCalledWith(camille.email, '123456', 'long-password-1');
    expect(store.signUpEmail()).toBeNull();
  });

  it('forgets the flow once the session is closed', async () => {
    const store: AuthFlowStore = setup({
      signOut: () => Promise.resolve(),
      requestPasswordReset: () => Promise.resolve(),
    });
    store.setAccount(camille);
    store.prefill(camille.email);
    expect(store.prefilled()).toBe(true);
    await store.requestPasswordReset(camille.email);
    expect(store.prefilled()).toBe(false);

    await expect(store.signOut()).resolves.toEqual({ ok: true, value: undefined });
    expect(store.account()).toBeNull();
  });
});
