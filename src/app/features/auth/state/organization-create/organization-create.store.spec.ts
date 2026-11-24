import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { OrganizationApi } from '../../data-access/services/organization-api/organization-api.service';
import type {
  OrganizationChoice,
  OrganizationDraft,
} from '../../models/organization/organization.interface';
import { OrganizationCreateStore } from './organization-create.store';

/**
 * Constant studio
 *
 * @description
 * The created organization.
 *
 * @type {OrganizationChoice}
 */
const studio: OrganizationChoice = {
  id: 'org-studio',
  name: 'Studio Nord',
  slug: 'studio-nord',
  role: 'owner',
  memberCount: 1,
  plan: 'free',
};

/**
 * Constant draft
 *
 * @description
 * A creation with a logo.
 *
 * @type {OrganizationDraft}
 */
const draft: OrganizationDraft = {
  name: 'Studio Nord',
  teamSize: '6-20',
  primaryUse: 'product-engineering',
  inviteEmails: [],
  logo: new File(['png'], 'logo.png', { type: 'image/png' }),
};

/**
 * Function setup
 *
 * @description
 * Provides the store with a faked organization API.
 *
 * @param {Partial<Record<keyof OrganizationApi, unknown>>} api - Faked operations.
 * @returns {OrganizationCreateStore} The store.
 */
function setup(api: Partial<Record<keyof OrganizationApi, unknown>>): OrganizationCreateStore {
  TestBed.configureTestingModule({
    providers: [OrganizationCreateStore, { provide: OrganizationApi, useValue: api }],
  });
  return TestBed.inject(OrganizationCreateStore);
}

describe('OrganizationCreateStore', () => {
  it('creates, then enters the new organization with its logo and opens its workspace', async () => {
    const calls: string[] = [];
    const store: OrganizationCreateStore = setup({
      create: vi.fn(() => {
        calls.push('create');
        return Promise.resolve(studio);
      }),
      enterCreated: vi.fn((id: string, logo: File | null) => {
        calls.push(`enter ${id} ${logo?.name ?? 'without logo'}`);
        return Promise.resolve({ logoFailed: false });
      }),
    });

    await expect(store.create(draft)).resolves.toEqual({
      ok: true,
      destination: '/studio-nord',
      logoFailed: false,
    });
    expect(calls).toEqual(['create', 'enter org-studio logo.png']);
    expect(store.creating()).toBe(false);
  });

  it('opens the chooser for a created organization whose slug is reserved', async () => {
    const store: OrganizationCreateStore = setup({
      create: () => Promise.resolve({ ...studio, slug: 'home' }),
      enterCreated: () => Promise.resolve({ logoFailed: false }),
    });

    await expect(store.create({ ...draft, logo: null })).resolves.toMatchObject({
      ok: true,
      destination: '/organizations',
    });
  });

  it('keeps the creation when the logo upload fails', async () => {
    const store: OrganizationCreateStore = setup({
      create: () => Promise.resolve(studio),
      enterCreated: () => Promise.resolve({ logoFailed: true }),
    });

    await expect(store.create(draft)).resolves.toMatchObject({ ok: true, logoFailed: true });
  });

  it('returns the address refusals of the gateway without a created organization', async () => {
    for (const [status, code] of [
      [422, 'organization.slug-invalid'],
      [422, 'organization.slug-reserved'],
      [409, 'organization.slug-taken'],
    ] as const) {
      TestBed.resetTestingModule();
      const store: OrganizationCreateStore = setup({
        create: vi.fn().mockRejectedValue(new HttpErrorResponse({ status, error: { code } })),
      });
      await expect(store.create({ ...draft, logo: null })).resolves.toEqual({
        ok: false,
        problem: { status, code, remainingAttempts: null },
        created: null,
      });
    }
  });

  it('reports the created organization when the session could not move to it', async () => {
    const store: OrganizationCreateStore = setup({
      create: () => Promise.resolve(studio),
      enterCreated: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 404 })),
    });

    await expect(store.create(draft)).resolves.toMatchObject({ ok: false, created: studio });
  });
});
