import type { Member } from '@cadenway/api-client';
import { describe, expect, it } from 'vitest';

import { toMemberPage, toOrganizationMember } from './member.adapter';

/**
 * Constant INES
 *
 * @description
 * Inès Robert as `GET /v1/members` answers an administrator.
 *
 * @type {Member}
 */
const INES: Member = {
  id: 'ir',
  userId: 'u-ir',
  avatarId: null,
  name: 'Inès Robert',
  email: 'ines.robert@ateliernord.fr',
  role: 'admin',
  joinedAt: '2026-03-01T09:00:00Z',
  version: 3,
  twoStepVerificationEnabled: true,
};

describe('member adapter', () => {
  it('keeps the shown fields and the two-step flag', () => {
    expect(toOrganizationMember(INES)).toEqual({
      id: 'ir',
      userId: 'u-ir',
      name: 'Inès Robert',
      email: 'ines.robert@ateliernord.fr',
      role: 'admin',
      twoStepVerification: true,
      version: 3,
    });
  });

  it('holds null when the caller may not know the two-step flag', () => {
    const member: Member = { ...INES };
    delete member.twoStepVerificationEnabled;

    expect(toOrganizationMember(member).twoStepVerification).toBeNull();
  });

  it('maps a page with its total, counts and next cursor', () => {
    expect(
      toMemberPage({
        items: [INES],
        nextCursor: null,
        total: 22,
        counts: { owner: 1, admin: 2, member: 15, guest: 4 },
      }),
    ).toMatchObject({ total: 22, nextCursor: null, counts: { member: 15, guest: 4 } });
  });
});
