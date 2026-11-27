import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
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
  let navigate: Mock<(commands: readonly unknown[], extras?: unknown) => Promise<boolean>>;
  let service: ReauthenticationService;

  beforeEach(() => {
    reauthenticate = vi.fn(() => Promise.resolve());
    navigate = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        ReauthenticationService,
        { provide: ReauthenticationApi, useValue: { reauthenticate } },
        { provide: Router, useValue: { url: '/atelier-nord/account/api-tokens', navigate } },
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

  /**
   * Function opened
   *
   * @description
   * Runs an operation refused once with the given methods and waits for the dialog.
   *
   * @param {readonly string[]} methods - `details.methods` of the refusal.
   * @returns {Promise<{ readonly result: Promise<string> }>} The operation's result, once the dialog
   * is open.
   */
  async function opened(methods: readonly string[]): Promise<{ readonly result: Promise<string> }> {
    const result: Promise<string> = service.run(
      vi
        .fn<() => Promise<string>>()
        .mockRejectedValueOnce(required(methods))
        .mockResolvedValue('ok'),
    );
    await vi.waitFor(() => {
      expect(service.prompt()).not.toBeNull();
    });
    return { result };
  }

  it('cancels every operation waiting for the same confirmation', async () => {
    const first: Promise<string> = service.run(rejecting(required(['password'])));
    const second: Promise<string> = service.run(rejecting(required(['password'])));
    await vi.waitFor(() => {
      expect(service.prompt()).not.toBeNull();
    });
    await Promise.resolve();

    service.cancel();

    await expect(first).rejects.toBeInstanceOf(ReauthenticationCancelledError);
    await expect(second).rejects.toBeInstanceOf(ReauthenticationCancelledError);
    expect(service.prompt()).toBeNull();
  });

  it('switches to the password when the code is refused for an account without an app', async () => {
    reauthenticate.mockRejectedValueOnce(refusal(409, 'auth.two-step-not-enabled'));
    void (await opened(['authenticator-app'])).result.catch(() => undefined);

    await service.answer({ code: '123456' });

    expect(service.prompt()).toEqual({
      method: 'password',
      pending: false,
      failure: null,
      remainingAttempts: null,
    });
  });

  it('shows the attempts left after a wrong code, then the two-step lockout', async () => {
    reauthenticate
      .mockRejectedValueOnce(refusal(422, 'auth.two-step-code-invalid', { remainingAttempts: 1 }))
      .mockRejectedValueOnce(refusal(429, 'auth.two-step-locked'));
    void (await opened(['authenticator-app'])).result.catch(() => undefined);

    await service.answer({ code: '000000' });
    expect(service.prompt()).toEqual({
      method: 'code',
      pending: false,
      failure: 'code-incorrect',
      remainingAttempts: 1,
    });
    await service.answer({ code: '111111' });
    expect(service.prompt()?.failure).toBe('locked');
  });

  it('ignores a cancel while the answer is being checked', async () => {
    let confirm: () => void = (): void => undefined;
    reauthenticate.mockReturnValueOnce(
      new Promise<void>((resolve: () => void): void => {
        confirm = resolve;
      }),
    );
    const result: Promise<string> = (await opened(['password'])).result;

    const answered: Promise<void> = service.answer({ password: 'correct horse battery' });
    service.cancel();
    expect(service.prompt()?.pending).toBe(true);
    confirm();
    await answered;

    await expect(result).resolves.toBe('ok');
  });

  it('passes a second refusal of the repeated operation through without asking again', async () => {
    const again: HttpErrorResponse = required(['password']);
    const operation: Mock<() => Promise<string>> = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(required(['password']))
      .mockRejectedValueOnce(again);
    const result: Promise<string> = service.run(operation);
    await vi.waitFor(() => {
      expect(service.prompt()).not.toBeNull();
    });

    await service.answer({ password: 'correct horse battery' });

    await expect(result).rejects.toBe(again);
    expect(operation).toHaveBeenCalledTimes(2);
    expect(reauthenticate).toHaveBeenCalledOnce();
    expect(service.prompt()).toBeNull();
  });

  it('sends an ended session to sign-in and cancels the waiting operation', async () => {
    reauthenticate.mockRejectedValueOnce(refusal(401, 'auth.session-expired'));
    const result: Promise<string> = (await opened(['password'])).result;

    await service.answer({ password: 'correct horse battery' });

    await expect(result).rejects.toBeInstanceOf(ReauthenticationCancelledError);
    expect(service.prompt()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { next: '/atelier-nord/account/api-tokens' },
    });
  });
});
