import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthResult, SignInOutcome } from '../../../models/auth/auth.type';
import { AuthEntryService } from './auth-entry.service';

describe('AuthEntryService', () => {
  beforeEach(() => {
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
    TestBed.inject(HttpTestingController).verify();
    vi.unstubAllGlobals();
  });

  it('keeps a password acceptance with a second-step challenge distinct from a session', async () => {
    const result: Promise<AuthResult<SignInOutcome>> = firstValueFrom(
      TestBed.inject(AuthEntryService).signIn({
        email: 'qa@example.test',
        password: 'fixture-password',
        rememberMe: true,
      }),
    );
    const request: TestRequest =
      TestBed.inject(HttpTestingController).expectOne('/v1/auth/sign-in');
    expect(request.request.method).toBe('POST');
    request.flush(
      {
        token: 'fixture-challenge-token',
        email: 'qa@example.test',
        methods: ['authenticator-app'],
      },
      { status: 202, statusText: 'Accepted' },
    );
    await expect(result).resolves.toEqual({
      ok: true,
      value: {
        kind: 'challenge',
        challenge: { token: 'fixture-challenge-token', email: 'qa@example.test' },
      },
    });
  });

  it('returns a verified session outcome for the password response', async () => {
    const result: Promise<AuthResult<SignInOutcome>> = firstValueFrom(
      TestBed.inject(AuthEntryService).signIn({
        email: 'qa@example.test',
        password: 'fixture-password',
        rememberMe: false,
      }),
    );
    const request: TestRequest =
      TestBed.inject(HttpTestingController).expectOne('/v1/auth/sign-in');
    request.flush({ user: {}, session: {} });
    await expect(result).resolves.toEqual({ ok: true, value: { kind: 'signed-in' } });
  });

  it('exposes only the allowed login error data', async () => {
    const result: Promise<AuthResult<SignInOutcome>> = firstValueFrom(
      TestBed.inject(AuthEntryService).signIn({
        email: 'qa@example.test',
        password: 'fixture-password',
        rememberMe: false,
      }),
    );
    const request: TestRequest =
      TestBed.inject(HttpTestingController).expectOne('/v1/auth/sign-in');
    request.flush(
      {
        code: 'auth.invalid-credentials',
        details: { remainingAttempts: 3, email: 'qa@example.test' },
        title: 'A private detail',
      },
      { status: 422, statusText: 'Unprocessable Content' },
    );
    await expect(result).resolves.toEqual({
      ok: false,
      problem: { status: 422, code: 'auth.invalid-credentials', remainingAttempts: 3 },
    });
  });
});
