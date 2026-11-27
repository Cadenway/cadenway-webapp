import type { ApiToken as ApiTokenDto } from '@cadenway/api-client';
import { describe, expect, it } from 'vitest';

import { toApiToken, toCreatedApiToken, toExpiry, toLastUse } from './api-token.adapter';

/**
 * Constant NOW
 *
 * @description
 * The instant the fixtures are read at: 27 November 2026, 10:00 UTC.
 *
 * @type {number}
 */
const NOW: number = Date.parse('2026-11-27T10:00:00Z');

/**
 * Constant gitlab
 *
 * @description
 * The mockup's `GitLab continuous integration` token as the gateway lists it.
 *
 * @type {ApiTokenDto}
 */
const gitlab: ApiTokenDto = {
  id: 't1',
  name: 'GitLab continuous integration',
  prefix: 'cw_pat_4c1e',
  scopes: ['tasks:read', 'tasks:write'],
  organizationId: 'o1',
  createdAt: '2026-10-14T09:00:00Z',
  expiresAt: '2027-03-12T09:00:00Z',
  lastUsedAt: '2026-11-27T09:55:00Z',
};

describe('api-token adapter', () => {
  it('maps a listed token to its row, with the prefix ellipsis', () => {
    expect(toApiToken(gitlab, NOW)).toEqual({
      id: 't1',
      name: 'GitLab continuous integration',
      prefix: 'cw_pat_4c1e…',
      scopes: ['tasks:read', 'tasks:write'],
      lastUse: { kind: 'minutes', count: 5 },
      expiry: { kind: 'date', date: '2027-03-12', soon: false },
    });
  });

  it.each([
    [null, { kind: 'never' }],
    ['2026-11-27T09:59:50Z', { kind: 'minutes', count: 1 }],
    ['2026-11-27T09:00:00Z', { kind: 'hours', count: 1 }],
    ['2026-11-06T10:00:00Z', { kind: 'days', count: 21 }],
    ['2026-08-01T10:00:00Z', { kind: 'date', date: '2026-08-01' }],
  ] as const)('words a last use at %s', (lastUsedAt: string | null, expected: object) => {
    expect(toLastUse(lastUsedAt, NOW)).toEqual(expected);
  });

  it.each([
    [null, { kind: 'never', soon: false }],
    ['2026-12-03T10:00:00Z', { kind: 'days', count: 6, soon: true }],
    ['2027-02-25T10:00:00Z', { kind: 'days', count: 90, soon: false }],
    ['2027-11-27T10:00:00Z', { kind: 'years', count: 1, soon: false }],
    ['2028-11-27T10:00:00Z', { kind: 'years', count: 2, soon: false }],
    ['2027-03-12T09:00:00Z', { kind: 'date', date: '2027-03-12', soon: false }],
    ['2027-11-28T10:00:00Z', { kind: 'date', date: '2027-11-28', soon: false }],
  ] as const)('words an expiry at %s', (expiresAt: string | null, expected: object) => {
    expect(toExpiry(expiresAt, NOW)).toEqual(expected);
  });

  it('keeps the secret of a created token next to its row', () => {
    const secret: string = `cw_pat_${'A'.repeat(36)}`;

    expect(toCreatedApiToken({ apiToken: gitlab, secret }, NOW)).toEqual({
      token: toApiToken(gitlab, NOW),
      secret,
    });
  });
});
