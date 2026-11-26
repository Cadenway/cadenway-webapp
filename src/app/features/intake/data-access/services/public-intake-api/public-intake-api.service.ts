import { type HttpEvent, HttpClient, HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import {
  type IntakeSubmission,
  type PublicIntakeForm,
  PublicIntakeService,
  type StartPublicIntakeAttachmentUploadClientResult,
} from '@cadenway/api-client';
import { firstValueFrom, fromEvent, lastValueFrom, type Observable, takeUntil, tap } from 'rxjs';

import { type ApiProblem, readProblem } from '@core/api';
import { NotFoundRouteError, UnavailableRouteError } from '@shared/route-errors';

import type {
  IntakeFailure,
  IntakeFormSettings,
  IntakeRequest,
} from '../../../models/intake-form/intake-form.interface';
import {
  toIntakeFormSettings,
  toIntakeSubmission,
} from '../../adapters/public-intake/public-intake.adapter';

/**
 * Constant NOT_READY_RETRIES
 *
 * @description
 * How many times a submission is sent again while a verified upload has not reached the task
 * service yet (`409 attachment.upload-not-ready`), with the same idempotency key.
 *
 * @type {number}
 */
const NOT_READY_RETRIES: number = 3;

/**
 * Constant NOT_READY_DELAY_MS
 *
 * @description
 * Pause before each of those retries, in milliseconds.
 *
 * @type {number}
 */
const NOT_READY_DELAY_MS: number = 1000;

/**
 * Interface IntakeSubmissionKeys
 *
 * @description
 * The keys a submission is sent with, kept by the caller so that a retry replays it.
 */
export interface IntakeSubmissionKeys {
  // #region Properties
  /**
   * Property draftKey
   *
   * @description
   * Private applicant key of the draft its uploads belong to (`Intake-Draft-Key`).
   *
   * @type {string}
   * @readonly
   */
  readonly draftKey: string;

  /**
   * Property idempotencyKey
   *
   * @description
   * Key of this submission body (`Idempotency-Key`), reused by a retry of the same body.
   *
   * @type {string}
   * @readonly
   */
  readonly idempotencyKey: string;
  // #endregion
}

/**
 * Function intakeFailureOf
 *
 * @description
 * Why a submission or an upload failed, for the message shown above the send button: a `404`
 * means the form no longer accepts requests (disabled, archived or removed alike), a refused or
 * oversized file is `file`, anything else is `unavailable`.
 *
 * @param {unknown} error - The failure.
 * @returns {IntakeFailure} The kind of failure.
 */
export function intakeFailureOf(error: unknown): IntakeFailure {
  const problem: ApiProblem | null = readProblem(error);
  if (problem?.status === 404) return 'closed';
  if (problem?.code?.startsWith('attachment.')) return 'file';
  return 'unavailable';
}

/**
 * Function isUncertainOutcome
 *
 * @description
 * Whether a failed submission may still have been recorded: no answer, a timeout, a server
 * failure (`5xx`) or a matching submission still in progress (`409
 * idempotency.request-in-progress`). Only replaying the same body with the same key tells.
 *
 * @param {unknown} error - The failure.
 * @returns {boolean} Whether the outcome is unknown.
 */
export function isUncertainOutcome(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse)) return true;
  if (error.status === 0 || error.status >= 500) return true;
  return readProblem(error)?.code === 'idempotency.request-in-progress';
}

/**
 * Function abortable
 *
 * @description
 * Subscribes to a read until its resource is superseded or destroyed.
 *
 * @param {Observable<T>} source - The read.
 * @param {AbortSignal | undefined} signal - Resource cancellation signal.
 * @returns {Promise<T>} The first response.
 */
function abortable<T>(source: Observable<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  return firstValueFrom(signal ? source.pipe(takeUntil(fromEvent(signal, 'abort'))) : source);
}

/**
 * Function pause
 *
 * @description
 * Waits before a retry.
 *
 * @param {number} milliseconds - The delay.
 * @returns {Promise<void>} Resolves after the delay.
 */
function pause(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve: () => void): void => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * Service PublicIntakeApi
 *
 * @description
 * The public request form's access to `intake` of the gateway, without a session: the published
 * form, the signed uploads of the requester's files and the submission.
 */
@Service()
export class PublicIntakeApi {
  // #region Properties
  /**
   * Property intake
   *
   * @description
   * Generated public intake operations.
   *
   * @type {PublicIntakeService}
   * @readonly
   */
  private readonly intake: PublicIntakeService = inject(PublicIntakeService);

  /**
   * Property http
   *
   * @description
   * Transport of the signed upload to object storage, which is not the API.
   *
   * @type {HttpClient}
   * @readonly
   */
  private readonly http: HttpClient = inject(HttpClient);
  // #endregion

  // #region Methods
  /**
   * Method form
   *
   * @description
   * Reads the published form: the page's primary read. The gateway answers the same `404` for an
   * unknown, disabled, archived or removed form, which is not found, as a malformed key (`400`)
   * is; anything else is unavailable with its status and request reference.
   *
   * @param {string} publicKey - Key of the publication, from the address.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<IntakeFormSettings>} What the form shows.
   */
  public async form(publicKey: string, signal?: AbortSignal): Promise<IntakeFormSettings> {
    try {
      const dto: PublicIntakeForm = await abortable(
        this.intake.getPublicIntakeForm(publicKey),
        signal,
      );
      return toIntakeFormSettings(dto);
    } catch (error: unknown) {
      const problem: ApiProblem | null = readProblem(error);
      if (!problem) throw error;
      if (problem.status === 404 || problem.status === 400) throw new NotFoundRouteError();
      throw new UnavailableRouteError(problem.status, problem.requestId);
    }
  }

  /**
   * Method upload
   *
   * @description
   * Uploads one file of the draft: reserves a signed upload (`Intake-Draft-Key`, a new
   * `Idempotency-Key` per file), posts the signed fields then the file as its last part `file`
   * without the application's credentials, and asks for its verification. After a transfer that
   * left the browser but got no answer, the verification is still asked, as the contract
   * requires.
   *
   * @param {string} publicKey - Key of the publication.
   * @param {string} draftKey - Private key of the draft.
   * @param {File} file - The file, from 1 byte to 25 MiB.
   * @returns {Promise<string>} The id of the verified upload.
   */
  public async upload(publicKey: string, draftKey: string, file: File): Promise<string> {
    const upload: StartPublicIntakeAttachmentUploadClientResult = await firstValueFrom(
      this.intake.startPublicIntakeAttachmentUpload(
        publicKey,
        {
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        },
        { headers: { 'Intake-Draft-Key': draftKey, 'Idempotency-Key': crypto.randomUUID() } },
      ),
    );
    const body: FormData = new FormData();
    for (const [name, value] of Object.entries(upload.fields)) body.append(name, value);
    body.append('file', file);
    const transfer: { sent: boolean } = { sent: false };
    try {
      await lastValueFrom(
        this.http.post(upload.url, body, { observe: 'events', responseType: 'text' }).pipe(
          tap((event: HttpEvent<string>): void => {
            if (event.type === HttpEventType.Sent) transfer.sent = true;
          }),
        ),
      );
    } catch (error: unknown) {
      if (!transfer.sent || !(error instanceof HttpErrorResponse) || error.status !== 0) {
        throw error;
      }
    }
    await firstValueFrom(
      this.intake.completePublicIntakeAttachmentUpload(publicKey, upload.id, {
        headers: { 'Intake-Draft-Key': draftKey },
      }),
    );
    return upload.id;
  }

  /**
   * Method submit
   *
   * @description
   * Sends the request with its verified uploads. The submission always carries its idempotency
   * key, and the draft key when it has attachments. While a verified upload has not reached the
   * task service (`409 attachment.upload-not-ready`), it is sent again with the same keys, up to
   * three times one second apart. The receipt is opaque: it names no task.
   *
   * @param {string} publicKey - Key of the publication.
   * @param {IntakeRequest} request - The request as filled in.
   * @param {IntakeFormSettings} form - The form it was filled in.
   * @param {readonly string[]} attachmentIds - The verified uploads of its files.
   * @param {IntakeSubmissionKeys} keys - The draft and idempotency keys.
   * @returns {Promise<void>} Resolves once the request is recorded.
   */
  public async submit(
    publicKey: string,
    request: IntakeRequest,
    form: IntakeFormSettings,
    attachmentIds: readonly string[],
    keys: IntakeSubmissionKeys,
  ): Promise<void> {
    const body: IntakeSubmission = toIntakeSubmission(request, form, attachmentIds);
    const headers: Record<string, string> = {
      'Idempotency-Key': keys.idempotencyKey,
      ...(body.attachmentIds ? { 'Intake-Draft-Key': keys.draftKey } : {}),
    };
    for (let attempt: number = 0; ; attempt += 1) {
      try {
        await firstValueFrom(this.intake.submitPublicIntakeForm(publicKey, body, { headers }));
        return;
      } catch (error: unknown) {
        const problem: ApiProblem | null = readProblem(error);
        if (problem?.code !== 'attachment.upload-not-ready' || attempt >= NOT_READY_RETRIES) {
          throw error;
        }
        await pause(NOT_READY_DELAY_MS);
      }
    }
  }
  // #endregion
}

/**
 * Constant FILE_IDENTITIES
 *
 * @description
 * A number for each picked file object, so two picks of files with the same name, size and date
 * stay distinct.
 *
 * @type {WeakMap<File, number>}
 */
const FILE_IDENTITIES: WeakMap<File, number> = new WeakMap<File, number>();

/**
 * Constant nextFileIdentity
 *
 * @description
 * The number the next file object gets.
 *
 * @type {{ value: number }}
 */
const nextFileIdentity: { value: number } = { value: 0 };

/**
 * Function fileIdentityOf
 *
 * @description
 * The number of a picked file object, the same for the same object only.
 *
 * @param {File} file - The file.
 * @returns {number} Its identity.
 */
function fileIdentityOf(file: File): number {
  let identity: number | undefined = FILE_IDENTITIES.get(file);
  if (identity === undefined) {
    identity = nextFileIdentity.value += 1;
    FILE_IDENTITIES.set(file, identity);
  }
  return identity;
}

/**
 * Function submissionBodyOf
 *
 * @description
 * A stable text of what a submission sends, without its keys, so that the caller reuses the
 * idempotency key only for the same body: the gateway refuses a reused key with another body.
 * Files count by object, so a file picked again, even with the same name, size and date, makes
 * another body.
 *
 * @param {IntakeRequest} request - The request as filled in.
 * @param {IntakeFormSettings} form - The form it was filled in.
 * @returns {string} The fingerprint of the body, before its uploads.
 */
export function submissionBodyOf(request: IntakeRequest, form: IntakeFormSettings): string {
  return JSON.stringify([
    toIntakeSubmission(request, form, []),
    request.files.map((file: File): number => fileIdentityOf(file)),
  ]);
}
