import { DestroyRef, DOCUMENT, inject, type Signal, type Type } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import { hasProblemCode, OrganizationSwitchPendingError, readProblem } from '@core/api';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { BillingApi } from '../../data-access/services/billing-api/billing-api.service';
import type { OrganizationSubscription } from '../../models/organization-subscription/organization-subscription.interface';
import { SubscriptionStore } from '../subscription/subscription.store';
import { CHECKOUT_CONFIRM_DELAYS_MS } from './checkout-confirm-delays.token';
import {
  type CheckoutKeyRecord,
  clearCheckoutKey,
  isUsable,
  readCheckoutKey,
  sessionStorageOf,
  writeCheckoutKey,
} from './checkout-key.storage';
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
 * Interface BillingCheckoutState
 *
 * @description
 * The checkout under way, the key a retry sends again and the confirmation of a payment.
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
   * The page's copy of the key, for a browser that refuses `sessionStorage`.
   *
   * @type {CheckoutKeyRecord | null}
   * @readonly
   */
  readonly _key: CheckoutKeyRecord | null;

  /**
   * Property _confirmingFor
   *
   * @description
   * Organization whose payment is being confirmed, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _confirmingFor: string | null;

  /**
   * Property _unconfirmedFor
   *
   * @description
   * Organization whose payment the last read still did not show, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _unconfirmedFor: string | null;
  // #endregion
}

/**
 * Interface BillingCheckoutStoreInstance
 *
 * @description
 * The upgrade from Free to Team through Stripe Checkout, and the confirmation of its payment.
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

  /**
   * Property confirming
   *
   * @description
   * Whether the subscription of the organization shown is read again after a payment.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly confirming: Signal<boolean>;

  /**
   * Property unconfirmed
   *
   * @description
   * Whether the last read after a payment still showed the Free plan.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly unconfirmed: Signal<boolean>;
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

  /**
   * Method confirmPayment
   *
   * @description
   * After Stripe's successful return: forgets the key and reads the subscription again after each
   * of `CHECKOUT_CONFIRM_DELAYS_MS` until the plan is no longer Free.
   *
   * @returns {Promise<void>} Resolves once confirmed, given up or abandoned.
   */
  confirmPayment(): Promise<void>;

  /**
   * Method retryConfirmation
   *
   * @description
   * Reads the subscription once more after an unconfirmed payment.
   *
   * @returns {Promise<void>} Resolves once read.
   */
  retryConfirmation(): Promise<void>;
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
    withState<BillingCheckoutState>({
      starting: false,
      _key: null,
      _confirmingFor: null,
      _unconfirmedFor: null,
    }),
    withProps(() => ({
      _workspace: inject(WORKSPACE_CONTEXT),
    })),
    withComputed((store) => ({
      confirming: (): boolean => store._confirmingFor() === store._workspace.organization().id,
      unconfirmed: (): boolean => store._unconfirmedFor() === store._workspace.organization().id,
    })),
    withMethods(
      (
        store,
        api: BillingApi = inject(BillingApi),
        subscriptions: InstanceType<typeof SubscriptionStore> = inject(SubscriptionStore),
        redirect: CheckoutRedirect = inject(CHECKOUT_REDIRECT),
        delays: readonly number[] = inject(CHECKOUT_CONFIRM_DELAYS_MS),
        destroyRef: DestroyRef = inject(DestroyRef),
      ) => {
        const workspace: WorkspaceContextPort = store._workspace;
        const storage: Storage | null = sessionStorageOf(inject(DOCUMENT));
        // Waits end early once the page is gone, so nothing is read for it afterwards.
        const timers: Set<() => void> = new Set<() => void>();
        destroyRef.onDestroy((): void => {
          for (const stop of [...timers]) stop();
        });
        const wait: (ms: number) => Promise<void> = (ms: number): Promise<void> =>
          new Promise<void>((resolve: () => void): void => {
            const stop: () => void = (): void => {
              clearTimeout(timer);
              timers.delete(stop);
              resolve();
            };
            const timer: ReturnType<typeof setTimeout> = setTimeout(stop, ms);
            timers.add(stop);
          });
        const boundTo: (organizationId: string) => () => boolean =
          (organizationId: string): (() => boolean) =>
          (): boolean =>
            !destroyRef.destroyed && workspace.organization().id === organizationId;
        const keyFor: (organizationId: string, userId: string) => CheckoutKeyRecord = (
          organizationId: string,
          userId: string,
        ): CheckoutKeyRecord => {
          const now: number = Date.now();
          const stored: CheckoutKeyRecord | null = readCheckoutKey(storage);
          if (isUsable(stored, organizationId, userId, now)) return stored;
          const kept: CheckoutKeyRecord | null = store._key();
          if (isUsable(kept, organizationId, userId, now)) return kept;
          return { organizationId, userId, key: crypto.randomUUID(), createdAt: now };
        };
        const forgetKey: () => void = (): void => {
          clearCheckoutKey(storage);
          patchState(store, { _key: null });
        };
        const confirm: (waits: readonly number[]) => Promise<void> = async (
          waits: readonly number[],
        ): Promise<void> => {
          const organizationId: string = workspace.organization().id;
          const stillWanted: () => boolean = boundTo(organizationId);
          patchState(store, { _confirmingFor: organizationId, _unconfirmedFor: null });
          for (const ms of waits) {
            await wait(ms);
            if (!stillWanted()) break;
            const read: OrganizationSubscription | null = await api
              .subscription()
              .catch((): null => null);
            if (!stillWanted()) break;
            if (read === null) continue;
            subscriptions.subscription.set(read);
            if (read.plan !== 'free') {
              patchState(store, { _confirmingFor: null });
              return;
            }
          }
          if (store._confirmingFor() !== organizationId) return;
          patchState(store, {
            _confirmingFor: null,
            _unconfirmedFor: stillWanted() ? organizationId : null,
          });
        };
        return {
          async start(): Promise<CheckoutOutcome> {
            if (store.starting()) return 'skipped';
            // The checkout belongs to the organization shown when it starts: after a switch, or
            // once the page is gone, its answer opens nothing.
            const organizationId: string = workspace.organization().id;
            const stillWanted: () => boolean = boundTo(organizationId);
            // Billing keeps a Checkout open for two hours and refuses another key meanwhile, so
            // the key outlives the page: back from Stripe, a retry replays the open session.
            const record: CheckoutKeyRecord = keyFor(organizationId, workspace.user().id);
            writeCheckoutKey(storage, record);
            patchState(store, { starting: true, _key: record });
            try {
              const url: string = await api.checkout(record.key);
              if (!stillWanted()) return 'cancelled';
              redirect(url);
              return 'redirected';
            } catch (error: unknown) {
              const code: string | null = readProblem(error)?.code ?? null;
              if (code !== null && DEFINITE_REFUSALS.has(code)) forgetKey();
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

          confirmPayment(): Promise<void> {
            forgetKey();
            return confirm(delays);
          },

          retryConfirmation(): Promise<void> {
            return confirm([0]);
          },
        };
      },
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
 * (`If-Organization-Match`) refuses a request sent for another session organization.
 *
 * The `Idempotency-Key` is kept in `sessionStorage` (`CHECKOUT_KEY_STORAGE`) with the
 * organization, the person and its creation time, so it survives the same-tab round trip to
 * Stripe: a retry, after an unknown outcome or back from a cancelled Checkout, replays the session
 * Billing keeps open rather than being refused for another key. A definite refusal, Stripe's
 * successful return and two hours (`CHECKOUT_KEY_LIFETIME_MS`) drop it.
 *
 * After the successful return, `confirmPayment()` reads the subscription again 2, 4 and 8 s later
 * until the plan is no longer Free and writes each answer into the shared `SubscriptionStore`;
 * `confirming` holds meanwhile, and `unconfirmed` once the last read still shows Free, until
 * `retryConfirmation()` reads it again. The confirmation is bound to its organization and page.
 *
 * @type {ReturnType<typeof createBillingCheckoutStore>}
 */
export const BillingCheckoutStore: ReturnType<typeof createBillingCheckoutStore> =
  createBillingCheckoutStore();
