import { DestroyRef, inject, type Signal, type Type } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

import { hasProblemCode, OrganizationSwitchPendingError, readProblem } from '@core/api';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { BillingApi } from '../../data-access/services/billing-api/billing-api.service';
import { CHECKOUT_REDIRECT, type CheckoutRedirect } from './checkout-redirect.token';

/**
 * Type CheckoutOutcome
 *
 * @description
 * How a checkout ended: `redirected` to Stripe; `subscribed` when a paid plan already exists;
 * `in-progress` while another Checkout is pending; `pending` while the same request still runs;
 * `failed` for any other refusal or an unknown outcome; `cancelled` once the organization or the
 * page changed; `context-changed` when the workspace recovery takes over; `skipped` while
 * another checkout runs.
 *
 * @type {'redirected' | 'subscribed' | 'in-progress' | 'pending' | 'failed' | 'cancelled' | 'context-changed' | 'skipped'}
 */
export type CheckoutOutcome =
  | 'redirected'
  | 'subscribed'
  | 'in-progress'
  | 'pending'
  | 'failed'
  | 'cancelled'
  | 'context-changed'
  | 'skipped';

/**
 * Interface CheckoutKey
 *
 * @description
 * The idempotency key of an organization's checkout.
 */
interface CheckoutKey {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * Organization the key was made for.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property key
   *
   * @description
   * The `Idempotency-Key`.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;
  // #endregion
}

/**
 * Interface BillingCheckoutState
 *
 * @description
 * The checkout under way and the key a retry sends again.
 */
interface BillingCheckoutState {
  // #region Properties
  /**
   * Property starting
   *
   * @description
   * Whether a checkout is waiting for Billing.
   *
   * @type {boolean}
   * @readonly
   */
  readonly starting: boolean;

  /**
   * Property _key
   *
   * @description
   * Key of the last checkout whose outcome Billing may still replay, or null.
   *
   * @type {CheckoutKey | null}
   * @readonly
   */
  readonly _key: CheckoutKey | null;
  // #endregion
}

/**
 * Interface BillingCheckoutStoreInstance
 *
 * @description
 * The upgrade from Free to Team through Stripe Checkout.
 */
interface BillingCheckoutStoreInstance {
  // #region Properties
  /**
   * Property starting
   *
   * @description
   * Whether a checkout is waiting for Billing.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly starting: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method start
   *
   * @description
   * Asks Billing for a Checkout of the Team plan and opens it.
   *
   * @returns {Promise<CheckoutOutcome>} How the checkout ended.
   */
  start(): Promise<CheckoutOutcome>;
  // #endregion
}

/**
 * Constant DEFINITE_REFUSALS
 *
 * @description
 * Problem codes after which Billing holds nothing for the key, so the next attempt takes a new
 * one. Any other failure may have created a Checkout session, which the same key replays.
 *
 * @type {ReadonlySet<string>}
 */
const DEFINITE_REFUSALS: ReadonlySet<string> = new Set([
  'billing.subscription-active',
  'billing.checkout-in-progress',
  'idempotency.key-reused',
  'request.invalid',
  'organization.role-forbidden',
  'organization.not-found',
]);

/**
 * Function createBillingCheckoutStore
 *
 * @description
 * Creates the checkout store.
 *
 * @returns {Type<BillingCheckoutStoreInstance>} Injectable store constructor.
 */
function createBillingCheckoutStore(): Type<BillingCheckoutStoreInstance> {
  return signalStore(
    withState<BillingCheckoutState>({ starting: false, _key: null }),
    withMethods(
      (
        store,
        api: BillingApi = inject(BillingApi),
        workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT),
        redirect: CheckoutRedirect = inject(CHECKOUT_REDIRECT),
        destroyRef: DestroyRef = inject(DestroyRef),
      ) => ({
        async start(): Promise<CheckoutOutcome> {
          if (store.starting()) return 'skipped';
          // The checkout belongs to the organization shown when it starts: after a switch, or
          // once the page is gone, its answer opens nothing.
          const organizationId: string = workspace.organization().id;
          const stillWanted: () => boolean = (): boolean =>
            !destroyRef.destroyed && workspace.organization().id === organizationId;
          const kept: CheckoutKey | null = store._key();
          const key: string =
            kept?.organizationId === organizationId ? kept.key : crypto.randomUUID();
          patchState(store, { starting: true, _key: { organizationId, key } });
          try {
            const url: string = await api.checkout(key);
            if (!stillWanted()) return 'cancelled';
            redirect(url);
            return 'redirected';
          } catch (error: unknown) {
            const code: string | null = readProblem(error)?.code ?? null;
            if (code !== null && DEFINITE_REFUSALS.has(code)) {
              patchState(store, { _key: null });
            }
            if (!stillWanted()) return 'cancelled';
            if (
              error instanceof OrganizationSwitchPendingError ||
              hasProblemCode(error, 'organization.context-changed')
            ) {
              return 'context-changed';
            }
            if (code === 'billing.subscription-active') return 'subscribed';
            if (code === 'billing.checkout-in-progress') return 'in-progress';
            if (code === 'idempotency.request-in-progress') return 'pending';
            return 'failed';
          } finally {
            patchState(store, { starting: false });
          }
        },
      }),
    ),
  );
}

/**
 * Constant BillingCheckoutStore
 *
 * @description
 * The `Billing` section's upgrade from Free to Team, provided by its page. A checkout is bound to
 * the organization shown when it starts and to the page: its answer after a switch or once the
 * page is gone opens nothing and ends `cancelled`; Billing's own organization pin
 * (`If-Organization-Match`) refuses a request sent for another session organization. A retry
 * after an unknown outcome (no answer, `5xx`, `429`, `409 idempotency.request-in-progress`)
 * sends the same `Idempotency-Key`, so Billing replays the Checkout it may have created rather
 * than reserving another; a definite refusal drops the key. The Checkout opens in the same tab
 * through `CHECKOUT_REDIRECT`.
 *
 * @type {ReturnType<typeof createBillingCheckoutStore>}
 */
export const BillingCheckoutStore: ReturnType<typeof createBillingCheckoutStore> =
  createBillingCheckoutStore();
