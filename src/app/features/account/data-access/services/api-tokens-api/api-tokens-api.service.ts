import { inject, Service } from '@angular/core';
import {
  type ApiTokenCreated as ApiTokenCreatedDto,
  type ApiTokenPage as ApiTokenPageDto,
  ApiTokensService,
} from '@cadenway/api-client';
import { firstValueFrom, fromEvent, type Observable, takeUntil } from 'rxjs';

import type {
  ApiToken,
  ApiTokenDraft,
  CreatedApiToken,
} from '../../../models/api-token/api-token.interface';
import { toApiToken, toCreatedApiToken } from '../../adapters/api-token/api-token.adapter';

/**
 * Constant PAGE_SIZE
 *
 * @description
 * Tokens asked for per page, the contract's maximum.
 *
 * @type {number}
 */
const PAGE_SIZE: number = 100;

/**
 * Constant MAX_PAGES
 *
 * @description
 * Pages read at most for one list, a bound against a cursor that never ends.
 *
 * @type {number}
 */
const MAX_PAGES: number = 20;

/**
 * Class IncompleteTokenListError
 *
 * @description
 * The gateway's cursor did not end within `MAX_PAGES` pages, or came back to a page already read.
 * The list is then refused rather than shown partly as if it were complete, so the page shows its
 * error with `Retry`.
 */
export class IncompleteTokenListError extends Error {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Names the error.
   *
   * @constructor
   */
  public constructor() {
    super('The token list did not end.');
    this.name = 'IncompleteTokenListError';
  }
  // #endregion
}

/**
 * Function abortable
 *
 * @description
 * Waits for the first answer of a request, which the signal cancels.
 *
 * @template T
 * @param {Observable<T>} source - The request.
 * @param {AbortSignal | undefined} signal - Cancels a superseded read.
 * @returns {Promise<T>} The answer.
 */
function abortable<T>(source: Observable<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  return firstValueFrom(signal ? source.pipe(takeUntil(fromEvent(signal, 'abort'))) : source);
}

/**
 * Service ApiTokensApi
 *
 * @description
 * The account's access to the personal API tokens of the signed-in person in the current
 * organization (`openapi/public/api-tokens.yaml`), mapped to display models. Its methods reject
 * with the gateway's `HttpErrorResponse`. It never logs the secret of a new token.
 */
@Service()
export class ApiTokensApi {
  // #region Properties
  /**
   * Property tokens
   *
   * @description
   * Generated token operations.
   *
   * @type {ApiTokensService}
   * @readonly
   */
  private readonly tokens: ApiTokensService = inject(ApiTokensService);
  // #endregion

  // #region Methods
  /**
   * Method list
   *
   * @description
   * Reads every active token, the most recently created first, following the cursor. It rejects
   * with `IncompleteTokenListError` rather than return part of the list when the cursor does not
   * end within 20 pages or repeats, and stops when the signal aborts.
   *
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<readonly ApiToken[]>} The tokens.
   * @throws {IncompleteTokenListError} When the cursor does not end.
   */
  public async list(signal?: AbortSignal): Promise<readonly ApiToken[]> {
    const tokens: ApiToken[] = [];
    const seen: Set<string> = new Set<string>();
    let cursor: string | undefined;
    for (let page: number = 0; page < MAX_PAGES; page += 1) {
      const answer: ApiTokenPageDto = await abortable(
        this.tokens.listApiTokens(
          cursor === undefined ? { limit: PAGE_SIZE } : { cursor, limit: PAGE_SIZE },
        ),
        signal,
      );
      const now: number = Date.now();
      tokens.push(...answer.items.map((token) => toApiToken(token, now)));
      if (answer.nextCursor === null) return tokens;
      if (seen.has(answer.nextCursor)) throw new IncompleteTokenListError();
      seen.add(answer.nextCursor);
      cursor = answer.nextCursor;
    }
    throw new IncompleteTokenListError();
  }

  /**
   * Method create
   *
   * @description
   * Creates a token. Outside the 10-minute window of recent authentication it rejects with
   * `403 auth.reauthentication-required` and creates nothing, so it is safe to send again once
   * the person confirmed who they are.
   *
   * @param {ApiTokenDraft} draft - Name, scopes and expiration.
   * @returns {Promise<CreatedApiToken>} The new token and its secret, returned this once only.
   */
  public async create(draft: ApiTokenDraft): Promise<CreatedApiToken> {
    const created: ApiTokenCreatedDto = await firstValueFrom(
      this.tokens.createApiToken({
        name: draft.name,
        scopes: [...draft.scopes],
        expiration: draft.expiration,
      }),
    );
    return toCreatedApiToken(created, Date.now());
  }

  /**
   * Method revoke
   *
   * @description
   * Revokes a token; revoking it again succeeds too. An unknown token rejects with
   * `404 api-token.not-found`.
   *
   * @param {string} id - Identifier of the token.
   * @returns {Promise<void>} Resolves once the token no longer works.
   */
  public async revoke(id: string): Promise<void> {
    await firstValueFrom(this.tokens.revokeApiToken(id));
  }
  // #endregion
}
