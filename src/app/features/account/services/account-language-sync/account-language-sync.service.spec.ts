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
 * Function rejection
 *
 * @description
 * A promise rejected with a gateway error, as the generated client rejects.
 *
 * @param {HttpErrorResponse} error - The gateway error.
 * @returns {Promise<never>} The rejected promise.
 */
function rejection(error: HttpErrorResponse): Promise<never> {
  return vi.fn<() => Promise<never>>().mockRejectedValue(error)();
}

/**
 * Class FakeAccount
 *
 * @description
 * The account as identity-service keeps it: a language and a version, changed only by a write
 * whose `If-Match` names the current version.
 */
class FakeAccount {
  // #region Properties
  /**
   * Property state
   *
   * @description
   * The recorded language and version.
   *
   * @type {AccountLanguageSettings}
   */
  public state: AccountLanguageSettings = { language: 'fr', version: 3 };
  // #endregion

  // #region Methods
  /**
   * Method apply
   *
   * @description
   * Records a write against its version, or refuses a stale one with `412`.
   *
   * @param {AccountLanguage} language - The written language.
   * @param {number} version - Its `If-Match` version.
   * @returns {AccountLanguageSettings | HttpErrorResponse} The recorded language and new
   * version, or `412` when the version is not the current one.
   */
  public apply(
    language: AccountLanguage,
    version: number,
  ): AccountLanguageSettings | HttpErrorResponse {
    if (version !== this.state.version) return versionMismatch;
    this.state = { language, version: version + 1 };
    return this.state;
  }

  /**
   * Method answer
   *
   * @description
   * Records a write as the gateway answers it.
   *
   * @param {AccountLanguage} language - The written language.
   * @param {number} version - Its `If-Match` version.
   * @returns {Promise<AccountLanguageSettings>} The recorded language, or a `412` rejection.
   */
  public answer(language: AccountLanguage, version: number): Promise<AccountLanguageSettings> {
    const result: AccountLanguageSettings | HttpErrorResponse = this.apply(language, version);
    return result instanceof HttpErrorResponse ? rejection(result) : Promise.resolve(result);
  }
  // #endregion
}

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
  let account: FakeAccount;
  let read: Mock<LanguageApi['read']>;
  let write: Mock<LanguageApi['write']>;
  let toasts: { success: Mock; error: Mock; dismiss: Mock };
  let locale: { current: AppLocale; use: Mock };
  let sync: AccountLanguageSync;

  /**
   * Function setUp
   *
   * @description
   * Creates the sync with the given delays and loads Camille's account.
   *
   * @param {readonly number[]} delays - Waits before the fencing attempts.
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
   * Function writes
   *
   * @description
   * The writes sent so far, as language and `If-Match` version.
   *
   * @returns {[AccountLanguage, number][]} The writes.
   */
  function writes(): [AccountLanguage, number][] {
    return write.mock.calls.map(
      ([language, version]: [AccountLanguage, number, string]): [AccountLanguage, number] => [
        language,
        version,
      ],
    );
  }

  beforeEach(() => {
    account = new FakeAccount();
    read = vi.fn<LanguageApi['read']>(() => Promise.resolve(account.state));
    write = vi.fn<LanguageApi['write']>((language: AccountLanguage, version: number) =>
      account.answer(language, version),
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

  it('fences a late first write that lands after a read already showing the pick', async () => {
    await setUp();
    let landFirst: () => unknown = (): unknown => undefined;
    write.mockImplementationOnce((language: AccountLanguage, version: number) => {
      landFirst = (): unknown => account.apply(language, version);
      return rejection(noAnswer);
    });
    read.mockImplementationOnce(() => {
      account.state = { language: 'en', version: 4 };
      return Promise.resolve(account.state);
    });

    sync.choose('en');

    await expect.poll(() => locale.use.mock.calls).toEqual([['en']]);
    expect(writes()).toEqual([
      ['en', 3],
      ['en', 4],
    ]);
    expect(landFirst()).toBe(versionMismatch);
    expect(account.state).toEqual({ language: 'en', version: 5 });
    expect(sync.confirmed()).toEqual({ language: 'en', version: 5 });
  });

  it('fences instead of reporting a failure when a read shows the old value with the first write pending', async () => {
    await setUp();
    read.mockRejectedValueOnce(noAnswer);
    let landFirst: () => unknown = (): unknown => undefined;
    write.mockImplementationOnce((language: AccountLanguage, version: number) => {
      landFirst = (): unknown => account.apply(language, version);
      return rejection(noAnswer);
    });

    sync.choose('en');

    await expect.poll(() => locale.use.mock.calls).toEqual([['en']]);
    expect(read).toHaveBeenLastCalledWith('u1');
    expect(writes()).toEqual([
      ['en', 3],
      ['en', 3],
    ]);
    expect(landFirst()).toBe(versionMismatch);
    expect(toasts.error).not.toHaveBeenCalled();
    expect(sync.confirmed()).toEqual({ language: 'en', version: 4 });
  });

  it('reads and fences again when the first write lands between the read and the fencing write', async () => {
    await setUp();
    write
      .mockImplementationOnce(() => rejection(noAnswer))
      .mockImplementationOnce((language: AccountLanguage, version: number) => {
        account.apply('en', 3);
        return account.answer(language, version);
      });

    sync.choose('en');

    await expect.poll(() => locale.use.mock.calls).toEqual([['en']]);
    expect(writes()).toEqual([
      ['en', 3],
      ['en', 3],
      ['en', 4],
    ]);
    expect(sync.confirmed()).toEqual({ language: 'en', version: 5 });
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('waits 2, 4 and 8 s before fencing attempts that follow no answer', async () => {
    vi.useFakeTimers();
    await setUp([2000, 4000, 8000]);
    write.mockRejectedValueOnce(noAnswer);
    read
      .mockRejectedValueOnce(noAnswer)
      .mockRejectedValueOnce(noAnswer)
      .mockImplementationOnce(() => Promise.resolve(account.state));

    sync.choose('en');
    await vi.advanceTimersByTimeAsync(1999);
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(4000);
    expect(read).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(7999);
    expect(read).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(read).toHaveBeenCalledTimes(4);

    expect(writes()).toEqual([
      ['en', 3],
      ['en', 3],
    ]);
    expect(locale.use).toHaveBeenCalledWith('en');
  });

  it('stays unconfirmed without a failure when no fencing write answers, and fences on Retry', async () => {
    await setUp();
    write.mockRejectedValueOnce(noAnswer);
    read.mockRejectedValue(noAnswer);

    sync.choose('en');

    await expect.poll(() => sync.unconfirmed()).toBe(true);
    expect(sync.requested()).toBe('en');
    expect(sync.confirmed()).toEqual({ language: 'fr', version: 3 });
    expect(toasts.error).not.toHaveBeenCalled();
    expect(locale.use).not.toHaveBeenCalled();

    read.mockImplementation(() => Promise.resolve(account.state));
    sync.retry();

    await expect.poll(() => locale.use.mock.calls).toEqual([['en']]);
    expect(writes()).toEqual([
      ['en', 3],
      ['en', 3],
    ]);
    expect(sync.unconfirmed()).toBe(false);
    expect(sync.requested()).toBeNull();
  });

  it('fences a first write refused with 412 against the version read', async () => {
    await setUp();
    account.state = { language: 'fr', version: 5 };

    sync.choose('en');

    await expect.poll(() => locale.use.mock.calls).toEqual([['en']]);
    expect(writes()).toEqual([
      ['en', 3],
      ['en', 5],
    ]);
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('sends a newer pick equal to the cached language while the state is uncertain', async () => {
    await setUp();
    write.mockRejectedValueOnce(noAnswer);
    read.mockRejectedValue(noAnswer);

    sync.choose('en');
    await expect.poll(() => sync.unconfirmed()).toBe(true);

    read.mockImplementation(() => Promise.resolve(account.state));
    sync.choose('fr');

    await expect.poll(() => sync.requested()).toBeNull();
    expect(writes()).toEqual([
      ['en', 3],
      ['fr', 3],
    ]);
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
    account.state = { language: 'en', version: 3 };
    await setUp();
    const first: Deferred<AccountLanguageSettings> = deferred<AccountLanguageSettings>();
    write.mockReturnValueOnce(first.promise).mockRejectedValueOnce(refused);

    sync.choose('fr');
    sync.choose('de');
    first.resolve({ language: 'fr', version: 4 });

    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);
    expect(writes().map(([language]: [AccountLanguage, number]) => language)).toEqual(['fr', 'de']);
    expect(sync.requested()).toBeNull();
    expect(sync.confirmed()).toEqual({ language: 'fr', version: 4 });
    expect(locale.use).toHaveBeenCalledWith('fr');
  });

  it('saves a pick made on a new account while the old account still has a run pending', async () => {
    await setUp();
    const stale: Deferred<AccountLanguageSettings> = deferred<AccountLanguageSettings>();
    write.mockReturnValueOnce(stale.promise);
    sync.choose('en');
    await expect.poll(() => write.mock.calls.length).toBe(1);

    read.mockResolvedValueOnce({ language: 'de', version: 1 });
    await sync.load('u2');
    write.mockResolvedValueOnce({ language: 'es', version: 2 });
    sync.choose('es');

    await expect.poll(() => sync.confirmed()).toEqual({ language: 'es', version: 2 });
    expect(write).toHaveBeenLastCalledWith('es', 1, 'u2');
    stale.resolve({ language: 'en', version: 4 });
    await Promise.resolve();
    expect(sync.confirmed()).toEqual({ language: 'es', version: 2 });
    expect(
      write.mock.calls.filter(([, , userId]: [AccountLanguage, number, string]) => userId === 'u2'),
    ).toHaveLength(1);
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
