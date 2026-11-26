import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { PublicIntakeApi } from '../../data-access/services/public-intake-api/public-intake-api.service';
import type {
  IntakeFormSettings,
  IntakeRequest,
} from '../../models/intake-form/intake-form.interface';
import { PublicIntakeStore, type PublicIntakeStoreInstance } from './public-intake.store';

/**
 * Constant form
 *
 * @description
 * The published Sprint 14 form, attachments allowed.
 *
 * @type {IntakeFormSettings}
 */
const form: IntakeFormSettings = {
  title: 'Request for “Sprint 14”',
  description: null,
  fields: {
    description: 'optional',
    priority: 'optional',
    dueDate: 'optional',
    contactEmail: 'required',
    attachments: 'optional',
  },
};

/**
 * Constant log
 *
 * @description
 * A file the requester attaches.
 *
 * @type {File}
 */
const log: File = new File(['log'], 'error.log', { lastModified: 1 });

/**
 * Constant request
 *
 * @description
 * A request from Atelier Nord with one file.
 *
 * @type {IntakeRequest}
 */
const request: IntakeRequest = {
  title: 'Export the invoices as CSV',
  description: '',
  priority: null,
  dueDate: null,
  contactEmail: 'camille.martin@ateliernord.fr',
  files: [log],
};

describe('PublicIntakeStore', () => {
  let api: { form: Mock; upload: Mock; submit: Mock };
  let store: PublicIntakeStoreInstance;

  beforeEach(async () => {
    api = {
      form: vi.fn(() => Promise.resolve(form)),
      upload: vi.fn(() => Promise.resolve('att-1')),
      submit: vi.fn(() => Promise.resolve()),
    };
    TestBed.configureTestingModule({
      providers: [PublicIntakeStore, { provide: PublicIntakeApi, useValue: api }],
    });
    store = TestBed.inject(PublicIntakeStore);
    store.load('key');
    await expect.poll(() => store.form.hasValue()).toBe(true);
  });

  it('reads the form of the key and sends a request with its uploads', async () => {
    expect(api.form).toHaveBeenCalledWith('key', expect.any(AbortSignal));

    expect(await store.submit(request)).toBe(true);

    expect(api.upload).toHaveBeenCalledWith('key', expect.stringMatching(/^[\w-]{43}$/u), log);
    expect(api.submit).toHaveBeenCalledWith('key', request, form, ['att-1'], {
      draftKey: api.upload.mock.calls[0]?.[1] as string,
      idempotencyKey: expect.any(String) as string,
    });
    expect(store.sent()).toBe('Export the invoices as CSV');
    expect(store.pending()).toBe(false);
  });

  it('retries a failed send with the same keys and without uploading again', async () => {
    api.submit.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));

    expect(await store.submit(request)).toBe(false);
    expect(store.failure()).toBe('unavailable');
    expect(store.sent()).toBeNull();
    expect(await store.submit(request)).toBe(true);

    expect(api.upload).toHaveBeenCalledTimes(1);
    const [first, second]: [unknown[], unknown[]] = api.submit.mock.calls as [unknown[], unknown[]];
    expect(second[4]).toEqual(first[4]);
    expect(store.failure()).toBeNull();
  });

  it('gives a changed body a new idempotency key', async () => {
    api.submit.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    await store.submit(request);
    await store.submit({ ...request, title: 'Export the credit notes as CSV' });

    const [first, second]: [unknown[], unknown[]] = api.submit.mock.calls as [unknown[], unknown[]];
    const keys: (call: unknown[]) => string = (call) =>
      (call[4] as { idempotencyKey: string }).idempotencyKey;
    expect(keys(second)).not.toBe(keys(first));
  });

  it('says a closed form no longer accepts requests, and starts a new draft once sent', async () => {
    api.submit.mockRejectedValueOnce(
      new HttpErrorResponse({ status: 404, error: { status: 404 } }),
    );
    await store.submit(request);
    expect(store.failure()).toBe('closed');

    await store.submit(request);
    store.restart();
    await store.submit(request);

    expect(store.sent()).toBe('Export the invoices as CSV');
    const drafts: string[] = api.upload.mock.calls.map((call: unknown[]) => call[1] as string);
    expect(drafts).toHaveLength(2);
    expect(drafts[1]).not.toBe(drafts[0]);
  });

  it('drops an upload that completes after the key changed, and sends nothing for it', async () => {
    let complete: (id: string) => void = (): void => undefined;
    api.upload.mockReturnValueOnce(
      new Promise<string>((resolve: (id: string) => void): void => {
        complete = resolve;
      }),
    );

    const sending: Promise<boolean> = store.submit(request);
    store.load('key-2');
    complete('att-old');

    expect(await sending).toBe(false);
    expect(api.submit).not.toHaveBeenCalled();
    expect(store.pending()).toBe(false);
    expect(store.failure()).toBeNull();

    await expect.poll(() => api.form.mock.calls.length).toBe(2);
    await expect.poll(() => store.form.hasValue()).toBe(true);
    expect(await store.submit(request)).toBe(true);
    const [first, second]: [unknown[], unknown[]] = api.upload.mock.calls as [unknown[], unknown[]];
    expect(second[0]).toBe('key-2');
    expect(second[1]).not.toBe(first[1]);
    expect(api.submit).toHaveBeenCalledWith('key-2', request, form, ['att-1'], {
      draftKey: second[1] as string,
      idempotencyKey: expect.any(String) as string,
    });
  });
});
