import { TestBed } from '@angular/core/testing';
import { BillingService } from '@cadenway/api-client';
import { NEVER, of } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { BillingApi } from './billing-api.service';

describe('BillingApi', () => {
  let billing: { listBillingInvoices: Mock; startBillingCheckout: Mock };

  beforeEach(() => {
    billing = {
      listBillingInvoices: vi.fn(() => of({ items: [], nextCursor: null })),
      startBillingCheckout: vi.fn(() =>
        of({ url: 'https://checkout.stripe.com/c/pay/cs_test_nord' }),
      ),
    };
    TestBed.configureTestingModule({ providers: [{ provide: BillingService, useValue: billing }] });
  });

  it('reads the first page without a cursor and a later page with its cursor', async () => {
    const api: BillingApi = TestBed.inject(BillingApi);

    await api.invoices(null, 10);
    await api.invoices('c2', 10);

    expect(billing.listBillingInvoices).toHaveBeenNthCalledWith(1, { limit: 10 });
    expect(billing.listBillingInvoices).toHaveBeenNthCalledWith(2, { cursor: 'c2', limit: 10 });
  });

  it('gives a read up when its signal aborts', async () => {
    billing.listBillingInvoices.mockReturnValue(NEVER);
    const controller: AbortController = new AbortController();
    const read: Promise<unknown> = TestBed.inject(BillingApi).invoices(null, 10, controller.signal);

    controller.abort();

    await expect(read).rejects.toThrow();
  });

  it('starts the Team checkout with its idempotency key', async () => {
    const url: string = await TestBed.inject(BillingApi).checkout('key-1');

    expect(url).toBe('https://checkout.stripe.com/c/pay/cs_test_nord');
    expect(billing.startBillingCheckout).toHaveBeenCalledWith(
      { plan: 'team' },
      { headers: { 'Idempotency-Key': 'key-1' } },
    );
  });

  it('refuses a checkout address that is not HTTPS', async () => {
    billing.startBillingCheckout.mockReturnValue(of({ url: 'javascript:alert(1)' }));

    await expect(TestBed.inject(BillingApi).checkout('key-1')).rejects.toThrow();
  });
});
