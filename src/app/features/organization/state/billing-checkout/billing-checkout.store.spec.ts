import { HttpErrorResponse } from '@angular/common/http';
import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { OrganizationSwitchPendingError } from '@core/api';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceOrganization,
} from '@features/workspace/ports/workspace-context';

import { BillingApi } from '../../data-access/services/billing-api/billing-api.service';
import { BillingCheckoutStore, type CheckoutOutcome } from './billing-checkout.store';
import { CHECKOUT_REDIRECT } from './checkout-redirect.token';

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
  let api: { checkout: Mock };
  let redirect: Mock;
  let shown: WritableSignal<WorkspaceOrganization>;

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
        { provide: WORKSPACE_CONTEXT, useValue: { organization: shown } },
      ],
    });
    return TestBed.inject(BillingCheckoutStore);
  }

  beforeEach(() => {
    api = { checkout: vi.fn(() => Promise.resolve(CHECKOUT_URL)) };
    redirect = vi.fn();
    shown = signal(organization('org-nord'));
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
});
