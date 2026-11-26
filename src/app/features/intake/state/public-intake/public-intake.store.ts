import { inject, resource, type ResourceRef, type Signal, type Type } from '@angular/core';
import {
  patchState,
  signalMethod,
  signalStore,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import {
  intakeFailureOf,
  isUncertainOutcome,
  PublicIntakeApi,
  submissionBodyOf,
} from '../../data-access/services/public-intake-api/public-intake-api.service';
import type {
  IntakeFailure,
  IntakeFormSettings,
  IntakeRequest,
} from '../../models/intake-form/intake-form.interface';
import { newDraftKey } from '../../utils/draft-key/draft-key.util';

/**
 * Interface SubmissionAttempt
 *
 * @description
 * The body last sent and its idempotency key, reused by a retry of the same body.
 */
interface SubmissionAttempt {
  // #region Properties
  /**
   * Property body
   *
   * @description
   * Fingerprint of the body (`submissionBodyOf`).
   *
   * @type {string}
   * @readonly
   */
  readonly body: string;

  /**
   * Property idempotencyKey
   *
   * @description
   * Key it was sent with.
   *
   * @type {string}
   * @readonly
   */
  readonly idempotencyKey: string;
  // #endregion
}

/**
 * Interface SentSubmission
 *
 * @description
 * A submission exactly as sent, so that it can be sent again unchanged.
 */
interface SentSubmission {
  // #region Properties
  /**
   * Property request
   *
   * @description
   * The request as filled in.
   *
   * @type {IntakeRequest}
   * @readonly
   */
  readonly request: IntakeRequest;

  /**
   * Property form
   *
   * @description
   * The form it was filled in.
   *
   * @type {IntakeFormSettings}
   * @readonly
   */
  readonly form: IntakeFormSettings;

  /**
   * Property attachmentIds
   *
   * @description
   * The verified uploads it carries.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly attachmentIds: readonly string[];

  /**
   * Property draftKey
   *
   * @description
   * Private key of the draft its uploads belong to.
   *
   * @type {string}
   * @readonly
   */
  readonly draftKey: string;

  /**
   * Property idempotencyKey
   *
   * @description
   * Key it was sent with.
   *
   * @type {string}
   * @readonly
   */
  readonly idempotencyKey: string;
  // #endregion
}

/**
 * Interface VerifiedUpload
 *
 * @description
 * The verified upload of a picked file, within its draft.
 */
interface VerifiedUpload {
  // #region Properties
  /**
   * Property draftKey
   *
   * @description
   * Draft the upload belongs to.
   *
   * @type {string}
   * @readonly
   */
  readonly draftKey: string;

  /**
   * Property id
   *
   * @description
   * Id of the upload.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;
  // #endregion
}

/**
 * Interface PublicIntakeState
 *
 * @description
 * The publication shown, the outcome of the last send and the draft the next send belongs to.
 */
interface PublicIntakeState {
  // #region Properties
  /**
   * Property publicKey
   *
   * @description
   * Key of the publication from the address, or null before the page binds it.
   *
   * @type {string | null}
   * @readonly
   */
  readonly publicKey: string | null;

  /**
   * Property pending
   *
   * @description
   * Whether a request is being sent.
   *
   * @type {boolean}
   * @readonly
   */
  readonly pending: boolean;

  /**
   * Property sent
   *
   * @description
   * Title of the request just sent, or null while the form shows.
   *
   * @type {string | null}
   * @readonly
   */
  readonly sent: string | null;

  /**
   * Property failure
   *
   * @description
   * Why the last send failed, or null.
   *
   * @type {IntakeFailure | null}
   * @readonly
   */
  readonly failure: IntakeFailure | null;

  /**
   * Property unconfirmed
   *
   * @description
   * Title of a request sent without a confirmed outcome, which must be sent again before any
   * other, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly unconfirmed: string | null;

  /**
   * Property _draftKey
   *
   * @description
   * Private applicant key of the current draft, renewed once a request is sent.
   *
   * @type {string}
   * @readonly
   */
  readonly _draftKey: string;

  /**
   * Property _attempt
   *
   * @description
   * The last body sent in this draft, or null.
   *
   * @type {SubmissionAttempt | null}
   * @readonly
   */
  readonly _attempt: SubmissionAttempt | null;

  /**
   * Property _replay
   *
   * @description
   * The submission whose outcome is unknown, sent again unchanged by the next send, or null.
   *
   * @type {SentSubmission | null}
   * @readonly
   */
  readonly _replay: SentSubmission | null;
  // #endregion
}

/**
 * Interface PublicIntakeStoreInstance
 *
 * @description
 * The published form of the address and the sending of a request through it.
 */
export interface PublicIntakeStoreInstance {
  // #region Properties
  /**
   * Property publicKey
   *
   * @description
   * Key of the publication.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly publicKey: Signal<string | null>;

  /**
   * Property form
   *
   * @description
   * The primary read: a failure rejects with the typed route error.
   *
   * @type {ResourceRef<IntakeFormSettings | undefined>}
   * @readonly
   */
  readonly form: ResourceRef<IntakeFormSettings | undefined>;

  /**
   * Property pending
   *
   * @description
   * Whether a request is being sent.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly pending: Signal<boolean>;

  /**
   * Property sent
   *
   * @description
   * Title of the request just sent, or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly sent: Signal<string | null>;

  /**
   * Property failure
   *
   * @description
   * Why the last send failed, or null.
   *
   * @type {Signal<IntakeFailure | null>}
   * @readonly
   */
  readonly failure: Signal<IntakeFailure | null>;

  /**
   * Property unconfirmed
   *
   * @description
   * Title of a request sent without a confirmed outcome, or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly unconfirmed: Signal<string | null>;
  // #endregion

  // #region Methods
  /**
   * Method load
   *
   * @description
   * Follows the key of the address; another key starts a new draft.
   *
   * @param {Signal<string> | string} publicKey - Key of the publication.
   */
  load(publicKey: Signal<string> | string): void;

  /**
   * Method submit
   *
   * @description
   * Uploads the files not uploaded yet in this draft, then sends the request. While an earlier
   * submission is unconfirmed, sends that one again unchanged instead.
   *
   * @param {IntakeRequest} request - The request as filled in.
   * @returns {Promise<boolean>} Whether a request was recorded.
   */
  submit(request: IntakeRequest): Promise<boolean>;

  /**
   * Method resend
   *
   * @description
   * Sends the unconfirmed submission again, with its body and keys.
   *
   * @returns {Promise<boolean>} Whether it is recorded.
   */
  resend(): Promise<boolean>;

  /**
   * Method forget
   *
   * @description
   * Forgets the upload of a file removed or replaced, so it is never sent.
   *
   * @param {File} file - The file.
   */
  forget(file: File): void;

  /**
   * Method restart
   *
   * @description
   * Shows the empty form again after a request was sent.
   */
  restart(): void;
  // #endregion
}

/**
 * Function freshDraft
 *
 * @description
 * The draft part of the state for a new request.
 *
 * @returns {Pick<PublicIntakeState, '_draftKey' | '_attempt' | '_replay' | 'unconfirmed'>} A new draft.
 */
function freshDraft(): Pick<
  PublicIntakeState,
  '_draftKey' | '_attempt' | '_replay' | 'unconfirmed'
> {
  return { _draftKey: newDraftKey(), _attempt: null, _replay: null, unconfirmed: null };
}

/**
 * Function createPublicIntakeStore
 *
 * @description
 * Creates the public request form's store.
 *
 * @returns {Type<PublicIntakeStoreInstance>} Injectable store constructor.
 */
function createPublicIntakeStore(): Type<PublicIntakeStoreInstance> {
  return signalStore(
    withState<PublicIntakeState>(() => ({
      publicKey: null,
      pending: false,
      sent: null,
      failure: null,
      ...freshDraft(),
    })),
    withProps((store) => {
      const api: PublicIntakeApi = inject(PublicIntakeApi);
      return {
        _api: api,
        _uploads: new WeakMap<File, VerifiedUpload>(),
        form: resource({
          params: (): { publicKey: string } | undefined => {
            const publicKey: string | null = store.publicKey();
            return publicKey === null ? undefined : { publicKey };
          },
          loader: ({
            params,
            abortSignal,
          }: {
            params: { publicKey: string };
            abortSignal: AbortSignal;
          }): Promise<IntakeFormSettings> => api.form(params.publicKey, abortSignal),
        }),
      };
    }),
    withMethods((store) => {
      // Whether the publication and draft a send began with are still the shown ones; once they
      // are not, the send stops and its answers are dropped.
      const current: (publicKey: string, draftKey: string) => boolean = (
        publicKey: string,
        draftKey: string,
      ): boolean => store.publicKey() === publicKey && store._draftKey() === draftKey;
      // Sends a submission. A lost answer, a timeout or a server failure leaves its outcome
      // unknown: it is kept to be sent again unchanged before anything else.
      const send: (publicKey: string, submission: SentSubmission) => Promise<boolean> = async (
        publicKey: string,
        submission: SentSubmission,
      ): Promise<boolean> => {
        try {
          await store._api.submit(
            publicKey,
            submission.request,
            submission.form,
            submission.attachmentIds,
            { draftKey: submission.draftKey, idempotencyKey: submission.idempotencyKey },
          );
          if (!current(publicKey, submission.draftKey)) return false;
          patchState(store, {
            pending: false,
            failure: null,
            sent: submission.request.title,
            ...freshDraft(),
          });
          return true;
        } catch (error: unknown) {
          if (!current(publicKey, submission.draftKey)) return false;
          if (isUncertainOutcome(error)) {
            patchState(store, {
              pending: false,
              failure: null,
              unconfirmed: submission.request.title,
              _replay: submission,
            });
          } else {
            patchState(store, {
              pending: false,
              failure: intakeFailureOf(error),
              unconfirmed: null,
              _replay: null,
            });
          }
          return false;
        }
      };
      const resend: () => Promise<boolean> = (): Promise<boolean> => {
        const publicKey: string | null = store.publicKey();
        const replay: SentSubmission | null = store._replay();
        if (publicKey === null || replay === null || store.pending()) {
          return Promise.resolve(false);
        }
        patchState(store, { pending: true, failure: null });
        return send(publicKey, replay);
      };
      return {
        load: signalMethod<string>((publicKey: string): void => {
          if (publicKey === store.publicKey()) return;
          patchState(store, {
            publicKey,
            pending: false,
            sent: null,
            failure: null,
            ...freshDraft(),
          });
        }),
        async submit(request: IntakeRequest): Promise<boolean> {
          if (store._replay() !== null) return resend();
          const publicKey: string | null = store.publicKey();
          const form: IntakeFormSettings | undefined = store.form.hasValue()
            ? store.form.value()
            : undefined;
          if (publicKey === null || form === undefined || store.pending()) return false;
          const body: string = submissionBodyOf(request, form);
          const previous: SubmissionAttempt | null = store._attempt();
          const attempt: SubmissionAttempt =
            previous?.body === body ? previous : { body, idempotencyKey: crypto.randomUUID() };
          const draftKey: string = store._draftKey();
          patchState(store, { pending: true, failure: null, _attempt: attempt });
          const ids: string[] = [];
          try {
            if (form.fields.attachments !== 'disabled') {
              for (const file of request.files) {
                const known: VerifiedUpload | undefined = store._uploads.get(file);
                const id: string =
                  known?.draftKey === draftKey
                    ? known.id
                    : await store._api.upload(publicKey, draftKey, file);
                if (!current(publicKey, draftKey)) return false;
                store._uploads.set(file, { draftKey, id });
                ids.push(id);
              }
            }
          } catch (error: unknown) {
            if (current(publicKey, draftKey)) {
              patchState(store, { pending: false, failure: intakeFailureOf(error) });
            }
            return false;
          }
          return send(publicKey, {
            request,
            form,
            attachmentIds: ids,
            draftKey,
            idempotencyKey: attempt.idempotencyKey,
          });
        },
        resend,
        forget(file: File): void {
          store._uploads.delete(file);
        },
        restart(): void {
          patchState(store, { sent: null, failure: null });
        },
      };
    }),
  );
}

/**
 * Constant PublicIntakeStore
 *
 * @description
 * The state of the public request form (`/f/:publicKey`), page-scoped on `IntakePage`. Each
 * draft has its own private key, and each body its own idempotency key, so a retry after a
 * refusal neither uploads a file again nor creates a second task; uploads are kept per file
 * object, and a removed or replaced file forgets its upload. A submission whose outcome is
 * unknown (no answer, a timeout, a server failure) is kept with its body and key: every send
 * replays it unchanged until it is confirmed or refused, so an edit made meanwhile cannot create
 * a second task. A request sent starts a new draft. A send whose key or draft is no longer the
 * shown one stops before storing an upload or submitting, and drops its answers.
 *
 * @type {Type<PublicIntakeStoreInstance>}
 */
export const PublicIntakeStore: Type<PublicIntakeStoreInstance> = createPublicIntakeStore();
