import { describe, expect, it } from 'vitest';

import { invoiceAmount, invoicePeriod } from './invoice-format.util';
import type { OrganizationInvoice } from './invoice.interface';

/**
 * Constant NOVEMBER
 *
 * @description
 * Atelier Nord's November seat adjustment.
 *
 * @type {OrganizationInvoice}
 */
const NOVEMBER: OrganizationInvoice = {
  number: 'FAC-2026-0011',
  periodStart: '2026-11-01T00:00:00Z',
  periodEnd: '2026-12-01T00:00:00Z',
  totalMinorUnits: 125_000,
  currency: 'EUR',
  status: 'paid',
  pdfUrl: null,
};

describe('invoicePeriod', () => {
  it('names one month when the period ends at the start of the next one', () => {
    expect(invoicePeriod(NOVEMBER, 'en')).toBe('November 2026');
  });

  it('names the first and the last month of a yearly period', () => {
    expect(
      invoicePeriod(
        { ...NOVEMBER, periodStart: '2026-03-01T00:00:00Z', periodEnd: '2027-03-01T00:00:00Z' },
        'en',
      ),
    ).toBe('March 2026 – February 2027');
  });

  it('capitalizes the period in a locale that writes months in lower case', () => {
    expect(
      invoicePeriod(
        { ...NOVEMBER, periodStart: '2026-03-01T00:00:00Z', periodEnd: '2027-03-01T00:00:00Z' },
        'fr',
      ),
    ).toBe('Mars 2026 – février 2027');
  });

  it('names the start month of an invoice without a period', () => {
    expect(invoicePeriod({ ...NOVEMBER, periodEnd: NOVEMBER.periodStart }, 'en')).toBe(
      'November 2026',
    );
  });
});

describe('invoiceAmount', () => {
  it('writes the total with the currency decimals', () => {
    expect(invoiceAmount(NOVEMBER, 'en')).toBe('€1,250.00');
  });

  it('writes a currency without decimals', () => {
    expect(invoiceAmount({ ...NOVEMBER, currency: 'JPY', totalMinorUnits: 1250 }, 'en')).toBe(
      '¥1,250',
    );
  });
});
