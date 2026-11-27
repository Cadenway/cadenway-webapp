import { describe, expect, it } from 'vitest';

import type { InvoicePage, OrganizationInvoice } from '../../../models/invoice/invoice.interface';
import { type InvoiceDto, secureUrl, toInvoicePage } from './invoice.adapter';

/**
 * Constant NOVEMBER
 *
 * @description
 * Atelier Nord's November seat adjustment, as the API sends it.
 *
 * @type {InvoiceDto}
 */
const NOVEMBER: InvoiceDto = {
  number: 'FAC-2026-0011',
  periodStart: '2026-11-01T00:00:00Z',
  periodEnd: '2026-12-01T00:00:00Z',
  totalMinorUnits: 125_000,
  currency: 'EUR',
  status: 'paid',
  pdfUrl: 'https://pay.stripe.com/invoice/fac-2026-0011/pdf',
};

describe('toInvoicePage', () => {
  it('keeps the invoices and the next cursor', () => {
    expect(toInvoicePage({ items: [NOVEMBER], nextCursor: 'c2' })).toEqual({
      items: [NOVEMBER],
      nextCursor: 'c2',
    });
  });

  it('drops a PDF address that is not HTTPS', () => {
    const page: InvoicePage = toInvoicePage({
      items: [
        { ...NOVEMBER, pdfUrl: 'javascript:alert(1)' },
        { ...NOVEMBER, pdfUrl: 'http://pay.stripe.com/x' },
        { ...NOVEMBER, pdfUrl: null },
      ],
      nextCursor: null,
    });

    expect(page.items.map((invoice: OrganizationInvoice) => invoice.pdfUrl)).toEqual([
      null,
      null,
      null,
    ]);
  });

  it('accepts only absolute HTTPS addresses', () => {
    expect(secureUrl('https://checkout.stripe.com/c/pay/cs_test')).toBe(
      'https://checkout.stripe.com/c/pay/cs_test',
    );
    expect(secureUrl('/relative')).toBeNull();
    expect(secureUrl('not a url')).toBeNull();
  });
});
