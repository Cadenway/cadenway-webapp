import { TestBed } from '@angular/core/testing';
import {
  type ApiToken as ApiTokenDto,
  type ApiTokenPage as ApiTokenPageDto,
  ApiTokensService,
} from '@cadenway/api-client';
import { NEVER, of } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { ApiToken } from '../../../models/api-token/api-token.interface';
import { ApiTokensApi, IncompleteTokenListError } from './api-tokens-api.service';

/**
 * Function dto
 *
 * @description
 * A listed token of Atelier Nord.
 *
 * @param {string} id - Its id.
 * @param {string} name - Its name.
 * @returns {ApiTokenDto} The token.
 */
function dto(id: string, name: string): ApiTokenDto {
  return {
    id,
    name,
    prefix: 'cw_pat_9ab2',
    scopes: ['tasks:write'],
    organizationId: 'o1',
    createdAt: '2026-10-14T09:00:00Z',
    expiresAt: null,
    lastUsedAt: null,
  };
}

describe('ApiTokensApi', () => {
  let client: { listApiTokens: Mock; createApiToken: Mock; revokeApiToken: Mock };

  beforeEach(() => {
    client = { listApiTokens: vi.fn(), createApiToken: vi.fn(), revokeApiToken: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiTokensService, useValue: client }],
    });
  });

  it('follows the cursor until the last page', async () => {
    const pages: ApiTokenPageDto[] = [
      { items: [dto('t1', 'GitLab continuous integration')], nextCursor: 'c2' },
      { items: [dto('t2', 'Trello import script')], nextCursor: null },
    ];
    client.listApiTokens.mockImplementation(() => of(pages.shift()));

    const tokens: readonly ApiToken[] = await TestBed.inject(ApiTokensApi).list();

    expect(tokens.map((token: ApiToken): string => token.name)).toEqual([
      'GitLab continuous integration',
      'Trello import script',
    ]);
    expect(client.listApiTokens.mock.calls).toEqual([
      [{ limit: 100 }],
      [{ cursor: 'c2', limit: 100 }],
    ]);
  });

  it('sends the draft and returns the new row with its secret', async () => {
    const secret: string = `cw_pat_${'B'.repeat(36)}`;
    client.createApiToken.mockReturnValue(of({ apiToken: dto('t4', 'GitLab sync'), secret }));

    const created: { token: ApiToken; secret: string } = await TestBed.inject(ApiTokensApi).create({
      name: 'GitLab sync',
      scopes: ['tasks:read', 'members:read'],
      expiration: '90-days',
    });

    expect(client.createApiToken).toHaveBeenCalledWith({
      name: 'GitLab sync',
      scopes: ['tasks:read', 'members:read'],
      expiration: '90-days',
    });
    expect(created.token.id).toBe('t4');
    expect(created.secret).toBe(secret);
  });

  it('revokes a token by its id', async () => {
    client.revokeApiToken.mockReturnValue(of(null));

    await TestBed.inject(ApiTokensApi).revoke('t2');

    expect(client.revokeApiToken).toHaveBeenCalledWith('t2');
  });

  it('refuses a list whose cursor does not end within 20 pages', async () => {
    let page: number = 0;
    client.listApiTokens.mockImplementation(() => {
      page += 1;
      return of({
        items: [dto(`t${String(page)}`, 'Grafana dashboard')],
        nextCursor: `c${String(page)}`,
      });
    });

    await expect(TestBed.inject(ApiTokensApi).list()).rejects.toBeInstanceOf(
      IncompleteTokenListError,
    );
    expect(client.listApiTokens).toHaveBeenCalledTimes(20);
  });

  it('refuses a list whose cursor comes back to a page already read', async () => {
    client.listApiTokens.mockImplementation(() =>
      of({ items: [dto('t1', 'GitLab continuous integration')], nextCursor: 'c2' }),
    );

    await expect(TestBed.inject(ApiTokensApi).list()).rejects.toBeInstanceOf(
      IncompleteTokenListError,
    );
    expect(client.listApiTokens).toHaveBeenCalledTimes(2);
  });

  it('stops reading when its signal aborts', async () => {
    client.listApiTokens.mockReturnValue(NEVER);
    const controller: AbortController = new AbortController();

    const read: Promise<readonly ApiToken[]> = TestBed.inject(ApiTokensApi).list(controller.signal);
    controller.abort();

    await expect(read).rejects.toBeDefined();
    expect(client.listApiTokens).toHaveBeenCalledOnce();
  });
});
