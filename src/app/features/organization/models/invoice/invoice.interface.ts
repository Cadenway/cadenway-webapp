/**
 * Type KnownInvoiceStatus
 *
 * @description
 * Invoice statuses Billing reports today. The contract may add others (`x-extensible-enum`).
 *
 * @type {'open' | 'paid' | 'uncollectible' | 'void'}
 */
export type KnownInvoiceStatus = 'open' | 'paid' | 'uncollectible' | 'void';

/**
 * Interface OrganizationInvoice
 *
 * @description
 * An issued invoice of the current organization, as the `Invoices` table shows it.
 */
export interface OrganizationInvoice {
  // #region Properties
  /**
   * Property number
   *
   * @description
   * Invoice number shown to the organization (`FAC-2026-0011`).
   *
   * @type {string}
   * @readonly
   */
  readonly number: string;

  /**
   * Property periodStart
   *
   * @description
   * Start of the invoiced period, an ISO 8601 instant in UTC.
   *
   * @type {string}
   * @readonly
   */
  readonly periodStart: string;

  /**
   * Property periodEnd
   *
   * @description
   * End of the invoiced period, an ISO 8601 instant in UTC (the start of the next period).
   *
   * @type {string}
   * @readonly
   */
  readonly periodEnd: string;

  /**
   * Property totalMinorUnits
   *
   * @description
   * Total, taxes and discounts included, in the currency's smallest unit.
   *
   * @type {number}
   * @readonly
   */
  readonly totalMinorUnits: number;

  /**
   * Property currency
   *
   * @description
   * ISO 4217 currency code (`EUR`).
   *
   * @type {string}
   * @readonly
   */
  readonly currency: string;

  /**
   * Property status
   *
   * @description
   * Status key: a known one, or a later key the table shows as it is.
   *
   * @type {string}
   * @readonly
   */
  readonly status: string;

  /**
   * Property pdfUrl
   *
   * @description
   * HTTPS address of the PDF, or null while Stripe has none.
   *
   * @type {string | null}
   * @readonly
   */
  readonly pdfUrl: string | null;
  // #endregion
}

/**
 * Interface InvoicePage
 *
 * @description
 * One page of the organization's invoices, newest first.
 */
export interface InvoicePage {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * Invoices of the page.
   *
   * @type {readonly OrganizationInvoice[]}
   * @readonly
   */
  readonly items: readonly OrganizationInvoice[];

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
