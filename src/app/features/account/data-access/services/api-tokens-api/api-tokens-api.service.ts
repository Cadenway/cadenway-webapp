import { inject, Service } from '@angular/core';
import {
  type ApiTokenCreated as ApiTokenCreatedDto,
  type ApiTokenPage as ApiTokenPageDto,
  ApiTokensService,
} from '@cadenway/api-client';
import { firstValueFrom } from 'rxjs';

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
   * Reads every active token, the most recently created first, following the cursor.
   *
   * @returns {Promise<readonly ApiToken[]>} The tokens.
   */
  public async list(): Promise<readonly ApiToken[]> {
    const tokens: ApiToken[] = [];
    let cursor: string | undefined;
    for (let page: number = 0; page < MAX_PAGES; page += 1) {
      const answer: ApiTokenPageDto = await firstValueFrom(
        this.tokens.listApiTokens(
          cursor === undefined ? { limit: PAGE_SIZE } : { cursor, limit: PAGE_SIZE },
        ),
      );
      const now: number = Date.now();
      tokens.push(...answer.items.map((token) => toApiToken(token, now)));
      if (answer.nextCursor === null) break;
      cursor = answer.nextCursor;
    }
    return tokens;
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
