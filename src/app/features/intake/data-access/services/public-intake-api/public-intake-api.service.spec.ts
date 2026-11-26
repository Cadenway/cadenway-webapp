import { HttpClient, HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { PublicIntakeService } from '@cadenway/api-client';
import { concat, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { NotFoundRouteError, UnavailableRouteError } from '@shared/route-errors';

import type {
  IntakeFormSettings,
  IntakeRequest,
} from '../../../models/intake-form/intake-form.interface';
import {
  fileKeyOf,
  intakeFailureOf,
  PublicIntakeApi,
  submissionBodyOf,
} from './public-intake-api.service';

/**
 * Constant form
 *
 * @description
 * A published form that shows every field.
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
 * Constant request
 *
 * @description
 * A request from Atelier Nord.
 *
 * @type {IntakeRequest}
 */
const request: IntakeRequest = {
  title: 'Export the invoices as CSV',
  description: '',
  priority: null,
  dueDate: null,
  contactEmail: 'camille.martin@ateliernord.fr',
  files: [],
};

/**
 * Function problem
 *
 * @description
 * A problem answer of the gateway.
 *
 * @param {number} status - HTTP status.
 * @param {string} [code] - Problem code.
 * @returns {HttpErrorResponse} The answer.
 */
function problem(status: number, code?: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { status, ...(code ? { code } : {}) } });
}

describe('PublicIntakeApi', () => {
  let intake: Record<string, Mock>;
  let http: { post: Mock };
  let api: PublicIntakeApi;

  beforeEach(() => {
    intake = {
      getPublicIntakeForm: vi.fn(() =>
        of({ title: 'Request', description: null, fields: form.fields }),
      ),
      startPublicIntakeAttachmentUpload: vi.fn(() =>
        of({ id: 'att-1', method: 'POST', url: 'https://storage.test/u', fields: { ticket: 't' } }),
      ),
      completePublicIntakeAttachmentUpload: vi.fn(() => of({ id: 'att-1' })),
      submitPublicIntakeForm: vi.fn(() => of({ receipt: 'r' })),
    };
    http = {
      post: vi.fn(() => of({ type: HttpEventType.Sent }, { type: HttpEventType.Response })),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: PublicIntakeService, useValue: intake },
        { provide: HttpClient, useValue: http },
      ],
    });
    api = TestBed.inject(PublicIntakeApi);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the published form', async () => {
    expect((await api.form('key')).title).toBe('Request');
    expect(intake['getPublicIntakeForm']).toHaveBeenCalledWith('key');
  });

  it('turns a missing form into not found and another failure into unavailable', async () => {
    intake['getPublicIntakeForm'].mockReturnValueOnce(throwError(() => problem(404)));
    await expect(api.form('key')).rejects.toBeInstanceOf(NotFoundRouteError);
    intake['getPublicIntakeForm'].mockReturnValueOnce(throwError(() => problem(503)));
    await expect(api.form('key')).rejects.toBeInstanceOf(UnavailableRouteError);
  });

  it('uploads a file through its signed form, then asks for its verification', async () => {
    const file: File = new File(['log'], 'error.log', { type: 'text/plain' });

    expect(await api.upload('key', 'draft', file)).toBe('att-1');

    expect(intake['startPublicIntakeAttachmentUpload']).toHaveBeenCalledWith(
      'key',
      { fileName: 'error.log', contentType: 'text/plain', sizeBytes: 3 },
      {
        headers: expect.objectContaining({ 'Intake-Draft-Key': 'draft' }) as Record<string, string>,
      },
    );
    const body: FormData = http.post.mock.calls[0]?.[1] as FormData;
    expect([...body.keys()]).toEqual(['ticket', 'file']);
    expect(intake['completePublicIntakeAttachmentUpload']).toHaveBeenCalledWith('key', 'att-1', {
      headers: { 'Intake-Draft-Key': 'draft' },
    });
  });

  it('still asks for the verification after a transfer that got no answer', async () => {
    http.post.mockReturnValueOnce(
      concat(
        of({ type: HttpEventType.Sent }),
        throwError(() => new HttpErrorResponse({ status: 0 })),
      ),
    );

    expect(await api.upload('key', 'draft', new File(['x'], 'a.txt'))).toBe('att-1');
    expect(intake['completePublicIntakeAttachmentUpload']).toHaveBeenCalledTimes(1);
  });

  it('fails without verification when the transfer was refused before it left', async () => {
    http.post.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));

    await expect(api.upload('key', 'draft', new File(['x'], 'a.txt'))).rejects.toBeInstanceOf(
      HttpErrorResponse,
    );
    expect(intake['completePublicIntakeAttachmentUpload']).not.toHaveBeenCalled();
  });

  it('submits with its idempotency key, and the draft key only with attachments', async () => {
    await api.submit('key', request, form, [], { draftKey: 'draft', idempotencyKey: 'idem' });
    expect(intake['submitPublicIntakeForm']).toHaveBeenLastCalledWith(
      'key',
      { title: 'Export the invoices as CSV', contactEmail: 'camille.martin@ateliernord.fr' },
      { headers: { 'Idempotency-Key': 'idem' } },
    );

    await api.submit('key', request, form, ['att-1'], { draftKey: 'draft', idempotencyKey: 'i2' });
    expect(intake['submitPublicIntakeForm']).toHaveBeenLastCalledWith(
      'key',
      expect.objectContaining({ attachmentIds: ['att-1'] }),
      { headers: { 'Idempotency-Key': 'i2', 'Intake-Draft-Key': 'draft' } },
    );
  });

  it('sends again while an upload is not ready, with the same keys', async () => {
    vi.useFakeTimers();
    intake['submitPublicIntakeForm']
      .mockReturnValueOnce(throwError(() => problem(409, 'attachment.upload-not-ready')))
      .mockReturnValueOnce(of({ receipt: 'r' }));

    const sent: Promise<void> = api.submit('key', request, form, ['att-1'], {
      draftKey: 'draft',
      idempotencyKey: 'idem',
    });
    await vi.advanceTimersByTimeAsync(1000);
    await sent;

    expect(intake['submitPublicIntakeForm']).toHaveBeenCalledTimes(2);
  });

  it('names the failures and fingerprints a body without its keys', () => {
    expect(intakeFailureOf(problem(404, 'intake-form.not-found'))).toBe('closed');
    expect(intakeFailureOf(problem(409, 'attachment.storage-quota-exceeded'))).toBe('file');
    expect(intakeFailureOf(problem(503))).toBe('unavailable');
    expect(submissionBodyOf(request, form)).toBe(submissionBodyOf({ ...request }, form));
    expect(submissionBodyOf(request, form)).not.toBe(
      submissionBodyOf({ ...request, title: 'Other' }, form),
    );
    expect(fileKeyOf(new File(['ab'], 'a.txt', { lastModified: 5 }))).toBe('a.txt|2|5');
  });
});
