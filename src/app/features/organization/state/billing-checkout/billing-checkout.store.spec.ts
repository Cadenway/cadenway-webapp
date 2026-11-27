import { HttpErrorResponse } from '@angular/common/http';
import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { OrganizationSwitchPendingError } from '@core/api';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceOrganization,
} from '@features/workspace/ports/workspace-context';

import { BillingApi } from '../../data-access/services/billing-api/billing-api.service';
import type { OrganizationSubscription } from '../../models/organization-subscription/organization-subscription.interface';
import { SubscriptionStore } from '../subscription/subscription.store';
import { BillingCheckoutStore, type CheckoutOutcome } from './billing-checkout.store';
import { CHECKOUT_CONFIRM_DELAYS_MS } from './checkout-confirm-delays.token';
import {
  CHECKOUT_KEY_LIFETIME_MS,
  CHECKOUT_KEY_STORAGE,
  type CheckoutKeyRecord,
} from './checkout-key.storage';
import { InvoicesStore } from '../invoices/invoices.store';
import { CHECKOUT_REDIRECT } from './checkout-redirect.token';
import { PAYMENT_PENDING_STORAGE } from './payment-pending.storage';

/**
 * Constant FREE
 *
 * @description
 * Atelier Nord still on the Free plan.
 *
 * @type {OrganizationSubscription}
 */
const FREE: OrganizationSubscription = {
  plan: 'free',
  seatsUsed: 3,
  seatsLimit: 5,
  storageUsedBytes: 120_000_000,
  storageLimitBytes: 2_000_000_000,
};

/**
 * Constant TEAM
 *
 * @description
 * Atelier Nord once the Team plan is confirmed.
 *
 * @type {OrganizationSubscription}
 */
const TEAM: OrganizationSubscription = { ...FREE, plan: 'team', seatsLimit: 25 };

/**
 * Constant CHECKOUT_URL
 *
 * @description
 * A Stripe test Checkout address; it is never opened.
 *
 * @type {string}
 */
const CHECKOUT_URL: string = 'https://checkout.stripe.com/c/pay/cs_test_nord';

/**
 * Function problem
 *
 * @description
 * A refused call of the gateway.
 *
 * @param {number} status - HTTP status.
 * @param {string} code - Problem code.
 * @returns {HttpErrorResponse} The error.
 */
function problem(status: number, code: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { type: 'about:blank', title: '', status, code } });
}

/**
 * Function organization
 *
 * @description
 * A workspace organization of the fixtures.
 *
 * @param {string} id - Organization id.
 * @returns {WorkspaceOrganization} The organization.
 */
function organization(id: string): WorkspaceOrganization {
  return { id, slug: id, name: id, initials: 'AN', role: 'owner', plan: 'free' };
}

describe('BillingCheckoutStore', () => {
  let api: { checkout: Mock; subscription: Mock };
  let redirect: Mock;
  let setSubscription: Mock;
  let current: WritableSignal<OrganizationSubscription | null>;
  let reloadInvoices: Mock;
  let shown: WritableSignal<WorkspaceOrganization>;
  let userId: string;

  /**
   * Function store
   *
   * @description
   * Creates the store.
   *
   * @returns {InstanceType<typeof BillingCheckoutStore>} The store.
   */
  function store(): InstanceType<typeof BillingCheckoutStore> {
    TestBed.configureTestingModule({
      providers: [
        BillingCheckoutStore,
        { provide: BillingApi, useValue: api },
        { provide: CHECKOUT_REDIRECT, useValue: redirect },
        { provide: CHECKOUT_CONFIRM_DELAYS_MS, useValue: [0, 0, 0] },
        {
          provide: SubscriptionStore,
          useValue: { subscription: { set: setSubscription }, current },
        },
        { provide: InvoicesStore, useValue: { retry: reloadInvoices } },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: { organization: shown, user: () => ({ id: userId }) },
        },
      ],
    });
    return TestBed.inject(BillingCheckoutStore);
  }

  /**
   * Function recreated
   *
   * @description
   * Destroys the store and creates another, as the reload back from Stripe does.
   *
   * @returns {InstanceType<typeof BillingCheckoutStore>} The new store.
   */
  function recreated(): InstanceType<typeof BillingCheckoutStore> {
    TestBed.resetTestingModule();
    return store();
  }

  /**
   * Function keysSent
   *
   * @description
   * The idempotency keys of the checkouts sent, in order.
   *
   * @returns {string[]} The keys.
   */
  function keysSent(): string[] {
    return api.checkout.mock.calls.map((call: unknown[]) => String(call[0]));
  }

  beforeEach(() => {
    sessionStorage.clear();
    api = {
      checkout: vi.fn(() => Promise.resolve(CHECKOUT_URL)),
      subscription: vi.fn(() => Promise.resolve(TEAM)),
    };
    redirect = vi.fn();
    current = signal<OrganizationSubscription | null>(null);
    setSubscription = vi.fn((value: OrganizationSubscription): void => {
      current.set(value);
    });
    reloadInvoices = vi.fn();
    shown = signal(organization('org-nord'));
    userId = 'user-camille';
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('replays the open Checkout once back from Stripe, the store created again', async () => {
    await store().start();

    await recreated().start();

    expect(keysSent()).toHaveLength(2);
    expect(keysSent()[1]).toBe(keysSent()[0]);
  });

  it('sends the same key after an unknown outcome and a reload', async () => {
    api.checkout.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    await expect(store().start()).resolves.toBe('failed');

    await expect(recreated().start()).resolves.toBe('redirected');

    expect(keysSent()[1]).toBe(keysSent()[0]);
  });

  it('takes a new key after a definite refusal, even once the store is created again', async () => {
    api.checkout.mockRejectedValueOnce(problem(409, 'billing.checkout-in-progress'));
    await store().start();
    expect(sessionStorage.getItem(CHECKOUT_KEY_STORAGE)).toBeNull();

    await recreated().start();

    expect(keysSent()[1]).not.toBe(keysSent()[0]);
  });

  it('takes a new key two hours after the last one', async () => {
    await store().start();
    const stored: CheckoutKeyRecord = JSON.parse(
      sessionStorage.getItem(CHECKOUT_KEY_STORAGE) ?? '{}',
    ) as CheckoutKeyRecord;
    expect(stored).toMatchObject({ organizationId: 'org-nord', userId: 'user-camille' });
    sessionStorage.setItem(
      CHECKOUT_KEY_STORAGE,
      JSON.stringify({ ...stored, createdAt: Date.now() - CHECKOUT_KEY_LIFETIME_MS }),
    );

    await recreated().start();

    expect(keysSent()[1]).not.toBe(keysSent()[0]);
  });

  it('takes a new key for another person of the tab', async () => {
    await store().start();
    userId = 'user-hugo';

    await recreated().start();

    expect(keysSent()[1]).not.toBe(keysSent()[0]);
  });

  it('keeps the key for the page when the browser refuses the storage', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((): void => {
      throw new DOMException('Refused', 'SecurityError');
    });
    const checkout: InstanceType<typeof BillingCheckoutStore> = store();
    api.checkout.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));

    await checkout.start();
    await checkout.start();

    expect(keysSent()[1]).toBe(keysSent()[0]);
  });

  it('forgets the key and reads the plan again until it is no longer Free', async () => {
    await store().start();
    const checkout: InstanceType<typeof BillingCheckoutStore> = recreated();
    api.subscription.mockResolvedValueOnce(FREE).mockResolvedValueOnce(TEAM);

    const confirmed: Promise<void> = checkout.confirmPayment();
    expect(checkout.confirming()).toBe(true);
    expect(sessionStorage.getItem(CHECKOUT_KEY_STORAGE)).toBeNull();
    await confirmed;

    expect(api.subscription).toHaveBeenCalledTimes(2);
    expect(setSubscription).toHaveBeenLastCalledWith(TEAM);
    expect(checkout.confirming()).toBe(false);
    expect(checkout.unconfirmed()).toBe(false);
  });

  it('reports a payment still unconfirmed after the last read, and reads it once more on retry', async () => {
    api.subscription.mockResolvedValue(FREE);
    const checkout: InstanceType<typeof BillingCheckoutStore> = store();

    await checkout.confirmPayment();

    expect(api.subscription).toHaveBeenCalledTimes(3);
    expect(checkout.confirming()).toBe(false);
    expect(checkout.unconfirmed()).toBe(true);

    api.subscription.mockResolvedValueOnce(TEAM);
    await checkout.retryConfirmation();

    expect(api.subscription).toHaveBeenCalledTimes(4);
    expect(checkout.unconfirmed()).toBe(false);
  });

  it('stops confirming for an organization left meanwhile', async () => {
    let answer: (value: OrganizationSubscription) => void = (): void => undefined;
    api.subscription.mockReturnValueOnce(
      new Promise<OrganizationSubscription>(
        (resolve: (value: OrganizationSubscription) => void) => {
          answer = resolve;
        },
      ),
    );
    const checkout: InstanceType<typeof BillingCheckoutStore> = store();
    const confirmed: Promise<void> = checkout.confirmPayment();
    await vi.waitFor(() => {
      expect(api.subscription).toHaveBeenCalledTimes(1);
    });

    shown.set(organization('org-lumen'));
    expect(checkout.confirming()).toBe(false);
    answer(FREE);
    await confirmed;

    expect(api.subscription).toHaveBeenCalledTimes(1);
    expect(setSubscription).not.toHaveBeenCalled();
    expect(checkout.unconfirmed()).toBe(false);
  });

  it('opens the Checkout Billing answered', async () => {
    const checkout: InstanceType<typeof BillingCheckoutStore> = store();

    const started: Promise<CheckoutOutcome> = checkout.start();
    expect(checkout.starting()).toBe(true);

    await expect(started).resolves.toBe('redirected');
    expect(redirect).toHaveBeenCalledWith(CHECKOUT_URL);
    expect(checkout.starting()).toBe(false);
  });

  it('sends one checkout at a time', async () => {
    const checkout: InstanceType<typeof BillingCheckoutStore> = store();

    const first: Promise<CheckoutOutcome> = checkout.start();
    await expect(checkout.start()).resolves.toBe('skipped');
    await first;

    expect(api.checkout).toHaveBeenCalledTimes(1);
  });

  it('opens nothing when the organization switched before the answer', async () => {
    let answer: (url: string) => void = (): void => undefined;
    api.checkout.mockReturnValueOnce(
      new Promise<string>((resolve: (url: string) => void) => {
        answer = resolve;
      }),
    );
    const checkout: InstanceType<typeof BillingCheckoutStore> = store();
    const started: Promise<CheckoutOutcome> = checkout.start();

    shown.set(organization('org-lumen'));
    answer(CHECKOUT_URL);

    await expect(started).resolves.toBe('cancelled');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('opens nothing once the page is gone', async () => {
    let answer: (url: string) => void = (): void => undefined;
    api.checkout.mockReturnValueOnce(
      new Promise<string>((resolve: (url: string) => void) => {
        answer = resolve;
      }),
    );
    const checkout: InstanceType<typeof BillingCheckoutStore> = store();
    const started: Promise<CheckoutOutcome> = checkout.start();

    TestBed.resetTestingModule();
    answer(CHECKOUT_URL);

    await expect(started).resolves.toBe('cancelled');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('retries an unknown outcome with the same key, and a definite refusal with a new one', async () => {
    const checkout: InstanceType<typeof BillingCheckoutStore> = store();
    api.checkout
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }))
      .mockRejectedValueOnce(problem(409, 'idempotency.request-in-progress'))
      .mockRejectedValueOnce(problem(409, 'billing.checkout-in-progress'));

    await expect(checkout.start()).resolves.toBe('failed');
    await expect(checkout.start()).resolves.toBe('pending');
    await expect(checkout.start()).resolves.toBe('in-progress');
    await expect(checkout.start()).resolves.toBe('redirected');

    const keys: string[] = api.checkout.mock.calls.map((call: unknown[]) => String(call[0]));
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).toBe(keys[0]);
    expect(keys[3]).not.toBe(keys[0]);
  });

  it('takes a new key for another organization', async () => {
    const checkout: InstanceType<typeof BillingCheckoutStore> = store();
    api.checkout.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    await checkout.start();

    shown.set(organization('org-lumen'));
    await checkout.start();

    const keys: string[] = api.checkout.mock.calls.map((call: unknown[]) => String(call[0]));
    expect(keys[1]).not.toBe(keys[0]);
  });

  it.each([
    [problem(409, 'billing.subscription-active'), 'subscribed'],
    [problem(412, 'organization.context-changed'), 'context-changed'],
    [new OrganizationSwitchPendingError(), 'context-changed'],
    [problem(403, 'organization.role-forbidden'), 'failed'],
  ])('reports a refusal (%#)', async (error: unknown, outcome: string) => {
    api.checkout.mockRejectedValueOnce(error);

    await expect(store().start()).resolves.toBe(outcome);
    expect(redirect).not.toHaveBeenCalled();
  });

  it('tells whose payment the return from Stripe reports', async () => {
    const checkout: InstanceType<typeof BillingCheckoutStore> = store();
    expect(checkout.returnTarget()).toEqual({ kind: 'unknown' });

    await checkout.start();
    expect(checkout.returnTarget()).toEqual({ kind: 'here' });

    shown.set(organization('org-lumen'));
    expect(checkout.returnTarget()).toEqual({ kind: 'elsewhere', slug: 'org-nord' });

    userId = 'user-hugo';
    expect(checkout.returnTarget()).toEqual({ kind: 'unknown' });
  });

  it('resumes a payment awaiting confirmation once the store is created again', async () => {
    api.subscription.mockReturnValueOnce(
      new Promise<OrganizationSubscription>((): void => undefined),
    );
    const first: InstanceType<typeof BillingCheckoutStore> = store();
    void first.confirmPayment();
    expect(sessionStorage.getItem(PAYMENT_PENDING_STORAGE + 'org-nord')).not.toBeNull();
    api.subscription.mockReset();
    api.subscription.mockResolvedValueOnce(FREE).mockResolvedValueOnce(TEAM);

    const checkout: InstanceType<typeof BillingCheckoutStore> = recreated();

    expect(checkout.confirming()).toBe(true);
    expect(checkout.awaitingPayment()).toBe(true);
    await vi.waitFor(() => {
      expect(checkout.awaitingPayment()).toBe(false);
    });
    expect(api.subscription).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem(PAYMENT_PENDING_STORAGE + 'org-nord')).toBeNull();
    expect(reloadInvoices).toHaveBeenCalledTimes(1);
  });

  it('resumes the unconfirmed note without reading again', async () => {
    api.subscription.mockResolvedValue(FREE);
    await store().confirmPayment();

    const checkout: InstanceType<typeof BillingCheckoutStore> = recreated();

    expect(checkout.unconfirmed()).toBe(true);
    expect(checkout.confirming()).toBe(false);
    expect(api.subscription).toHaveBeenCalledTimes(3);
  });

  it('ends the wait when the shared store shows a paid plan, reloading the invoices once', async () => {
    api.subscription.mockResolvedValue(FREE);
    const checkout: InstanceType<typeof BillingCheckoutStore> = store();
    await checkout.confirmPayment();
    expect(checkout.unconfirmed()).toBe(true);
    reloadInvoices.mockClear();

    current.set(TEAM);
    TestBed.tick();

    expect(checkout.awaitingPayment()).toBe(false);
    expect(sessionStorage.getItem(PAYMENT_PENDING_STORAGE + 'org-nord')).toBeNull();
    expect(reloadInvoices).toHaveBeenCalledTimes(1);

    current.set({ ...TEAM, seatsUsed: 4 });
    TestBed.tick();
    expect(reloadInvoices).toHaveBeenCalledTimes(1);
  });

  it('keeps the wait of an organization left during its confirmation for its next visit', () => {
    api.subscription.mockReturnValueOnce(
      new Promise<OrganizationSubscription>((): void => undefined),
    );
    const checkout: InstanceType<typeof BillingCheckoutStore> = store();
    void checkout.confirmPayment();

    shown.set(organization('org-lumen'));
    TestBed.tick();

    expect(checkout.awaitingPayment()).toBe(false);
    expect(sessionStorage.getItem(PAYMENT_PENDING_STORAGE + 'org-nord')).not.toBeNull();
    expect(sessionStorage.getItem(PAYMENT_PENDING_STORAGE + 'org-lumen')).toBeNull();
  });
});
