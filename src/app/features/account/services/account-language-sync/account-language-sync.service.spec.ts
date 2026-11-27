import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { type AppLocale, LocaleService } from '@core/locale';

import type {
  AccountLanguage,
  AccountLanguageSettings,
} from '../../data-access/services/language-api/account-language.interface';
import { LanguageApi } from '../../data-access/services/language-api/language-api.service';
import { AccountChangedError } from '../../data-access/services/notification-preferences-api/account-changed.error';
import { AccountLanguageSync } from './account-language-sync.service';
import { CONFIRMATION_DELAYS } from './confirmation-delays.token';

/**
 * Constant noAnswer
 *
 * @description
 * A request that got no answer (status 0): its outcome is unknown.
 *
 * @type {HttpErrorResponse}
 */
const noAnswer: HttpErrorResponse = new HttpErrorResponse({ status: 0 });

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

/**
 * Constant refused
 *
 * @description
 * A definite refusal of a write.
 *
 * @type {HttpErrorResponse}
 */
const refused: HttpErrorResponse = new HttpErrorResponse({ status: 403 });

/**
 * Interface Deferred
 *
 * @description
 * A promise settled by the spec.
 */
interface Deferred<T> {
  // #region Properties
  /**
   * Property promise
   *
   * @description
   * The pending promise.
   *
   * @type {Promise<T>}
   * @readonly
   */
  readonly promise: Promise<T>;

  /**
   * Property resolve
   *
   * @description
   * Fulfils it.
   *
   * @type {(value: T) => void}
   * @readonly
   */
  readonly resolve: (value: T) => void;
  // #endregion
}

/**
 * Function deferred
 *
 * @description
 * Creates a promise the spec settles.
 *
 * @returns {Deferred<T>} The promise and its resolver.
 */
function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = (): void => undefined;
  const promise: Promise<T> = new Promise<T>((done: (value: T) => void): void => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('AccountLanguageSync', () => {
  let read: Mock<LanguageApi['read']>;
  let write: Mock<LanguageApi['write']>;
  let toasts: { success: Mock; error: Mock; dismiss: Mock };
  let locale: { current: AppLocale; use: Mock };
  let sync: AccountLanguageSync;

  /**
   * Function setUp
   *
   * @description
   * Creates the sync with the given confirmation delays and loads Camille's account in French.
   *
   * @param {readonly number[]} delays - Waits before each confirming read.
   * @returns {Promise<void>} Resolves once loaded.
   */
  async function setUp(delays: readonly number[] = [0, 0, 0]): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        { provide: LanguageApi, useValue: { read, write } },
        { provide: LocaleService, useValue: locale },
        { provide: CwToastService, useValue: toasts },
        { provide: CONFIRMATION_DELAYS, useValue: delays },
      ],
    });
    sync = TestBed.inject(AccountLanguageSync);
    await sync.load('u1');
  }

  /**
   * Function sent
   *
   * @description
   * The languages written so far, in order.
   *
   * @returns {AccountLanguage[]} The languages.
   */
  function sent(): AccountLanguage[] {
    return write.mock.calls.map(([language]: [AccountLanguage, number, string]) => language);
  }

  beforeEach(() => {
    read = vi.fn<LanguageApi['read']>(() => Promise.resolve({ language: 'fr', version: 3 }));
    write = vi.fn<LanguageApi['write']>((language: AccountLanguage, version: number) =>
      Promise.resolve({ language, version: version + 1 }),
    );
    toasts = { success: vi.fn(() => 't-ok'), error: vi.fn(() => 't-ko'), dismiss: vi.fn() };
    locale = { current: 'fr', use: vi.fn() };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('applies the locale of a confirmed save without any page', async () => {
    await setUp();
    const pending: Deferred<AccountLanguageSettings> = deferred<AccountLanguageSettings>();
    write.mockReturnValueOnce(pending.promise);

    sync.choose('en');
    expect(sync.requested()).toBe('en');
    pending.resolve({ language: 'en', version: 4 });

    await expect.poll(() => locale.use.mock.calls).toEqual([['en']]);
    expect(sync.requested()).toBeNull();
    expect(sync.confirmed()).toEqual({ language: 'en', version: 4 });
  });

  it('confirms an unknown write with reads after 2, 4 and 8 s', async () => {
    vi.useFakeTimers();
    await setUp([2000, 4000, 8000]);
    write.mockRejectedValueOnce(noAnswer);
    read
      .mockRejectedValueOnce(noAnswer)
      .mockRejectedValueOnce(noAnswer)
      .mockRejectedValueOnce(noAnswer)
      .mockResolvedValueOnce({ language: 'en', version: 4 });

    sync.choose('en');
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(read).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(4000);
    expect(read).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(8000);
    expect(read).toHaveBeenCalledTimes(5);

    expect(locale.use).toHaveBeenCalledWith('en');
    expect(toasts.error).not.toHaveBeenCalled();
    expect(sync.unconfirmed()).toBe(false);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('keeps an unanswered outcome unconfirmed, never claims the previous language, and retries', async () => {
    await setUp();
    write.mockRejectedValueOnce(noAnswer);
    read.mockRejectedValue(noAnswer);

    sync.choose('en');

    await expect.poll(() => sync.unconfirmed()).toBe(true);
    expect(sync.requested()).toBe('en');
    expect(toasts.error).not.toHaveBeenCalled();
    expect(locale.use).not.toHaveBeenCalled();

    read.mockResolvedValue({ language: 'en', version: 4 });
    sync.retry();

    await expect.poll(() => locale.use.mock.calls).toEqual([['en']]);
    expect(sync.unconfirmed()).toBe(false);
    expect(sync.requested()).toBeNull();
  });

  it('stays uncertain when the resend after a version mismatch gets no answer', async () => {
    await setUp();
    write.mockRejectedValueOnce(versionMismatch).mockRejectedValueOnce(noAnswer);
    read
      .mockResolvedValueOnce({ language: 'fr', version: 5 })
      .mockResolvedValueOnce({ language: 'en', version: 6 });

    sync.choose('en');

    await expect.poll(() => locale.use.mock.calls).toEqual([['en']]);
    expect(
      write.mock.calls.map(([, version]: [AccountLanguage, number, string]) => version),
    ).toEqual([3, 5]);
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('says a save failed only once a read shows the account without the pick', async () => {
    await setUp();
    write.mockRejectedValueOnce(noAnswer);
    read.mockRejectedValueOnce(noAnswer).mockResolvedValueOnce({ language: 'fr', version: 3 });

    sync.choose('en');

    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);
    expect(sync.requested()).toBeNull();
    expect(sync.confirmed()).toEqual({ language: 'fr', version: 3 });
    expect(locale.use).not.toHaveBeenCalled();
  });

  it('sends a newer pick equal to the cached language while the state is uncertain', async () => {
    await setUp();
    write.mockRejectedValueOnce(noAnswer);
    read.mockRejectedValue(noAnswer);

    sync.choose('en');
    await expect.poll(() => sync.unconfirmed()).toBe(true);

    sync.choose('fr');

    await expect.poll(() => sent()).toEqual(['en', 'fr']);
    await expect.poll(() => sync.requested()).toBeNull();
    expect(sync.confirmed()).toEqual({ language: 'fr', version: 4 });
  });

  it('sends nothing for a pick equal to the confirmed language', async () => {
    await setUp();

    sync.choose('fr');

    await expect.poll(() => sync.requested()).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });

  it('applies the saved earlier pick when a later pick is refused', async () => {
    locale.current = 'en';
    read.mockResolvedValueOnce({ language: 'en', version: 3 });
    await setUp();
    const first: Deferred<AccountLanguageSettings> = deferred<AccountLanguageSettings>();
    write.mockReturnValueOnce(first.promise).mockRejectedValueOnce(refused);

    sync.choose('fr');
    sync.choose('de');
    first.resolve({ language: 'fr', version: 4 });

    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);
    expect(sent()).toEqual(['fr', 'de']);
    expect(sync.requested()).toBeNull();
    expect(sync.confirmed()).toEqual({ language: 'fr', version: 4 });
    expect(locale.use).toHaveBeenCalledWith('fr');
  });

  it('stops silently and forgets the account when another one holds the session', async () => {
    await setUp();
    write.mockRejectedValueOnce(new AccountChangedError());

    sync.choose('en');

    await expect.poll(() => sync.confirmed()).toBeNull();
    expect(sync.requested()).toBeNull();
    expect(toasts.error).not.toHaveBeenCalled();
    expect(locale.use).not.toHaveBeenCalled();
  });
});
