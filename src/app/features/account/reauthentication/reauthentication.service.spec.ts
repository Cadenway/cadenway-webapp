import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { ReauthenticationApi } from '../data-access/services/reauthentication-api/reauthentication-api.service';
import type { ReauthenticationAnswer } from '../models/reauthentication/reauthentication.interface';
import { ReauthenticationCancelledError } from './reauthentication-cancelled.error';
import { ReauthenticationService } from './reauthentication.service';

/**
 * Function refusal
 *
 * @description
 * A gateway refusal with a problem body.
 *
 * @param {number} status - HTTP status.
 * @param {string} code - Problem code.
 * @param {Record<string, unknown>} [details] - Problem details.
 * @returns {HttpErrorResponse} The refusal.
 */
function refusal(
  status: number,
  code: string,
  details: Record<string, unknown> = {},
): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { code, details } });
}

/**
 * Function required
 *
 * @description
 * `403 auth.reauthentication-required` with the given methods.
 *
 * @param {readonly string[]} methods - `details.methods`.
 * @returns {HttpErrorResponse} The refusal.
 */
function required(methods: readonly string[]): HttpErrorResponse {
  return refusal(403, 'auth.reauthentication-required', { methods });
}

/**
 * Function rejecting
 *
 * @description
 * An operation that always rejects with the given refusal.
 *
 * @param {unknown} error - The refusal.
 * @returns {() => Promise<never>} The operation.
 */
function rejecting(error: unknown): () => Promise<never> {
  return vi.fn<() => Promise<never>>().mockRejectedValue(error);
}

describe('ReauthenticationService', () => {
  let reauthenticate: Mock<(answer: ReauthenticationAnswer) => Promise<void>>;
  let service: ReauthenticationService;

  beforeEach(() => {
    reauthenticate = vi.fn(() => Promise.resolve());
    TestBed.configureTestingModule({
      providers: [
        ReauthenticationService,
        { provide: ReauthenticationApi, useValue: { reauthenticate } },
      ],
    });
    service = TestBed.inject(ReauthenticationService);
  });

  it('returns the result of an operation that needs no reauthentication', async () => {
    await expect(service.run(() => Promise.resolve('created'))).resolves.toBe('created');

    expect(service.prompt()).toBeNull();
  });

  it('passes any other refusal through untouched', async () => {
    const forbidden: HttpErrorResponse = refusal(403, 'organization.access-denied');

    await expect(service.run(rejecting(forbidden))).rejects.toBe(forbidden);

    expect(service.prompt()).toBeNull();
  });

  it('asks for the password, confirms it, then repeats the operation once', async () => {
    const operation: Mock<() => Promise<string>> = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(required(['password']))
      .mockResolvedValueOnce('created');

    const result: Promise<string> = service.run(operation);
    await vi.waitFor(() => {
      expect(service.prompt()?.method).toBe('password');
    });
    await service.answer({ password: 'correct horse battery' });

    await expect(result).resolves.toBe('created');
    expect(reauthenticate).toHaveBeenCalledExactlyOnceWith({ password: 'correct horse battery' });
    expect(operation).toHaveBeenCalledTimes(2);
    expect(service.prompt()).toBeNull();
  });

  it('asks for the authenticator code when the account has two-step verification', async () => {
    void service.run(rejecting(required(['authenticator-app', 'password'])));

    await vi.waitFor(() => {
      expect(service.prompt()?.method).toBe('code');
    });
  });

  it('finds the refusal inside a wrapped error', async () => {
    void service.run(rejecting(new Error('Resource failed', { cause: required(['password']) })));

    await vi.waitFor(() => {
      expect(service.prompt()?.method).toBe('password');
    });
  });

  it('keeps the dialog open with the reason of a refused answer', async () => {
    reauthenticate
      .mockRejectedValueOnce(refusal(422, 'auth.password-incorrect', { remainingAttempts: 3 }))
      .mockRejectedValueOnce(refusal(429, 'auth.account-locked'));
    void service.run(rejecting(required(['password'])));
    await vi.waitFor(() => {
      expect(service.prompt()).not.toBeNull();
    });

    await service.answer({ password: 'wrong' });
    expect(service.prompt()).toEqual({
      method: 'password',
      pending: false,
      failure: 'password-incorrect',
      remainingAttempts: 3,
    });
    await service.answer({ password: 'wrong again' });
    expect(service.prompt()?.failure).toBe('locked');
  });

  it('switches to the code when the password is refused for a two-step account', async () => {
    reauthenticate.mockRejectedValueOnce(required(['authenticator-app']));
    void service.run(rejecting(required(['password'])));
    await vi.waitFor(() => {
      expect(service.prompt()).not.toBeNull();
    });

    await service.answer({ password: 'secret' });

    expect(service.prompt()).toEqual({
      method: 'code',
      pending: false,
      failure: null,
      remainingAttempts: null,
    });
  });

  it('rejects without repeating the operation when the person cancels', async () => {
    const operation: Mock<() => Promise<string>> = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(required(['password']));
    const result: Promise<string> = service.run(operation);
    await vi.waitFor(() => {
      expect(service.prompt()).not.toBeNull();
    });

    service.cancel();

    await expect(result).rejects.toBeInstanceOf(ReauthenticationCancelledError);
    expect(operation).toHaveBeenCalledOnce();
    expect(reauthenticate).not.toHaveBeenCalled();
  });

  it('lets operations refused at the same time wait for one confirmation', async () => {
    const first: Mock<() => Promise<string>> = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(required(['password']))
      .mockResolvedValueOnce('first');
    const second: Mock<() => Promise<string>> = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(required(['password']))
      .mockResolvedValueOnce('second');
    const results: Promise<string[]> = Promise.all([service.run(first), service.run(second)]);
    await vi.waitFor(() => {
      expect(service.prompt()).not.toBeNull();
    });
    await Promise.resolve();

    await service.answer({ password: 'correct horse battery' });

    await expect(results).resolves.toEqual(['first', 'second']);
    expect(reauthenticate).toHaveBeenCalledOnce();
  });
});
