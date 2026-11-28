import type { Organization as OrganizationDto } from '@cadenway/api-client';
import { describe, expect, it } from 'vitest';

import {
  refusedFields,
  toOrganizationLogoUpload,
  toOrganizationPatch,
  toOrganizationProfile,
} from './organization.adapter';

/**
 * Constant ATELIER_NORD
 *
 * @description
 * Atelier Nord as the gateway answers it to its owner (the contract's example).
 *
 * @type {OrganizationDto}
 */
const ATELIER_NORD: OrganizationDto = {
  id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f',
  name: 'Atelier Nord',
  slug: 'atelier-nord',
  description: 'Furniture and interior design studio, 18 people between Lille and Lyon.',
  website: 'https://ateliernord.fr',
  defaultLanguage: 'fr',
  plan: 'team',
  memberCount: 18,
  role: 'owner',
  createdAt: '2026-03-02T09:00:00Z',
  version: 3,
};

describe('organization adapter', () => {
  it('maps the organization to the profile, without a logo', () => {
    expect(toOrganizationProfile(ATELIER_NORD)).toEqual({
      id: ATELIER_NORD.id,
      name: 'Atelier Nord',
      slug: 'atelier-nord',
      description: ATELIER_NORD.description,
      website: 'https://ateliernord.fr',
      defaultLanguage: 'fr',
      logoId: null,
      initials: 'AN',
      version: 3,
    });
  });

  it('keeps the logo reference and drops a language this version does not know', () => {
    const profile: ReturnType<typeof toOrganizationProfile> = toOrganizationProfile({
      ...ATELIER_NORD,
      logoId: '019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b01',
      defaultLanguage: 'es',
    });

    expect(profile.logoId).toBe('019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b01');
    expect(profile.defaultLanguage).toBeNull();
  });

  it('derives the same initials as the rail: first and last words, two letters of one word', () => {
    expect(toOrganizationProfile({ ...ATELIER_NORD, name: 'Atelier Nord Est' }).initials).toBe(
      'AE',
    );
    expect(toOrganizationProfile({ ...ATELIER_NORD, name: 'Cadenway' }).initials).toBe('CA');
  });

  it('patches only the changed members, null clearing', () => {
    expect(toOrganizationPatch({ slug: 'nord', description: null })).toEqual({
      slug: 'nord',
      description: null,
    });
    expect(toOrganizationPatch({})).toEqual({});
  });

  it('maps a logo reservation', () => {
    expect(
      toOrganizationLogoUpload({
        uploadId: 'upload-1',
        method: 'POST',
        url: 'https://files.example.com/upload',
        fields: { 'Content-Type': 'image/png' },
        expiresAt: '2026-11-08T08:10:00Z',
      }),
    ).toEqual({
      uploadId: 'upload-1',
      url: 'https://files.example.com/upload',
      fields: { 'Content-Type': 'image/png' },
    });
  });

  it('names each refused form field once and ignores the other issues', () => {
    expect(
      refusedFields({
        issues: [
          { in: 'body', path: 'website', code: 'invalid_format' },
          { in: 'body', path: 'website', code: 'too_big' },
          { in: 'body', path: '', code: 'invalid_type' },
          { in: 'header', path: 'If-Match', code: 'invalid' },
          { in: 'body', path: 'name', code: 'too_small' },
        ],
      }),
    ).toEqual(['website', 'name']);
    expect(refusedFields(null)).toEqual([]);
    expect(refusedFields({ issues: 'none' })).toEqual([]);
  });
});
