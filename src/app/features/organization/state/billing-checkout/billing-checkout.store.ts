import { computed, DestroyRef, DOCUMENT, inject, type Signal, type Type } from '@angular/core';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withHooks,
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
import { InvoicesStore } from '../invoices/invoices.store';
import { SubscriptionStore } from '../subscription/subscription.store';
import { CHECKOUT_CONFIRM_DELAYS_MS } from './checkout-confirm-delays.token';
import {
  type CheckoutKeyRecord,
  clearCheckoutKey,
  isRecent,
  isUsable,
  readCheckoutKey,
  sessionStorageOf,
  writeCheckoutKey,
} from './checkout-key.storage';
import { CHECKOUT_REDIRECT, type CheckoutRedirect } from './checkout-redirect.token';
import {
  clearPaymentPending,
  type PaymentPending,
  readPaymentPending,
  writePaymentPending,
} from './payment-pending.storage';

/**
 * Type CheckoutReturn
 *
 * @description
 * Whose payment Stripe's successful return reports, from the key record of the checkout: the
 * organization shown (`here`); another organization of the same person, opened by its slug
 * (`elsewhere`); or nobody this page can tell (`unknown`: no record, another person's, or
 * expired).
 *
 * @type {{ kind: 'here' } | { kind: 'elsewhere'; slug: string } | { kind: 'unknown' }}
 */
export type CheckoutReturn =
  { kind: 'here' } | { kind: 'elsewhere'; slug: string } | { kind: 'unknown' };

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

  /**
   * Property awaitingPayment
   *
   * @description
   * Whether a payment of the organization shown awaits Billing's confirmation, being read again or
   * left unconfirmed; the upgrade is withheld meanwhile.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly awaitingPayment: Signal<boolean>;
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
   * Method returnTarget
   *
   * @description
   * Tells whose payment Stripe's successful return reports.
   *
   * @returns {CheckoutReturn} The organization shown, another one, or unknown.
   */
  returnTarget(): CheckoutReturn;

  /**
   * Method confirmPayment
   *
   * @description
   * After Stripe's successful return for the organization shown: forgets the key, records the
   * payment awaiting confirmation and reads the subscription again after each of
   * `CHECKOUT_CONFIRM_DELAYS_MS` until the plan is no longer Free.
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
      _subscriptions: inject(SubscriptionStore),
    })),
    withComputed((store) => {
      const confirming: Signal<boolean> = computed(
        (): boolean => store._confirmingFor() === store._workspace.organization().id,
      );
      const unconfirmed: Signal<boolean> = computed(
        (): boolean => store._unconfirmedFor() === store._workspace.organization().id,
      );
      return {
        confirming,
        unconfirmed,
        awaitingPayment: (): boolean => confirming() || unconfirmed(),
      };
    }),
    withMethods(
      (
        store,
        api: BillingApi = inject(BillingApi),
        invoices: InstanceType<typeof InvoicesStore> | null = inject(InvoicesStore, {
          optional: true,
        }),
        redirect: CheckoutRedirect = inject(CHECKOUT_REDIRECT),
        delays: readonly number[] = inject(CHECKOUT_CONFIRM_DELAYS_MS),
        destroyRef: DestroyRef = inject(DestroyRef),
      ) => {
        const workspace: WorkspaceContextPort = store._workspace;
        const subscriptions: InstanceType<typeof SubscriptionStore> = store._subscriptions;
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
        const keyFor: (
          organizationId: string,
          slug: string,
          userId: string,
        ) => CheckoutKeyRecord = (
          organizationId: string,
          slug: string,
          userId: string,
        ): CheckoutKeyRecord => {
          const now: number = Date.now();
          const stored: CheckoutKeyRecord | null = readCheckoutKey(storage);
          if (isUsable(stored, organizationId, userId, now)) return stored;
          const kept: CheckoutKeyRecord | null = store._key();
          if (isUsable(kept, organizationId, userId, now)) return kept;
          return { organizationId, slug, userId, key: crypto.randomUUID(), createdAt: now };
        };
        const forgetKey: () => void = (): void => {
          clearCheckoutKey(storage);
          patchState(store, { _key: null });
        };
        // Each confirmation run supersedes the one before, which then stops at its next step.
        let run: number = 0;
        // A paid plan observed while a payment is awaited ends the wait, stops the reads under way
        // and reloads the invoices once, so the new invoice shows.
        const paid: (organizationId: string) => void = (organizationId: string): void => {
          const waiting: boolean =
            store._confirmingFor() === organizationId ||
            store._unconfirmedFor() === organizationId ||
            readPaymentPending(storage, organizationId, Date.now()) !== null;
          if (!waiting) return;
          run += 1;
          clearPaymentPending(storage, organizationId);
          patchState(store, {
            _confirmingFor:
              store._confirmingFor() === organizationId ? null : store._confirmingFor(),
            _unconfirmedFor:
              store._unconfirmedFor() === organizationId ? null : store._unconfirmedFor(),
          });
          invoices?.retry();
        };
        const confirm: (waits: readonly number[]) => Promise<void> = async (
          waits: readonly number[],
        ): Promise<void> => {
          run += 1;
          const mine: number = run;
          const organizationId: string = workspace.organization().id;
          const bound: () => boolean = boundTo(organizationId);
          const stillWanted: () => boolean = (): boolean => bound() && run === mine;
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
              paid(organizationId);
              return;
            }
          }
          if (run !== mine) return;
          if (!bound()) {
            // Left before the end: the stored wait stays, so the next visit resumes it.
            if (store._confirmingFor() === organizationId) {
              patchState(store, { _confirmingFor: null });
            }
            return;
          }
          const pending: PaymentPending | null = readPaymentPending(
            storage,
            organizationId,
            Date.now(),
          );
          // An expired wait is not extended: a later visit offers the upgrade again.
          if (pending !== null) {
            writePaymentPending(storage, organizationId, {
              since: pending.since,
              unconfirmed: true,
            });
          }
          patchState(store, { _confirmingFor: null, _unconfirmedFor: organizationId });
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
            const record: CheckoutKeyRecord = keyFor(
              organizationId,
              workspace.organization().slug,
              workspace.user().id,
            );
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

          returnTarget(): CheckoutReturn {
            const record: CheckoutKeyRecord | null = readCheckoutKey(storage) ?? store._key();
            if (!isRecent(record, workspace.user().id, Date.now())) return { kind: 'unknown' };
            return record.organizationId === workspace.organization().id
              ? { kind: 'here' }
              : { kind: 'elsewhere', slug: record.slug };
          },

          confirmPayment(): Promise<void> {
            const organizationId: string = workspace.organization().id;
            forgetKey();
            writePaymentPending(storage, organizationId, { since: Date.now(), unconfirmed: false });
            return confirm(delays);
          },

          retryConfirmation(): Promise<void> {
            return confirm([0]);
          },

          _resume: signalMethod<string>((organizationId: string): void => {
            if (
              store._confirmingFor() === organizationId ||
              store._unconfirmedFor() === organizationId
            ) {
              return;
            }
            const pending: PaymentPending | null = readPaymentPending(
              storage,
              organizationId,
              Date.now(),
            );
            if (pending === null) return;
            if (pending.unconfirmed) {
              patchState(store, { _unconfirmedFor: organizationId });
            } else {
              void confirm(delays);
            }
          }),

          _observe: signalMethod<string | null>((plan: string | null): void => {
            const organizationId: string = workspace.organization().id;
            if (plan !== null && plan !== 'free') paid(organizationId);
          }),
        };
      },
    ),
    withHooks({
      onInit(store): void {
        // At once for the organization shown, so the upgrade never shows before a stored wait
        // withholds it, then on every switch.
        store._resume(store._workspace.organization().id);
        store._resume(computed((): string => store._workspace.organization().id));
        store._observe(computed((): string | null => store._subscriptions.current()?.plan ?? null));
      },
    }),
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
 * Stripe's return carries no organization, so `returnTarget()` matches it against the key
 * record: the organization shown, another organization of the same person (by the slug recorded
 * when the checkout started), or unknown. Only a return for the organization shown is confirmed.
 *
 * After the successful return, `confirmPayment()` records the payment awaiting confirmation in
 * `sessionStorage` (`PAYMENT_PENDING_STORAGE`, for one hour) and reads the subscription again 2,
 * 4 and 8 s later until the plan is no longer Free, writing each answer into the shared
 * `SubscriptionStore`; `confirming` holds meanwhile, and `unconfirmed` once the last read still
 * shows Free, until `retryConfirmation()` reads it again. A page created again, or back to that
 * organization, resumes the wait from the record: the reads, or the unconfirmed note. A paid plan
 * observed in the shared store ends the wait, and the confirmation that observes it reloads the
 * page's invoices. The confirmation is bound to its organization and page.
 *
 * @type {ReturnType<typeof createBillingCheckoutStore>}
 */
export const BillingCheckoutStore: ReturnType<typeof createBillingCheckoutStore> =
  createBillingCheckoutStore();
