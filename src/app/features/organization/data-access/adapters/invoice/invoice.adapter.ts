import type { InvoicePage, OrganizationInvoice } from '../../../models/invoice/invoice.interface';

/**
 * Interface InvoiceDto
 *
 * @description
 * The fields of `BillingInvoice` (`billing-payments.yaml`) the adapter reads. api-client 1.3.0
 * does not export the generated type, so the answer of `listBillingInvoices` is checked against
 * this shape where it is passed in.
 */
export interface InvoiceDto {
  // #region Properties
  /**
   * Property number
   *
   * @description
   * Issued invoice number.
   *
   * @type {string}
   * @readonly
   */
  readonly number: string;

  /**
   * Property periodStart
   *
   * @description
   * Start of the invoiced period in UTC.
   *
   * @type {string}
   * @readonly
   */
  readonly periodStart: string;

  /**
   * Property periodEnd
   *
   * @description
   * End of the invoiced period in UTC.
   *
   * @type {string}
   * @readonly
   */
  readonly periodEnd: string;

  /**
   * Property totalMinorUnits
   *
   * @description
   * Total in the currency's smallest unit.
   *
   * @type {number}
   * @readonly
   */
  readonly totalMinorUnits: number;

  /**
   * Property currency
   *
   * @description
   * ISO 4217 currency code.
   *
   * @type {string}
   * @readonly
   */
  readonly currency: string;

  /**
   * Property status
   *
   * @description
   * Status key (`open`, `paid`, `uncollectible`, `void`, or a later key).
   *
   * @type {string}
   * @readonly
   */
  readonly status: string;

  /**
   * Property pdfUrl
   *
   * @description
   * Download address from Stripe, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly pdfUrl: string | null;
  // #endregion
}

/**
 * Interface InvoicePageDto
 *
 * @description
 * The fields of `BillingInvoicePage` the adapter reads.
 */
export interface InvoicePageDto {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * Invoices of the page.
   *
   * @type {readonly InvoiceDto[]}
   * @readonly
   */
  readonly items: readonly InvoiceDto[];

  /**
   * Property nextCursor
   *
   * @description
   * Cursor of the next page, or null on the last page.
   *
   * @type {string | null}
   * @readonly
   */
  readonly nextCursor: string | null;
  // #endregion
}

/**
 * Function secureUrl
 *
 * @description
 * Keeps an address only when it is an absolute HTTPS URL, as the contract promises, so a link
 * of the page can never run a script or leave for a plain HTTP page.
 *
 * @param {string | null} value - Address from the API.
 * @returns {string | null} The address, or null when it is missing or not HTTPS.
 */
export function secureUrl(value: string | null): string | null {
  if (value === null) return null;
  const url: URL | null = URL.parse(value);
  return url?.protocol === 'https:' ? url.href : null;
}

/**
 * Function toOrganizationInvoice
 *
 * @description
 * Maps an invoice of the API, keeping its PDF address only when it is HTTPS.
 *
 * @param {InvoiceDto} invoice - Invoice of `GET /v1/billing/invoices`.
 * @returns {OrganizationInvoice} Display model of the invoice.
 */
export function toOrganizationInvoice(invoice: InvoiceDto): OrganizationInvoice {
  return {
    number: invoice.number,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    totalMinorUnits: invoice.totalMinorUnits,
    currency: invoice.currency,
    status: invoice.status,
    pdfUrl: secureUrl(invoice.pdfUrl),
  };
}

/**
 * Function toInvoicePage
 *
 * @description
 * Maps a page of invoices, newest first as the API sends them.
 *
 * @param {InvoicePageDto} page - Answer of `GET /v1/billing/invoices`.
 * @returns {InvoicePage} Display model of the page.
 */
export function toInvoicePage(page: InvoicePageDto): InvoicePage {
  return { items: page.items.map(toOrganizationInvoice), nextCursor: page.nextCursor };
}
