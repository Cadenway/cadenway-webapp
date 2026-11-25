import { DOCUMENT } from '@angular/common';
import { inject, Service, signal, type Signal, type WritableSignal } from '@angular/core';

import type { RememberedAccount } from '../../models/remembered-account/remembered-account.interface';

/**
 * Constant STORAGE_KEY
 *
 * @description
 * `localStorage` key of the accounts remembered on this device.
 *
 * @type {string}
 */
const STORAGE_KEY: string = 'cadenway-remembered-accounts';

/**
 * Constant MAX_ACCOUNTS
 *
 * @description
 * Accounts kept at most; the oldest is dropped first.
 *
 * @type {number}
 */
const MAX_ACCOUNTS: number = 5;

/**
 * Function sameEmail
 *
 * @description
 * Compares two addresses without regard to case, as the gateway does.
 *
 * @param {string} left - First address.
 * @param {string} right - Second address.
 * @returns {boolean} Whether they are the same address.
 */
function sameEmail(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

/**
 * Function parseAccounts
 *
 * @description
 * Reads the stored list defensively: anything malformed is ignored.
 *
 * @param {string | null} raw - The stored JSON.
 * @returns {RememberedAccount[]} The valid accounts, most recent first.
 */
function parseAccounts(raw: string | null): RememberedAccount[] {
  try {
    const value: unknown = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item: unknown): item is RememberedAccount =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as Record<string, unknown>)['name'] === 'string' &&
          typeof (item as Record<string, unknown>)['email'] === 'string',
      )
      .map((item: RememberedAccount): RememberedAccount => ({ name: item.name, email: item.email }))
      .slice(0, MAX_ACCOUNTS);
  } catch {
    return [];
  }
}

/**
 * Service RememberedAccountsService
 *
 * @description
 * The accounts this device signed in with (`auth.logged-out.remembered`), most recent
 * first, kept in `localStorage` with their name and address only. A sign-in remembers its account;
 * the signed-out screen offers them again and forgets one on request, with an undo. Storage that
 * cannot be read or written leaves an in-memory list.
 */
@Service()
export class RememberedAccountsService {
  // #region Properties
  /**
   * Property storage
   *
   * @description
   * The device storage, or null when the browser refuses it.
   *
   * @type {Storage | null}
   * @readonly
   */
  private readonly storage: Storage | null = ((): Storage | null => {
    try {
      return inject(DOCUMENT).defaultView?.localStorage ?? null;
    } catch {
      return null;
    }
  })();

  /**
   * Property list
   *
   * @description
   * Writable list of the remembered accounts.
   *
   * @type {WritableSignal<readonly RememberedAccount[]>}
   * @readonly
   */
  private readonly list: WritableSignal<readonly RememberedAccount[]> = signal(this.read());

  /**
   * Property accounts
   *
   * @description
   * Remembered accounts, most recent first.
   *
   * @type {Signal<readonly RememberedAccount[]>}
   * @readonly
   */
  public readonly accounts: Signal<readonly RememberedAccount[]> = this.list.asReadonly();
  // #endregion

  // #region Methods
  /**
   * Method remember
   *
   * @description
   * Puts an account first, replacing an earlier entry of the same address.
   *
   * @param {RememberedAccount} account - The account a session was opened for.
   */
  public remember(account: RememberedAccount): void {
    this.write([
      { name: account.name, email: account.email },
      ...this.list().filter((item: RememberedAccount) => !sameEmail(item.email, account.email)),
    ]);
  }

  /**
   * Method forget
   *
   * @description
   * Forgets an account and returns what undoing it needs.
   *
   * @param {string} email - Address of the account to forget.
   * @returns {{ readonly account: RememberedAccount; readonly index: number } | null} The
   * forgotten account and its position, or null when it was not remembered.
   */
  public forget(
    email: string,
  ): { readonly account: RememberedAccount; readonly index: number } | null {
    const index: number = this.list().findIndex((item: RememberedAccount) =>
      sameEmail(item.email, email),
    );
    if (index < 0) return null;
    const account: RememberedAccount = this.list()[index];
    this.write(this.list().filter((_: RememberedAccount, position: number) => position !== index));
    return { account, index };
  }

  /**
   * Method restore
   *
   * @description
   * Undoes a `forget`, putting the account back at its position.
   *
   * @param {{ readonly account: RememberedAccount; readonly index: number }} forgotten - What
   * `forget` returned.
   */
  public restore(forgotten: { readonly account: RememberedAccount; readonly index: number }): void {
    const others: RememberedAccount[] = this.list().filter(
      (item: RememberedAccount) => !sameEmail(item.email, forgotten.account.email),
    );
    others.splice(Math.min(forgotten.index, others.length), 0, forgotten.account);
    this.write(others);
  }

  /**
   * Method read
   *
   * @description
   * Reads the stored list.
   *
   * @returns {RememberedAccount[]} The stored accounts.
   */
  private read(): RememberedAccount[] {
    try {
      return parseAccounts(this.storage?.getItem(STORAGE_KEY) ?? null);
    } catch {
      return [];
    }
  }

  /**
   * Method write
   *
   * @description
   * Keeps the newest accounts in memory and in storage.
   *
   * @param {readonly RememberedAccount[]} accounts - The new list, most recent first.
   */
  private write(accounts: readonly RememberedAccount[]): void {
    const kept: readonly RememberedAccount[] = accounts.slice(0, MAX_ACCOUNTS);
    this.list.set(kept);
    try {
      if (kept.length === 0) this.storage?.removeItem(STORAGE_KEY);
      else this.storage?.setItem(STORAGE_KEY, JSON.stringify(kept));
    } catch {
      /* Storage may be full or refused: the in-memory list stays. */
    }
  }
  // #endregion
}
