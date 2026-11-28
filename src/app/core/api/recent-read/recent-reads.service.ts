import type { HttpResponse } from '@angular/common/http';
import { Service } from '@angular/core';

/**
 * Interface KeptRead
 *
 * @description
 * A kept answer and when it arrived.
 */
interface KeptRead {
  // #region Properties
  /**
   * Property at
   *
   * @description
   * When the answer arrived, in milliseconds since the epoch.
   *
   * @type {number}
   * @readonly
   */
  readonly at: number;

  /**
   * Property response
   *
   * @description
   * The answer.
   *
   * @type {HttpResponse<unknown>}
   * @readonly
   */
  readonly response: HttpResponse<unknown>;
  // #endregion
}

/**
 * Service RecentReads
 *
 * @description
 * The last successful answer of each recorded read (`RECORD_READ`), by address with its
 * parameters, which `recentReadInterceptor` hands to a reader asking for the same address soon
 * after. One answer per address is kept, the newest; a write forgets them all.
 */
@Service()
export class RecentReads {
  // #region Properties
  /**
   * Property kept
   *
   * @description
   * The kept answers by address.
   *
   * @type {Map<string, KeptRead>}
   * @readonly
   */
  private readonly kept: Map<string, KeptRead> = new Map<string, KeptRead>();
  // #endregion

  // #region Methods
  /**
   * Method keep
   *
   * @description
   * Keeps the newest answer of an address.
   *
   * @param {string} key - The address with its parameters.
   * @param {HttpResponse<unknown>} response - The answer.
   */
  public keep(key: string, response: HttpResponse<unknown>): void {
    this.kept.set(key, { at: Date.now(), response });
  }

  /**
   * Method take
   *
   * @description
   * The kept answer of an address, when it arrived no more than `within` milliseconds ago.
   *
   * @param {string} key - The address with its parameters.
   * @param {number} within - The oldest age accepted, in milliseconds.
   * @returns {HttpResponse<unknown> | null} The answer, or null.
   */
  public take(key: string, within: number): HttpResponse<unknown> | null {
    const read: KeptRead | undefined = this.kept.get(key);
    return read !== undefined && Date.now() - read.at <= within ? read.response : null;
  }

  /**
   * Method clear
   *
   * @description
   * Forgets every kept answer.
   */
  public clear(): void {
    this.kept.clear();
  }
  // #endregion
}
