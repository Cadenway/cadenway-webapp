import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { OrganizationApi } from '../../data-access/services/organization-api/organization-api.service';
import type {
  OrganizationChoice,
  ReceivedInvitation,
} from '../../models/organization/organization.interface';
import { OrganizationChoiceStore } from './organization-choice.store';

/**
 * Constant atelierNord
 *
 * @description
 * Atelier Nord on the chooser.
 *
 * @type {OrganizationChoice}
 */
const atelierNord: OrganizationChoice = {
  id: 'org-atelier-nord',
  name: 'Atelier Nord',
  slug: 'atelier-nord',
  role: 'owner',
  memberCount: 18,
  plan: 'team',
};

/**
 * Constant lumen
 *
 * @description
 * Lumen Cooperative once joined.
 *
 * @type {OrganizationChoice}
 */
const lumen: OrganizationChoice = {
  id: 'org-lumen',
  name: 'Lumen Cooperative',
  slug: 'lumen',
  role: 'member',
  memberCount: 41,
  plan: 'enterprise',
};

/**
 * Constant invitation
 *
 * @description
 * Inès Robert's invitation to Lumen Cooperative.
 *
 * @type {ReceivedInvitation}
 */
const invitation: ReceivedInvitation = {
  id: 'invitation-lumen',
  organizationName: 'Lumen Cooperative',
  role: 'member',
  inviterName: 'Inès Robert',
  expiresAt: '2026-11-15T10:00:00Z',
};

/**
 * Function setup
 *
 * @description
 * Provides the store with a faked organization API and lets its reads settle.
 *
 * @param {Partial<Record<keyof OrganizationApi, unknown>>} api - Faked operations.
 * @returns {Promise<OrganizationChoiceStore>} The store.
 */
async function setup(
  api: Partial<Record<keyof OrganizationApi, unknown>>,
): Promise<OrganizationChoiceStore> {
  TestBed.configureTestingModule({
    providers: [
      OrganizationChoiceStore,
      {
        provide: OrganizationApi,
        useValue: {
          listMine: vi.fn(() => Promise.resolve([atelierNord])),
          listReceivedInvitations: vi.fn(() => Promise.resolve([invitation])),
          ...api,
        },
      },
    ],
  });
  const store: OrganizationChoiceStore = TestBed.inject(OrganizationChoiceStore);
  await vi.advanceTimersByTimeAsync(0);
  TestBed.tick();
  await vi.advanceTimersByTimeAsync(0);
  return store;
}

describe('OrganizationChoiceStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flags a failed list without emptying it into an empty state, then retries', async () => {
    const listMine: Mock = vi
      .fn()
      .mockRejectedValueOnce(
        new HttpErrorResponse({ status: 503, error: { code: 'upstream.unavailable' } }),
      )
      .mockResolvedValue([atelierNord]);
    const store: OrganizationChoiceStore = await setup({ listMine });

    expect(store.loadProblem()).toMatchObject({ status: 503 });
    expect(store.choices()).toEqual([]);
    store.reload();
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);

    expect(listMine).toHaveBeenCalledTimes(2);
    expect(store.loadProblem()).toBeNull();
    expect(store.choices()).toEqual([atelierNord]);
  });

  it('flags a failed invitation list and reads it again on retry', async () => {
    const listReceivedInvitations: Mock = vi
      .fn()
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }))
      .mockResolvedValue([invitation]);
    const store: OrganizationChoiceStore = await setup({ listReceivedInvitations });

    expect(store.invitationsProblem()).toMatchObject({ status: 503 });
    expect(store.choices()).toEqual([atelierNord]);
    store.reloadInvitations();
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);

    expect(store.invitationsProblem()).toBeNull();
    expect(store.pendingInvitations()).toEqual([invitation]);
  });

  it('switches the session and gives the workspace path', async () => {
    const choose: Mock = vi.fn(() => Promise.resolve());
    const store: OrganizationChoiceStore = await setup({ choose });

    await expect(store.choose(atelierNord)).resolves.toBe('/atelier-nord');
    expect(choose).toHaveBeenCalledWith('org-atelier-nord', false);
  });

  it('never gives a reserved slug as the workspace path', async () => {
    const store: OrganizationChoiceStore = await setup({ choose: () => Promise.resolve() });

    await expect(store.choose({ ...atelierNord, slug: 'login' })).resolves.toBe('/organizations');
  });

  it('keeps a refused switch as the failure of the choice', async () => {
    const store: OrganizationChoiceStore = await setup({
      choose: vi
        .fn()
        .mockRejectedValue(
          new HttpErrorResponse({ status: 403, error: { code: 'organization.mfa-required' } }),
        ),
    });

    await expect(store.choose(atelierNord)).resolves.toBeNull();
    expect(store.failure()).toMatchObject({
      action: 'choose',
      problem: { code: 'organization.mfa-required' },
    });
    expect(store.pendingId()).toBeNull();
  });

  it('shows an accepted invitation first as new, and switches to it with retries', async () => {
    const choose: Mock = vi.fn(() => Promise.resolve());
    const store: OrganizationChoiceStore = await setup({
      acceptInvitation: () => Promise.resolve(lumen),
      choose,
    });

    await store.accept(invitation);

    expect(store.pendingInvitations()).toEqual([]);
    expect(store.choices().map((item: OrganizationChoice) => item.id)).toEqual([
      'org-lumen',
      'org-atelier-nord',
    ]);
    await store.choose(lumen);
    expect(choose).toHaveBeenCalledWith('org-lumen', true);
  });

  it('refuses an invitation after 6 seconds unless undone', async () => {
    const refuseInvitation: Mock = vi.fn(() => Promise.resolve());
    const store: OrganizationChoiceStore = await setup({ refuseInvitation });

    store.refuse(invitation);
    expect(store.pendingInvitations()).toEqual([]);
    expect(store.refused()).toEqual(invitation);
    store.undoRefuse();
    expect(store.pendingInvitations()).toEqual([invitation]);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(refuseInvitation).not.toHaveBeenCalled();

    store.refuse(invitation);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(refuseInvitation).toHaveBeenCalledExactlyOnceWith('invitation-lumen');
    expect(store.refused()).toBeNull();
  });

  it('shows the invitation again when the refusal fails, and sends a waiting one on destroy', async () => {
    const refuseInvitation: Mock = vi
      .fn()
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }))
      .mockResolvedValue(undefined);
    const store: OrganizationChoiceStore = await setup({ refuseInvitation });

    store.refuse(invitation);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(store.pendingInvitations()).toEqual([invitation]);
    expect(store.failure()).toMatchObject({ action: 'refuse' });

    store.refuse(invitation);
    TestBed.resetTestingModule();
    await vi.advanceTimersByTimeAsync(0);
    expect(refuseInvitation).toHaveBeenCalledTimes(2);
  });
});
