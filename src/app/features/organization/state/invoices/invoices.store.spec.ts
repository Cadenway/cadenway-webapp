import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceOrganization,
} from '@features/workspace/ports/workspace-context';

import { BillingApi } from '../../data-access/services/billing-api/billing-api.service';
import type { InvoicePage, OrganizationInvoice } from '../../models/invoice/invoice.interface';
import { INVOICES_PAGE_SIZE, InvoicesStore } from './invoices.store';

/**
 * Function invoice
 *
 * @description
 * A paid invoice of the fixtures.
 *
 * @param {string} number - Invoice number.
 * @returns {OrganizationInvoice} The invoice.
 */
function invoice(number: string): OrganizationInvoice {
  return {
    number,
    periodStart: '2026-11-01T00:00:00Z',
    periodEnd: '2026-12-01T00:00:00Z',
    totalMinorUnits: 125_000,
    currency: 'EUR',
    status: 'paid',
    pdfUrl: null,
  };
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
  return { id, slug: id, name: id, initials: 'AN', role: 'owner', plan: 'team' };
}

/**
 * Constant FIRST_PAGE
 *
 * @description
 * Atelier Nord's newest invoices, with a next page.
 *
 * @type {InvoicePage}
 */
const FIRST_PAGE: InvoicePage = { items: [invoice('FAC-2026-0011')], nextCursor: 'c2' };

/**
 * Constant SECOND_PAGE
 *
 * @description
 * Atelier Nord's older invoices, the last page.
 *
 * @type {InvoicePage}
 */
const SECOND_PAGE: InvoicePage = { items: [invoice('FAC-2025-0019')], nextCursor: null };

describe('InvoicesStore', () => {
  let api: { invoices: Mock };
  let shown: WritableSignal<WorkspaceOrganization>;

  /**
   * Function settle
   *
   * @description
   * Waits for the reads under way.
   *
   * @returns {Promise<void>} Resolves once stable.
   */
  async function settle(): Promise<void> {
    await TestBed.inject(ApplicationRef).whenStable();
  }

  /**
   * Function store
   *
   * @description
   * Creates the store and waits for its first read.
   *
   * @returns {Promise<InstanceType<typeof InvoicesStore>>} The store.
   */
  async function store(): Promise<InstanceType<typeof InvoicesStore>> {
    TestBed.configureTestingModule({
      providers: [
        InvoicesStore,
        { provide: BillingApi, useValue: api },
        { provide: WORKSPACE_CONTEXT, useValue: { organization: shown } },
      ],
    });
    const instance: InstanceType<typeof InvoicesStore> = TestBed.inject(InvoicesStore);
    await settle();
    return instance;
  }

  beforeEach(() => {
    api = {
      invoices: vi.fn((cursor: string | null) =>
        Promise.resolve(cursor === null ? FIRST_PAGE : SECOND_PAGE),
      ),
    };
    shown = signal(organization('org-nord'));
  });

  it('reads the first page of the workspace organization', async () => {
    const invoices: InstanceType<typeof InvoicesStore> = await store();

    expect(api.invoices).toHaveBeenCalledWith(null, INVOICES_PAGE_SIZE, expect.any(AbortSignal));
    expect(invoices.shown()).toBe(true);
    expect(invoices.rows().map((row: OrganizationInvoice) => row.number)).toEqual([
      'FAC-2026-0011',
    ]);
    expect(invoices.hasPrevious()).toBe(false);
    expect(invoices.hasNext()).toBe(true);
  });

  it('tells a completed empty history from a failed first read', async () => {
    api.invoices.mockResolvedValueOnce({ items: [], nextCursor: null });
    const empty: InstanceType<typeof InvoicesStore> = await store();

    expect(empty.shown()).toBe(true);
    expect(empty.rows()).toEqual([]);
    expect(empty.failed()).toBe(false);
    expect(empty.hasNext()).toBe(false);
  });

  it('keeps a failed first read for the error boundary', async () => {
    api.invoices.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    const invoices: InstanceType<typeof InvoicesStore> = await store();

    expect(invoices.shown()).toBe(false);
    expect(invoices.failed()).toBe(false);
    expect(() => invoices.invoices.value()).toThrow();
  });

  it('pages forward with the cursor and back to the first page', async () => {
    const invoices: InstanceType<typeof InvoicesStore> = await store();

    invoices.next();
    await settle();

    expect(api.invoices).toHaveBeenLastCalledWith(
      'c2',
      INVOICES_PAGE_SIZE,
      expect.any(AbortSignal),
    );
    expect(invoices.pageIndex()).toBe(1);
    expect(invoices.rows().map((row: OrganizationInvoice) => row.number)).toEqual([
      'FAC-2025-0019',
    ]);
    expect(invoices.hasNext()).toBe(false);

    invoices.previous();
    await settle();

    expect(api.invoices).toHaveBeenLastCalledWith(
      null,
      INVOICES_PAGE_SIZE,
      expect.any(AbortSignal),
    );
    expect(invoices.pageIndex()).toBe(0);
  });

  it('shows a later failed read in place and reads it again on retry', async () => {
    const invoices: InstanceType<typeof InvoicesStore> = await store();
    api.invoices.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));

    invoices.next();
    await settle();

    expect(invoices.failed()).toBe(true);
    expect(invoices.shown()).toBe(true);

    invoices.retry();
    await settle();

    expect(invoices.failed()).toBe(false);
    expect(invoices.rows().map((row: OrganizationInvoice) => row.number)).toEqual([
      'FAC-2025-0019',
    ]);
  });

  it('starts another organization at its first page and never sends it a cursor of the last one', async () => {
    const invoices: InstanceType<typeof InvoicesStore> = await store();
    invoices.next();
    await settle();
    api.invoices.mockClear();
    let answer: (page: InvoicePage) => void = (): void => undefined;
    api.invoices.mockReturnValueOnce(
      new Promise<InvoicePage>((resolve: (page: InvoicePage) => void) => {
        answer = resolve;
      }),
    );

    shown.set(organization('org-lumen'));
    TestBed.tick();

    expect(invoices.shown()).toBe(false);
    expect(invoices.pageIndex()).toBe(0);
    expect(api.invoices).toHaveBeenCalledTimes(1);
    expect(api.invoices).toHaveBeenCalledWith(null, INVOICES_PAGE_SIZE, expect.any(AbortSignal));

    answer({ items: [invoice('LUM-2026-0001')], nextCursor: null });
    await settle();

    expect(invoices.shown()).toBe(true);
    expect(invoices.rows().map((row: OrganizationInvoice) => row.number)).toEqual([
      'LUM-2026-0001',
    ]);

    shown.set(organization('org-nord'));
    await settle();

    expect(invoices.pageIndex()).toBe(0);
    expect(api.invoices).toHaveBeenLastCalledWith(
      null,
      INVOICES_PAGE_SIZE,
      expect.any(AbortSignal),
    );
  });

  it('treats the first read back to an organization answered before as the primary read', async () => {
    const invoices: InstanceType<typeof InvoicesStore> = await store();
    expect(invoices.shown()).toBe(true);
    api.invoices.mockReturnValue(new Promise<InvoicePage>((): void => undefined));

    shown.set(organization('org-lumen'));
    TestBed.tick();
    let refuse: (error: unknown) => void = (): void => undefined;
    api.invoices.mockReturnValueOnce(
      new Promise<InvoicePage>((_resolve: unknown, reject: (error: unknown) => void) => {
        refuse = reject;
      }),
    );
    shown.set(organization('org-nord'));
    TestBed.tick();

    expect(invoices.shown()).toBe(false);
    expect(invoices.loading()).toBe(true);

    refuse(new HttpErrorResponse({ status: 503 }));
    await settle();

    expect(invoices.shown()).toBe(false);
    expect(invoices.failed()).toBe(false);
    expect(() => invoices.invoices.value()).toThrow();
  });

  it('keeps the pagination shown while the page opened is read', async () => {
    const invoices: InstanceType<typeof InvoicesStore> = await store();
    expect(invoices.paged()).toBe(true);
    invoices.next();
    await settle();
    api.invoices.mockReturnValueOnce(new Promise<InvoicePage>((): void => undefined));

    invoices.previous();
    TestBed.tick();

    expect(invoices.loading()).toBe(true);
    expect(invoices.hasPrevious()).toBe(false);
    expect(invoices.hasNext()).toBe(false);
    expect(invoices.paged()).toBe(true);
  });
});
