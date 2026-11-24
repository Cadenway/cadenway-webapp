import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { SignInOutcome } from '../../../models/session/session.interface';
import { SecurityKeyService } from '../../../services/security-key/security-key.service';
import { AuthApi } from './auth-api.service';

/**
 * Constant user
 *
 * @description
 * Camille Martin's account as the gateway describes it.
 *
 * @type {Record<string, unknown>}
 */
const user: Record<string, unknown> = {
  id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
  name: 'Camille Martin',
  email: 'camille.martin@ateliernord.fr',
  language: 'fr',
  displayName: null,
  jobTitle: null,
  timeZone: 'Europe/Paris',
  version: 2,
};

/**
 * Constant signedIn
 *
 * @description
 * A `200` sign-in body.
 *
 * @type {Record<string, unknown>}
 */
const signedIn: Record<string, unknown> = {
  user,
  session: { id: 'session-1', expiresAt: '2099-12-08T13:07:00Z' },
};

/**
 * Constant challenge
 *
 * @description
 * A `202` two-step challenge body.
 *
 * @type {Record<string, unknown>}
 */
const challenge: Record<string, unknown> = {
  token: 'fixture-challenge-token',
  expiresAt: '2099-12-08T13:07:00Z',
  email: 'camille.martin@ateliernord.fr',
  name: 'Camille Martin',
  primaryMethod: 'authenticator-app',
  methods: ['authenticator-app'],
  securityKeys: [],
  backupCodesRemaining: 7,
  lockedUntil: null,
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
 * Lets the session lock run its operation before the request is expected.
 *
 * @returns {Promise<void>} Resolves after pending microtasks.
 */
async function settle(): Promise<void> {
  await new Promise<void>((resolve: () => void) => {
    setTimeout(resolve);
  });
}

describe('AuthApi', () => {
  const assert: Mock = vi.fn();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SecurityKeyService, useValue: { assert } },
      ],
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
    assert.mockReset();
  });

  it('reads a 202 password answer as a challenge and a 200 as a session', async () => {
    const api: AuthApi = TestBed.inject(AuthApi);

    const first: Promise<SignInOutcome> = api.signInWithPassword(
      'camille.martin@ateliernord.fr',
      'secret',
      true,
    );
    await settle();
    const request: TestRequest = http().expectOne('/v1/auth/sign-in');
    expect(request.request.body).toEqual({
      email: 'camille.martin@ateliernord.fr',
      password: 'secret',
      rememberMe: true,
    });
    request.flush(challenge, { status: 202, statusText: 'Accepted' });
    await expect(first).resolves.toMatchObject({
      kind: 'challenge',
      token: 'fixture-challenge-token',
    });

    const second: Promise<SignInOutcome> = api.signInWithPassword(
      'camille.martin@ateliernord.fr',
      'secret',
      false,
    );
    await settle();
    http().expectOne('/v1/auth/sign-in').flush(signedIn);
    await expect(second).resolves.toEqual({
      kind: 'signed-in',
      account: { name: 'Camille Martin', email: 'camille.martin@ateliernord.fr' },
    });
  });

  it('redeems the federated continuation with an empty body', async () => {
    const result: Promise<SignInOutcome> = TestBed.inject(AuthApi).finishFederatedSignIn();
    await settle();
    const request: TestRequest = http().expectOne('/v1/auth/sign-in/federated/finish');
    expect(request.request.body).toEqual({});
    request.flush(signedIn);
    await expect(result).resolves.toMatchObject({ kind: 'signed-in' });
  });

  it('refuses a provider destination that is not HTTPS', async () => {
    const api: AuthApi = TestBed.inject(AuthApi);

    const unsafe: Promise<string> = api.startFederatedSignIn('github', true);
    const request: TestRequest = http().expectOne('/v1/auth/sign-in/federated/start');
    expect(request.request.body).toEqual({ provider: 'github', rememberMe: true });
    request.flush({ authorizationUrl: 'http://github.example/authorize' });
    await expect(unsafe).rejects.toThrow();

    const saml: Promise<string> = api.startFederatedSignIn(
      { email: 'camille@ateliernord.fr' },
      false,
    );
    const samlRequest: TestRequest = http().expectOne('/v1/auth/sign-in/federated/start');
    expect(samlRequest.request.body).toEqual({
      provider: 'saml',
      email: 'camille@ateliernord.fr',
      rememberMe: false,
    });
    samlRequest.flush({ authorizationUrl: 'https://idp.ateliernord.fr/sso?state=x' });
    await expect(saml).resolves.toBe('https://idp.ateliernord.fr/sso?state=x');
  });

  it('answers a challenge only with a 200 session', async () => {
    const result: Promise<unknown> = TestBed.inject(AuthApi).answerWithAuthenticatorApp(
      'fixture-challenge-token',
      '123456',
      true,
    );
    await settle();
    const request: TestRequest = http().expectOne('/v1/auth/sign-in/challenge/authenticator-app');
    expect(request.request.body).toEqual({
      token: 'fixture-challenge-token',
      code: '123456',
      trustDevice: true,
    });
    request.flush(signedIn);
    await expect(result).resolves.toEqual({
      name: 'Camille Martin',
      email: 'camille.martin@ateliernord.fr',
    });
  });

  it('runs the security key ceremony between the options and the answer', async () => {
    assert.mockResolvedValue({ id: 'key', rawId: 'key', type: 'public-key', response: {} });
    const result: Promise<unknown> = TestBed.inject(AuthApi).answerWithSecurityKey('token', false);
    http()
      .expectOne('/v1/auth/sign-in/challenge/security-key/options')
      .flush({ options: { challenge: 'abc' }, expiresAt: '2099-12-08T13:07:00Z' });
    await settle();
    expect(assert).toHaveBeenCalledWith({ challenge: 'abc' });
    const answer: TestRequest = http().expectOne('/v1/auth/sign-in/challenge/security-key');
    expect(answer.request.body).toMatchObject({ token: 'token', trustDevice: false });
    answer.flush(signedIn);
    await expect(result).resolves.toMatchObject({ name: 'Camille Martin' });
  });

  it('maps the sign-up, codes, reset and sign-out operations', async () => {
    const api: AuthApi = TestBed.inject(AuthApi);

    const signUp: Promise<void> = api.signUp({ name: 'Camille', email: 'c@a.fr', password: 'p' });
    const signUpRequest: TestRequest = http().expectOne('/v1/auth/sign-up');
    expect(signUpRequest.request.body).toEqual({
      name: 'Camille',
      email: 'c@a.fr',
      password: 'p',
      acceptTerms: true,
    });
    signUpRequest.flush({ email: 'c@a.fr', expiresAt: '', resendAvailableAt: '' });
    await expect(signUp).resolves.toBeUndefined();

    const verify: Promise<unknown> = api.verifySignUp('c@a.fr', '123456', 'p');
    await settle();
    http().expectOne('/v1/auth/sign-up/verification').flush(signedIn);
    await expect(verify).resolves.toMatchObject({ email: 'camille.martin@ateliernord.fr' });

    const link: Promise<unknown> = api.inspectPasswordReset('reset-token');
    const inspect: TestRequest = http().expectOne('/v1/auth/password-reset/inspection');
    expect(inspect.request.body).toEqual({ token: 'reset-token' });
    inspect.flush({ email: 'c@a.fr', expiresAt: '2099-01-01T00:00:00Z', sessionCount: 3 });
    await expect(link).resolves.toEqual({ email: 'c@a.fr', sessionCount: 3 });

    const methods: Promise<readonly string[]> = api.discoverSignInMethods('c@a.fr');
    http()
      .expectOne('/v1/auth/sign-in-methods')
      .flush({ methods: [{ type: 'password' }, { type: 'saml' }] });
    await expect(methods).resolves.toEqual(['password', 'saml']);

    const signOut: Promise<void> = api.signOut();
    await settle();
    const out: TestRequest = http().expectOne('/v1/auth/sign-out');
    expect(out.request.body).toEqual({});
    out.flush(null, { status: 204, statusText: 'No Content' });
    await expect(signOut).resolves.toBeUndefined();
  });
});
