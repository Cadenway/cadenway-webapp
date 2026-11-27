import type { OrganizationInvoice } from './invoice.interface';

/**
 * Function capitalized
 *
 * @description
 * Upper-cases the first letter, as the mockup writes a period (`Mars 2026 – février 2027`).
 *
 * @param {string} text - Text to capitalize.
 * @param {string} locale - Locale of the text.
 * @returns {string} The text with its first letter in upper case.
 */
function capitalized(text: string, locale: string): string {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

/**
 * Function invoicePeriod
 *
 * @description
 * Names the invoiced period by its months in UTC: one month (`November 2026`) when the period
 * starts and ends in it, else the first and the last month (`March 2026 – February 2027`). The
 * contract's end is the start of the next period, so the last month is the one before that
 * instant; an end at or before the start names the start's month.
 *
 * @param {OrganizationInvoice} invoice - The invoice.
 * @param {string} locale - Locale of the text.
 * @returns {string} The period.
 */
export function invoicePeriod(invoice: OrganizationInvoice, locale: string): string {
  const month: Intl.DateTimeFormat = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const start: Date = new Date(invoice.periodStart);
  const end: Date = new Date(invoice.periodEnd);
  const last: Date = end.getTime() > start.getTime() ? new Date(end.getTime() - 1) : start;
  const sameMonth: boolean =
    start.getUTCFullYear() === last.getUTCFullYear() && start.getUTCMonth() === last.getUTCMonth();
  const text: string = sameMonth
    ? month.format(start)
    : `${month.format(start)} – ${month.format(last)}`;
  return capitalized(text, locale);
}

/**
 * Function invoiceAmount
 *
 * @description
 * Writes the total in its currency, with the currency's own number of decimals (`1 250,00 €`).
 *
 * @param {OrganizationInvoice} invoice - The invoice.
 * @param {string} locale - Locale of the text.
 * @returns {string} The amount.
 */
export function invoiceAmount(invoice: OrganizationInvoice, locale: string): string {
  const format: Intl.NumberFormat = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: invoice.currency,
  });
  const decimals: number = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(invoice.totalMinorUnits / 10 ** decimals);
}
