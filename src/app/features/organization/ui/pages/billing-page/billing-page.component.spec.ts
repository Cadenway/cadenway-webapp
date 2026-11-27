import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withErrorBoundaries } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { RuntimeConfigStore } from '@core/config';
import { RouteErrorBoundary } from '@features/errors/ui/components/route-error-boundary/route-error-boundary.component';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceOrganization,
} from '@features/workspace/ports/workspace-context';

import { BillingApi } from '../../../data-access/services/billing-api/billing-api.service';
import type { InvoicePage, OrganizationInvoice } from '../../../models/invoice/invoice.interface';
import type { OrganizationSubscription } from '../../../models/organization-subscription/organization-subscription.interface';
import { CHECKOUT_CONFIRM_DELAYS_MS } from '../../../state/billing-checkout/checkout-confirm-delays.token';
import { CHECKOUT_KEY_STORAGE } from '../../../state/billing-checkout/checkout-key.storage';
import { CHECKOUT_REDIRECT } from '../../../state/billing-checkout/checkout-redirect.token';
import { PAYMENT_PENDING_STORAGE } from '../../../state/billing-checkout/payment-pending.storage';
import { SubscriptionStore } from '../../../state/subscription/subscription.store';
import { BillingPage } from './billing-page.component';

/**
 * Constant TEAM
 *
 * @description
 * Atelier Nord on the Team plan, 18 of 25 seats.
 *
 * @type {OrganizationSubscription}
 */
const TEAM: OrganizationSubscription = {
  plan: 'team',
  seatsUsed: 18,
  seatsLimit: 25,
  storageUsedBytes: 92_400_000_000,
  storageLimitBytes: 100_000_000_000,
  guestCount: 4,
};

/**
 * Constant FREE
 *
 * @description
 * Atelier Nord on the Free plan, 3 of 5 seats.
 *
 * @type {OrganizationSubscription}
 */
const FREE: OrganizationSubscription = {
  plan: 'free',
  seatsUsed: 3,
  seatsLimit: 5,
  storageUsedBytes: 120_000_000,
  storageLimitBytes: 2_000_000_000,
  guestCount: 1,
};

/**
 * Constant CHECKOUT_URL
 *
 * @description
 * A Stripe test Checkout address; the spec's redirect never opens it.
 *
 * @type {string}
 */
const CHECKOUT_URL: string = 'https://checkout.stripe.com/c/pay/cs_test_nord';

/**
 * Function invoice
 *
 * @description
 * A paid invoice of Atelier Nord.
 *
 * @param {string} number - Invoice number.
 * @param {string | null} pdfUrl - PDF address.
 * @returns {OrganizationInvoice} The invoice.
 */
function invoice(number: string, pdfUrl: string | null = null): OrganizationInvoice {
  return {
    number,
    periodStart: '2026-11-01T00:00:00Z',
    periodEnd: '2026-12-01T00:00:00Z',
    totalMinorUnits: 125_000,
    currency: 'EUR',
    status: 'paid',
    pdfUrl,
  };
}

/**
 * Constant FIRST_PAGE
 *
 * @description
 * Atelier Nord's newest invoices, with a next page.
 *
 * @type {InvoicePage}
 */
const FIRST_PAGE: InvoicePage = {
  items: [
    invoice('FAC-2026-0011', 'https://pay.stripe.com/invoice/fac-2026-0011/pdf'),
    { ...invoice('FAC-2026-0010'), status: 'open' },
  ],
  nextCursor: 'c2',
};

/**
 * Component OtherSection
 *
 * @description
 * Another settings section to leave the page for.
 */
@Component({ selector: 'cw-other-section', template: '<p>Members</p>' })
class OtherSection {}

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
 * A workspace organization of an owner.
 *
 * @param {string} id - Organization id.
 * @param {string} name - Organization name.
 * @returns {WorkspaceOrganization} The organization.
 */
function organization(id: string, name: string): WorkspaceOrganization {
  return { id, slug: id, name, initials: 'AN', role: 'owner', plan: 'team' };
}

/**
 * Function byTestId
 *
 * @description
 * An element of the page by its test id.
 *
 * @param {RouterTestingHarness} harness - The harness.
 * @param {string} id - Test id.
 * @returns {HTMLElement | null} The element, when rendered.
 */
function byTestId(harness: RouterTestingHarness, id: string): HTMLElement | null {
  harness.detectChanges();
  return harness.routeNativeElement?.querySelector<HTMLElement>(`[data-testid="${id}"]`) ?? null;
}

/**
 * Function rows
 *
 * @description
 * The invoice numbers shown.
 *
 * @param {RouterTestingHarness} harness - The harness.
 * @returns {string[]} The numbers.
 */
function rows(harness: RouterTestingHarness): string[] {
  harness.detectChanges();
  return [
    ...(harness.routeNativeElement?.querySelectorAll('[data-testid="invoice-number"]') ?? []),
  ].map((cell: Element) => cell.textContent.trim());
}

/**
 * Function recordCheckout
 *
 * @description
 * Stores the key record a checkout leaves before the round trip to Stripe.
 *
 * @param {string} organizationId - Organization of the checkout.
 * @param {string} slug - Its slug.
 * @param {string} [userId] - Person who started it.
 */
function recordCheckout(
  organizationId: string,
  slug: string,
  userId: string = 'user-camille',
): void {
  sessionStorage.setItem(
    CHECKOUT_KEY_STORAGE,
    JSON.stringify({ organizationId, slug, userId, key: `key-${slug}`, createdAt: Date.now() }),
  );
}

/**
 * Function deferred
 *
 * @description
 * A promise and the function that resolves it.
 *
 * @template T
 * @returns {{ promise: Promise<T>; resolve: (value: T) => void }} Both.
 */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = (): void => undefined;
  const promise: Promise<T> = new Promise<T>((done: (value: T) => void): void => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('BillingPage', () => {
  let api: { subscription: Mock; invoices: Mock; checkout: Mock };
  let toasts: { success: Mock; error: Mock; info: Mock; loading: Mock; dismiss: Mock };
  let redirect: Mock;
  let shown: WritableSignal<WorkspaceOrganization>;

  /**
   * Function open
   *
   * @description
   * Opens the billing section and waits for its content.
   *
   * @param {string} [url] - Address to open.
   * @returns {Promise<RouterTestingHarness>} The harness.
   */
  async function open(url: string = '/billing'): Promise<RouterTestingHarness> {
    const harness: RouterTestingHarness = await RouterTestingHarness.create(url);
    await expect.poll(() => byTestId(harness, 'plan-card') !== null).toBe(true);
    return harness;
  }

  beforeEach(() => {
    let toastId: number = 0;
    const nextId: () => string = (): string => `toast-${String((toastId += 1))}`;
    api = {
      subscription: vi.fn(() => Promise.resolve(TEAM)),
      invoices: vi.fn((cursor: string | null) =>
        Promise.resolve(
          cursor === null ? FIRST_PAGE : { items: [invoice('FAC-2025-0019')], nextCursor: null },
        ),
      ),
      checkout: vi.fn(() => Promise.resolve(CHECKOUT_URL)),
    };
    toasts = {
      success: vi.fn(nextId),
      error: vi.fn(nextId),
      info: vi.fn(nextId),
      loading: vi.fn(nextId),
      dismiss: vi.fn(),
    };
    redirect = vi.fn();
    shown = signal(organization('org-nord', 'Atelier Nord'));
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter(
          [
            { path: 'billing', component: BillingPage, runGuardsAndResolvers: 'always' },
            { path: 'members', component: OtherSection },
            { path: ':org/organization/billing', component: BillingPage },
          ],
          withErrorBoundaries({ defaultErrorComponent: RouteErrorBoundary }),
        ),
        SubscriptionStore,
        { provide: BillingApi, useValue: api },
        { provide: CwToastService, useValue: toasts },
        { provide: CHECKOUT_REDIRECT, useValue: redirect },
        { provide: CHECKOUT_CONFIRM_DELAYS_MS, useValue: [0, 0, 0] },
        {
          provide: RuntimeConfigStore,
          useValue: { config: () => ({ apiUrl: 'http://api.test' }) },
        },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: {
            organization: shown,
            role: () => 'owner',
            user: () => ({ id: 'user-camille' }),
          },
        },
      ],
    });
  });

  afterEach(() => {
    sessionStorage.clear();
    document.body.innerHTML = '';
  });

  it('shows the section skeleton until the plan and the first invoices arrive', async () => {
    const invoices: { promise: Promise<InvoicePage>; resolve: (page: InvoicePage) => void } =
      deferred<InvoicePage>();
    api.invoices.mockReturnValueOnce(invoices.promise);
    const harness: RouterTestingHarness = await RouterTestingHarness.create('/billing');

    const loading: HTMLElement | null = byTestId(harness, 'billing-skeleton');
    expect(loading?.getAttribute('role')).toBe('status');
    expect(loading?.getAttribute('aria-label')).toBe('Loading the section');
    expect(loading?.getAttribute('aria-busy')).toBe('true');

    invoices.resolve(FIRST_PAGE);
    await expect.poll(() => byTestId(harness, 'plan-card') !== null).toBe(true);
    expect(byTestId(harness, 'billing-skeleton')).toBeNull();
  });

  it('shows the plan, the seats and the invoices, and nothing the contract does not serve', async () => {
    const harness: RouterTestingHarness = await open();
    const page: HTMLElement | null = harness.routeNativeElement;

    expect(page?.querySelector('h1')?.textContent.trim()).toBe('Billing');
    expect(byTestId(harness, 'billing-description')?.textContent.trim()).toBe(
      'Plan, seats and invoices of the organization Atelier Nord. Visible to the owner only.',
    );
    expect(byTestId(harness, 'plan-title')?.textContent.trim()).toBe('Team plan');
    expect(byTestId(harness, 'plan-seats')?.textContent).toContain('18 / 25');
    expect(byTestId(harness, 'plan-seats')?.textContent).toContain('7 available');
    expect(byTestId(harness, 'plan-upgrade')).toBeNull();
    expect(page?.textContent).not.toContain('Manage seats');
    expect(page?.textContent).not.toContain('Payment method');
    expect(page?.textContent).not.toContain('Change plan');
    expect(rows(harness)).toEqual(['FAC-2026-0011', 'FAC-2026-0010']);
    expect(
      [...(page?.querySelectorAll('[data-testid="invoice-status"]') ?? [])].map((cell: Element) =>
        cell.textContent.trim(),
      ),
    ).toEqual(['Paid', 'Awaiting payment']);
    expect(byTestId(harness, 'invoice-period')?.textContent.trim()).toBe('November 2026');
    expect(byTestId(harness, 'invoice-amount')?.textContent.trim()).toBe('€1,250.00');
  });

  it('links the PDF of an invoice that has one', async () => {
    const harness: RouterTestingHarness = await open();

    const links: HTMLAnchorElement[] = [
      ...(harness.routeNativeElement?.querySelectorAll<HTMLAnchorElement>(
        '[data-testid="invoice-download"]',
      ) ?? []),
    ];
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('https://pay.stripe.com/invoice/fac-2026-0011/pdf');
    expect(links[0].getAttribute('aria-label')).toBe('Download invoice FAC-2026-0011 as PDF');
    expect(links[0].getAttribute('target')).toBe('_blank');
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('tells a completed empty history from a failed read', async () => {
    api.invoices.mockResolvedValueOnce({ items: [], nextCursor: null });
    const harness: RouterTestingHarness = await open();

    expect(byTestId(harness, 'invoices-empty')?.textContent).toContain('No invoices yet');
    expect(byTestId(harness, 'invoices-failed')).toBeNull();
    expect(harness.routeNativeElement?.querySelector('nav')).toBeNull();
  });

  it('retries a failed first invoices read through the route boundary', async () => {
    api.invoices.mockRejectedValueOnce(problem(503, 'billing.unavailable'));
    const harness: RouterTestingHarness = await RouterTestingHarness.create('/billing');

    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.textContent ?? '';
      })
      .toContain('Retry');
    expect(byTestId(harness, 'billing-skeleton')).toBeNull();
    const retry: HTMLButtonElement | undefined = [
      ...document.querySelectorAll<HTMLButtonElement>('button'),
    ].find((candidate: HTMLButtonElement) => candidate.textContent.trim() === 'Retry');
    retry?.click();

    await expect.poll(() => byTestId(harness, 'plan-card') !== null).toBe(true);
    expect(api.invoices).toHaveBeenCalledTimes(2);
  });

  it('shows a failed plan read in place and reads it again on Retry', async () => {
    api.subscription.mockRejectedValueOnce(problem(503, 'billing.unavailable'));
    const harness: RouterTestingHarness = await RouterTestingHarness.create('/billing');

    await expect.poll(() => byTestId(harness, 'plan-failed') !== null).toBe(true);
    expect(byTestId(harness, 'plan-failed')?.textContent).toContain(
      'The plan could not be loaded.',
    );
    expect(rows(harness)).toEqual(['FAC-2026-0011', 'FAC-2026-0010']);

    byTestId(harness, 'plan-retry')?.click();

    await expect.poll(() => byTestId(harness, 'plan-card') !== null).toBe(true);
    expect(api.subscription).toHaveBeenCalledTimes(2);
  });

  it('pages the invoices and shows a failed later page in place with Retry', async () => {
    const harness: RouterTestingHarness = await open();
    expect((byTestId(harness, 'invoices-previous') as HTMLButtonElement | null)?.disabled).toBe(
      true,
    );
    api.invoices.mockRejectedValueOnce(problem(503, 'billing.unavailable'));

    byTestId(harness, 'invoices-next')?.click();

    await expect.poll(() => byTestId(harness, 'invoices-failed') !== null).toBe(true);
    expect(byTestId(harness, 'plan-card')).not.toBeNull();
    expect(api.invoices).toHaveBeenLastCalledWith('c2', 10, expect.any(AbortSignal));

    byTestId(harness, 'invoices-retry')?.click();

    await expect.poll(() => rows(harness)).toEqual(['FAC-2025-0019']);
    expect(api.invoices).toHaveBeenCalledTimes(3);
  });

  it('opens the Team checkout from the Free plan', async () => {
    api.subscription.mockResolvedValue(FREE);
    const harness: RouterTestingHarness = await open();
    expect(byTestId(harness, 'plan-title')?.textContent.trim()).toBe('Free plan');
    expect(byTestId(harness, 'plan-seats')?.textContent).toContain('2 available');
    const upgrade: HTMLButtonElement | null = byTestId(
      harness,
      'plan-upgrade',
    ) as HTMLButtonElement | null;
    expect(upgrade?.textContent.trim()).toBe('Upgrade to the Team plan');

    upgrade?.click();

    await vi.waitFor(() => {
      expect(redirect).toHaveBeenCalledWith(CHECKOUT_URL);
    });
    expect(api.checkout).toHaveBeenCalledTimes(1);
    expect(toasts.loading).toHaveBeenCalledWith('Redirecting to the payment provider…');
  });

  it('never opens a checkout for an organization left meanwhile', async () => {
    api.subscription.mockResolvedValue(FREE);
    const answer: { promise: Promise<string>; resolve: (url: string) => void } = deferred<string>();
    api.checkout.mockReturnValueOnce(answer.promise);
    const harness: RouterTestingHarness = await open();
    byTestId(harness, 'plan-upgrade')?.click();
    await vi.waitFor(() => {
      expect(api.checkout).toHaveBeenCalledTimes(1);
    });

    shown.set(organization('org-lumen', 'Lumen'));
    harness.detectChanges();
    answer.resolve(CHECKOUT_URL);
    await harness.fixture.whenStable();

    expect(redirect).not.toHaveBeenCalled();
    expect(toasts.loading).not.toHaveBeenCalled();
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('reads the plan again when the organization already pays', async () => {
    api.subscription.mockResolvedValueOnce(FREE).mockResolvedValue(TEAM);
    api.checkout.mockRejectedValueOnce(problem(409, 'billing.subscription-active'));
    const harness: RouterTestingHarness = await open();

    byTestId(harness, 'plan-upgrade')?.click();

    await expect.poll(() => byTestId(harness, 'plan-title')?.textContent.trim()).toBe('Team plan');
    expect(toasts.info).toHaveBeenCalledWith('The organization already has a paid plan', {
      description: 'Its current plan is shown.',
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('toasts a refused checkout and lets the owner try again', async () => {
    api.subscription.mockResolvedValue(FREE);
    api.checkout.mockRejectedValueOnce(problem(503, 'billing.unavailable'));
    const harness: RouterTestingHarness = await open();

    byTestId(harness, 'plan-upgrade')?.click();

    await vi.waitFor(() => {
      expect(toasts.error).toHaveBeenCalledWith('The payment page could not be opened', {
        description: 'Try again in a moment.',
      });
    });
    expect((byTestId(harness, 'plan-upgrade') as HTMLButtonElement | null)?.disabled).toBe(false);
  });

  it.each([
    ['success', 'success', 'Payment complete'],
    ['cancel', 'info', 'Payment cancelled'],
  ] as const)(
    'toasts the return from Stripe (%s) once and leaves the parameter',
    async (value: string, kind: 'success' | 'info', title: string) => {
      recordCheckout('org-nord', 'org-nord');
      const harness: RouterTestingHarness = await open(`/billing?checkout=${value}`);

      await vi.waitFor(() => {
        harness.detectChanges();
        expect(TestBed.inject(Router).url).toBe('/billing');
      });
      expect(toasts[kind]).toHaveBeenCalledTimes(1);
      expect(toasts[kind].mock.calls[0][0]).toBe(title);
    },
  );

  it('reads the plan again after a successful payment until it is no longer Free', async () => {
    recordCheckout('org-nord', 'org-nord');
    const confirmation: {
      promise: Promise<OrganizationSubscription>;
      resolve: (value: OrganizationSubscription) => void;
    } = deferred<OrganizationSubscription>();
    api.subscription
      .mockResolvedValueOnce(FREE)
      .mockResolvedValueOnce(FREE)
      .mockReturnValueOnce(confirmation.promise);
    const harness: RouterTestingHarness = await open('/billing?checkout=success');

    expect(byTestId(harness, 'plan-title')?.textContent.trim()).toBe('Free plan');
    expect(byTestId(harness, 'plan-upgrade')).toBeNull();
    await expect.poll(() => byTestId(harness, 'payment-confirming') !== null).toBe(true);
    expect(sessionStorage.getItem(CHECKOUT_KEY_STORAGE)).toBeNull();

    confirmation.resolve(TEAM);

    await expect.poll(() => byTestId(harness, 'plan-title')?.textContent.trim()).toBe('Team plan');
    expect(byTestId(harness, 'payment-confirming')).toBeNull();
    expect(byTestId(harness, 'payment-unconfirmed')).toBeNull();
    expect(api.subscription).toHaveBeenCalledTimes(3);
  });

  it('notes a payment still unconfirmed after the last read, with Retry', async () => {
    recordCheckout('org-nord', 'org-nord');
    api.subscription.mockResolvedValue(FREE);
    const harness: RouterTestingHarness = await open('/billing?checkout=success');

    await expect.poll(() => byTestId(harness, 'payment-unconfirmed') !== null).toBe(true);
    expect(byTestId(harness, 'payment-unconfirmed')?.textContent).toContain(
      'The payment is not confirmed yet',
    );
    expect(byTestId(harness, 'payment-unconfirmed')?.textContent).toContain(
      'The plan still shows Free. The confirmation can take a few minutes.',
    );
    expect(byTestId(harness, 'plan-upgrade')).toBeNull();
    expect(api.subscription).toHaveBeenCalledTimes(4);

    api.subscription.mockResolvedValue(TEAM);
    byTestId(harness, 'payment-unconfirmed-retry')?.click();

    await expect.poll(() => byTestId(harness, 'plan-title')?.textContent.trim()).toBe('Team plan');
    expect(byTestId(harness, 'payment-unconfirmed')).toBeNull();
    expect(api.subscription).toHaveBeenCalledTimes(5);
  });

  it('sends the return of another organization of the person to its billing, confirming nothing here', async () => {
    api.subscription.mockResolvedValue(FREE);
    recordCheckout('org-lumen', 'lumen');
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/billing?checkout=success',
    );

    await vi.waitFor(() => {
      harness.detectChanges();
      expect(TestBed.inject(Router).url).toBe('/lumen/organization/billing?checkout=success');
    });
    expect(sessionStorage.getItem(CHECKOUT_KEY_STORAGE)).toContain('org-lumen');
    expect(sessionStorage.getItem(PAYMENT_PENDING_STORAGE + 'org-nord')).toBeNull();
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it.each([
    ['no checkout record', (): void => undefined],
    [
      'the record of another person',
      (): void => {
        recordCheckout('org-lumen', 'lumen', 'user-hugo');
      },
    ],
  ])(
    'tells that the payment was for another organization with %s',
    async (_case: string, arrange: () => void) => {
      arrange();
      const before: string | null = sessionStorage.getItem(CHECKOUT_KEY_STORAGE);
      api.subscription.mockResolvedValue(FREE);
      const harness: RouterTestingHarness = await open('/billing?checkout=success');

      await vi.waitFor(() => {
        harness.detectChanges();
        expect(TestBed.inject(Router).url).toBe('/billing');
      });
      expect(toasts.info).toHaveBeenCalledWith('This payment was for another organization', {
        description: "Its plan shows in that organization's billing.",
      });
      expect(toasts.success).not.toHaveBeenCalled();
      expect(byTestId(harness, 'payment-confirming')).toBeNull();
      expect(byTestId(harness, 'plan-upgrade')).not.toBeNull();
      expect(api.subscription).toHaveBeenCalledTimes(1);
      expect(sessionStorage.getItem(CHECKOUT_KEY_STORAGE)).toBe(before);
    },
  );

  it('resumes the confirmation of a payment left awaiting when the page is opened again', async () => {
    sessionStorage.setItem(
      PAYMENT_PENDING_STORAGE + 'org-nord',
      JSON.stringify({ since: Date.now(), unconfirmed: false }),
    );
    const confirmation: {
      promise: Promise<OrganizationSubscription>;
      resolve: (value: OrganizationSubscription) => void;
    } = deferred<OrganizationSubscription>();
    api.subscription.mockResolvedValueOnce(FREE).mockReturnValueOnce(confirmation.promise);
    const harness: RouterTestingHarness = await open();

    expect(byTestId(harness, 'plan-upgrade')).toBeNull();
    await expect.poll(() => byTestId(harness, 'payment-confirming') !== null).toBe(true);
    expect(api.invoices).toHaveBeenCalledTimes(1);

    confirmation.resolve(TEAM);

    await expect.poll(() => byTestId(harness, 'plan-title')?.textContent.trim()).toBe('Team plan');
    expect(sessionStorage.getItem(PAYMENT_PENDING_STORAGE + 'org-nord')).toBeNull();
    await vi.waitFor(() => {
      expect(api.invoices).toHaveBeenCalledTimes(2);
    });
  });

  it('shows a payment left unconfirmed with Retry and no upgrade when the page is opened again', async () => {
    api.subscription.mockResolvedValue(FREE);
    sessionStorage.setItem(
      PAYMENT_PENDING_STORAGE + 'org-nord',
      JSON.stringify({ since: Date.now(), unconfirmed: true }),
    );
    const harness: RouterTestingHarness = await open();

    expect(byTestId(harness, 'payment-unconfirmed')).not.toBeNull();
    expect(byTestId(harness, 'plan-upgrade')).toBeNull();
    expect(api.subscription).toHaveBeenCalledTimes(1);
  });

  it('offers the upgrade again once a payment awaited for an hour', async () => {
    api.subscription.mockResolvedValue(FREE);
    sessionStorage.setItem(
      PAYMENT_PENDING_STORAGE + 'org-nord',
      JSON.stringify({ since: Date.now() - 60 * 60 * 1000, unconfirmed: true }),
    );
    const harness: RouterTestingHarness = await open();

    expect(byTestId(harness, 'plan-upgrade')).not.toBeNull();
    expect(byTestId(harness, 'payment-unconfirmed')).toBeNull();
    expect(sessionStorage.getItem(PAYMENT_PENDING_STORAGE + 'org-nord')).toBeNull();
  });

  it('keeps the pagination and moves the focus to the table caption on a page change', async () => {
    const harness: RouterTestingHarness = await open();
    byTestId(harness, 'invoices-next')?.click();
    await expect.poll(() => rows(harness)).toEqual(['FAC-2025-0019']);
    const page: { promise: Promise<InvoicePage>; resolve: (value: InvoicePage) => void } =
      deferred<InvoicePage>();
    api.invoices.mockReturnValueOnce(page.promise);
    const previous: HTMLButtonElement | null = byTestId(
      harness,
      'invoices-previous',
    ) as HTMLButtonElement | null;
    previous?.focus();

    previous?.click();
    harness.detectChanges();

    expect(byTestId(harness, 'invoices-previous')).not.toBeNull();
    expect(document.activeElement).toBe(byTestId(harness, 'invoices-caption'));
    expect(byTestId(harness, 'invoices-caption')?.textContent.trim()).toBe('Invoices');

    page.resolve(FIRST_PAGE);
    await expect.poll(() => rows(harness)).toEqual(['FAC-2026-0011', 'FAC-2026-0010']);
    expect(document.activeElement).toBe(byTestId(harness, 'invoices-caption'));
  });

  it('dismisses its toasts once left', async () => {
    const harness: RouterTestingHarness = await open('/billing?checkout=cancel');
    await vi.waitFor(() => {
      expect(toasts.info).toHaveBeenCalledTimes(1);
    });

    await harness.navigateByUrl('/members');

    expect(toasts.dismiss).toHaveBeenCalledWith('toast-1');
  });

  it('shows the skeleton and the next organization after a switch', async () => {
    const harness: RouterTestingHarness = await open();
    const next: { promise: Promise<InvoicePage>; resolve: (page: InvoicePage) => void } =
      deferred<InvoicePage>();
    api.invoices.mockReturnValueOnce(next.promise);

    shown.set(organization('org-lumen', 'Lumen'));

    await expect.poll(() => byTestId(harness, 'billing-skeleton') !== null).toBe(true);
    next.resolve({ items: [invoice('LUM-2026-0001')], nextCursor: null });
    await expect.poll(() => rows(harness)).toEqual(['LUM-2026-0001']);
    expect(byTestId(harness, 'billing-description')?.textContent).toContain('Lumen');
  });
});
