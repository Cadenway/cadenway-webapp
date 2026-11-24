import { DOCUMENT } from '@angular/common';
import { inject, Service } from '@angular/core';

/**
 * Constant CHALLENGE_KEY
 *
 * @description
 * `sessionStorage` key of the pending two-step challenge token.
 *
 * @type {string}
 */
const CHALLENGE_KEY: string = 'cadenway-sign-in-challenge';

/**
 * Constant RETURN_KEY
 *
 * @description
 * `sessionStorage` key of the path to open after sign-in.
 *
 * @type {string}
 */
const RETURN_KEY: string = 'cadenway-sign-in-return';

/**
 * Service AuthStorageService
 *
 * @description
 * What a sign-in must keep across a reload or a provider redirect, in this tab only
 * (`sessionStorage`, never a URL): the two-step challenge token, as the contract recommends, and
 * the path to open once signed in. Both are cleared when the session opens or the person starts
 * over. Storage the browser refuses leaves nothing behind.
 */
@Service()
export class AuthStorageService {
  // #region Properties
  /**
   * Property storage
   *
   * @description
   * The tab storage, or null when the browser refuses it.
   *
   * @type {Storage | null}
   * @readonly
   */
  private readonly storage: Storage | null = ((): Storage | null => {
    try {
      return inject(DOCUMENT).defaultView?.sessionStorage ?? null;
    } catch {
      return null;
    }
  })();
  // #endregion

  // #region Methods
  /**
   * Method challengeToken
   *
   * @description
   * Reads the pending challenge token.
   *
   * @returns {string | null} The token, or null.
   */
  public challengeToken(): string | null {
    return this.get(CHALLENGE_KEY);
  }

  /**
   * Method keepChallengeToken
   *
   * @description
   * Keeps or clears the pending challenge token.
   *
   * @param {string | null} token - The token, or null to clear it.
   */
  public keepChallengeToken(token: string | null): void {
    this.set(CHALLENGE_KEY, token);
  }

  /**
   * Method returnUrl
   *
   * @description
   * Reads the path to open after sign-in.
   *
   * @returns {string | null} The path, or null.
   */
  public returnUrl(): string | null {
    return this.get(RETURN_KEY);
  }

  /**
   * Method keepReturnUrl
   *
   * @description
   * Keeps or clears the path to open after sign-in.
   *
   * @param {string | null} path - An application path checked by the caller, or null.
   */
  public keepReturnUrl(path: string | null): void {
    this.set(RETURN_KEY, path);
  }

  /**
   * Method get
   *
   * @description
   * Reads a key, tolerating a refused storage.
   *
   * @param {string} key - Storage key.
   * @returns {string | null} The value, or null.
   */
  private get(key: string): string | null {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Method set
   *
   * @description
   * Writes or removes a key, tolerating a refused storage.
   *
   * @param {string} key - Storage key.
   * @param {string | null} value - The value, or null to remove it.
   */
  private set(key: string, value: string | null): void {
    try {
      if (value === null) this.storage?.removeItem(key);
      else this.storage?.setItem(key, value);
    } catch {
      /* A refused storage keeps nothing across a reload. */
    }
  }
  // #endregion
}
