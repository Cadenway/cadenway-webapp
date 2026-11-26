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
  fileKeyOf,
  intakeFailureOf,
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
   * Property _uploads
   *
   * @description
   * Verified upload id of each file of the draft (`fileKeyOf`), so a retry does not upload it
   * again.
   *
   * @type {Readonly<Partial<Record<string, string>>>}
   * @readonly
   */
  readonly _uploads: Readonly<Partial<Record<string, string>>>;
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
   * Uploads the files not uploaded yet in this draft, then sends the request.
   *
   * @param {IntakeRequest} request - The request as filled in.
   * @returns {Promise<boolean>} Whether the request was recorded.
   */
  submit(request: IntakeRequest): Promise<boolean>;

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
 * @returns {Pick<PublicIntakeState, '_draftKey' | '_attempt' | '_uploads'>} A new draft.
 */
function freshDraft(): Pick<PublicIntakeState, '_draftKey' | '_attempt' | '_uploads'> {
  return { _draftKey: newDraftKey(), _attempt: null, _uploads: {} };
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
    withMethods((store) => ({
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
        // Whether the publication and draft this send began with are still the shown ones; once
        // they are not, the send stops and its answers are dropped.
        const current: () => boolean = (): boolean =>
          store.publicKey() === publicKey && store._draftKey() === draftKey;
        try {
          const ids: string[] = [];
          if (form.fields.attachments !== 'disabled') {
            for (const file of request.files) {
              const key: string = fileKeyOf(file);
              const known: string | undefined = store._uploads()[key];
              const id: string = known ?? (await store._api.upload(publicKey, draftKey, file));
              if (!current()) return false;
              if (known === undefined) {
                patchState(store, { _uploads: { ...store._uploads(), [key]: id } });
              }
              ids.push(id);
            }
          }
          await store._api.submit(publicKey, request, form, ids, {
            draftKey,
            idempotencyKey: attempt.idempotencyKey,
          });
          if (!current()) return false;
          patchState(store, { pending: false, sent: request.title, ...freshDraft() });
          return true;
        } catch (error: unknown) {
          if (current()) {
            patchState(store, { pending: false, failure: intakeFailureOf(error) });
          }
          return false;
        }
      },
      restart(): void {
        patchState(store, { sent: null, failure: null });
      },
    })),
  );
}

/**
 * Constant PublicIntakeStore
 *
 * @description
 * The state of the public request form (`/f/:publicKey`), page-scoped on `IntakePage`. Each
 * draft has its own private key, and each body its own idempotency key, so a retry after a lost
 * answer neither uploads a file again nor creates a second task; a request sent starts a new
 * draft. A send whose key or draft is no longer the shown one stops before storing an upload
 * or submitting, and drops its answers.
 *
 * @type {Type<PublicIntakeStoreInstance>}
 */
export const PublicIntakeStore: Type<PublicIntakeStoreInstance> = createPublicIntakeStore();
