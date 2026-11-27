import { inject, Service } from '@angular/core';
import { type BillingSubscription, BillingService } from '@cadenway/api-client';
import { firstValueFrom, fromEvent, type Observable, takeUntil } from 'rxjs';

import type { InvoicePage } from '../../../models/invoice/invoice.interface';
import type { OrganizationSubscription } from '../../../models/organization-subscription/organization-subscription.interface';
import {
  type InvoicePageDto,
  secureUrl,
  toInvoicePage,
} from '../../adapters/invoice/invoice.adapter';
import { toOrganizationSubscription } from '../../adapters/subscription/subscription.adapter';

/**
 * Interface CheckoutSessionDto
 *
 * @description
 * The field of `BillingCheckoutSession` (`billing-payments.yaml`) the service reads; api-client
 * 1.3.0 does not export the generated type.
 */
interface CheckoutSessionDto {
  // #region Properties
  /**
   * Property url
   *
   * @description
   * Temporary Stripe Checkout address.
   *
   * @type {string}
   * @readonly
   */
  readonly url: string;
  // #endregion
}

/**
 * Function abortable
 *
 * @description
 * Reads the first value of a request, given up when the signal aborts.
 *
 * @template T
 * @param {Observable<T>} source - Request of the generated client.
 * @param {AbortSignal} [signal] - Abort signal of the resource.
 * @returns {Promise<T>} The answer.
 */
function abortable<T>(source: Observable<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  return firstValueFrom(signal ? source.pipe(takeUntil(fromEvent(signal, 'abort'))) : source);
}

/**
 * Service BillingApi
 *
 * @description
 * The organization feature's access to Billing, mapped to display models. Every operation answers
 * an owner only (others get `403`) and carries the workspace organization pin.
 */
@Service()
export class BillingApi {
  // #region Properties
  /**
   * Property billing
   *
   * @description
   * Generated billing operations.
   *
   * @type {BillingService}
   * @readonly
   */
  private readonly billing: BillingService = inject(BillingService);
  // #endregion

  // #region Methods
  /**
   * Method subscription
   *
   * @description
   * Reads the current organization's plan and usage. Only an owner may read it; others get `403`.
   *
   * @returns {Promise<OrganizationSubscription>} The plan and usage.
   */
  public async subscription(): Promise<OrganizationSubscription> {
    const subscription: BillingSubscription = await firstValueFrom(
      this.billing.getBillingSubscription(),
    );
    return toOrganizationSubscription(subscription);
  }

  /**
   * Method invoices
   *
   * @description
   * Reads one page of the organization's issued invoices, newest first. An organization that
   * never paid has none. Rejects with `400 billing.invalid-cursor` for a cursor of another
   * listing.
   *
   * @param {string | null} cursor - Cursor of the page, null for the first.
   * @param {number} limit - Page size (1 to 100).
   * @param {AbortSignal} [signal] - Abort signal of the resource.
   * @returns {Promise<InvoicePage>} The page.
   */
  public async invoices(
    cursor: string | null,
    limit: number,
    signal?: AbortSignal,
  ): Promise<InvoicePage> {
    const page: InvoicePageDto = await abortable(
      this.billing.listBillingInvoices(cursor === null ? { limit } : { cursor, limit }),
      signal,
    );
    return toInvoicePage(page);
  }

  /**
   * Method checkout
   *
   * @description
   * Starts Stripe Checkout of the Team plan, an upgrade from Free. The same key replays the
   * original answer for 24 hours, so a retry after an unknown outcome sends the key again. Rejects
   * with `409 billing.subscription-active` once a paid plan exists, `409
   * billing.checkout-in-progress` while another Checkout is pending, and `409
   * idempotency.request-in-progress` while the same request still runs.
   *
   * @param {string} idempotencyKey - Key of this checkout (`Idempotency-Key`).
   * @returns {Promise<string>} The HTTPS address of the hosted Checkout.
   * @throws {Error} When the answer is not an HTTPS address.
   */
  public async checkout(idempotencyKey: string): Promise<string> {
    const session: CheckoutSessionDto = await firstValueFrom(
      this.billing.startBillingCheckout(
        { plan: 'team' },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      ),
    );
    const url: string | null = secureUrl(session.url);
    if (url === null) throw new Error('Billing answered a Checkout address that is not HTTPS.');
    return url;
  }
  // #endregion
}
