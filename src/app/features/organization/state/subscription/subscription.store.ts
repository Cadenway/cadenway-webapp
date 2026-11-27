import { inject, resource, type ResourceRef, type Signal, type Type } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import { type ApiProblem, readProblem } from '@core/api';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { BillingApi } from '../../data-access/services/billing-api/billing-api.service';
import type { OrganizationSubscription } from '../../models/organization-subscription/organization-subscription.interface';

/**
 * Constant NEARLY_FULL
 *
 * @description
 * Share of the storage quota from which the `Storage nearly full` banner shows.
 *
 * @type {number}
 */
const NEARLY_FULL: number = 0.9;

/**
 * Constant CRITICAL
 *
 * @description
 * Share of a quota from which its meter is critical (grenat) and the `Quotas and usage`
 * navigation item carries the `Critical quota` alert (`Organisation.dc.html` lines 1636-1647).
 *
 * @type {number}
 */
const CRITICAL: number = 0.9;

/**
 * Constant SILENT_STATUSES
 *
 * @description
 * Refusals that mean the person may not read billing (no longer an owner, organization gone):
 * the widgets then show nothing rather than an error.
 *
 * @type {ReadonlySet<number>}
 */
const SILENT_STATUSES: ReadonlySet<number> = new Set([403, 404]);

/**
 * Interface SubscriptionRefreshState
 *
 * @description
 * Private state of `refresh()`.
 */
interface SubscriptionRefreshState {
  // #region Properties
  /**
   * Property _staleAfter
   *
   * @description
   * The subscription shown when the last refresh failed, while it is still the one shown.
   *
   * @type {OrganizationSubscription | null}
   * @readonly
   */
  readonly _staleAfter: OrganizationSubscription | null;

  /**
   * Property _refreshing
   *
   * @description
   * Whether a refresh is under way.
   *
   * @type {boolean}
   * @readonly
   */
  readonly _refreshing: boolean;
  // #endregion
}

/**
 * Interface SubscriptionStoreInstance
 *
 * @description
 * The current organization's plan and usage, read once per organization for an owner only.
 */
interface SubscriptionStoreInstance {
  // #region Properties
  /**
   * Property subscription
   *
   * @description
   * The read of the subscription; idle for anyone but an owner, read again after a switch.
   *
   * @type {ResourceRef<OrganizationSubscription | undefined>}
   * @readonly
   */
  readonly subscription: ResourceRef<OrganizationSubscription | undefined>;

  /**
   * Property current
   *
   * @description
   * The subscription read, or null while unread, failed or not readable.
   *
   * @type {Signal<OrganizationSubscription | null>}
   * @readonly
   */
  readonly current: Signal<OrganizationSubscription | null>;

  /**
   * Property failed
   *
   * @description
   * Whether the read failed for a reason worth a `Retry` (not a `403` or a `404`).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly failed: Signal<boolean>;

  /**
   * Property refreshFailed
   *
   * @description
   * Whether the last `refresh()` failed (not with a `403` or a `404`) while `current` still shows
   * the subscription read before it, which may be out of date. Any newer subscription (another
   * read, a switch) clears it.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly refreshFailed: Signal<boolean>;

  /**
   * Property refreshing
   *
   * @description
   * Whether a `refresh()` is under way.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly refreshing: Signal<boolean>;

  /**
   * Property storageNearlyFull
   *
   * @description
   * Whether attachments use at least 90 % of the storage quota.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly storageNearlyFull: Signal<boolean>;

  /**
   * Property quotaCritical
   *
   * @description
   * Whether the seats or the storage the quotas section shows use at least 90 % of their limit.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly quotaCritical: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method retry
   *
   * @description
   * Reads the subscription again after a failure.
   */
  retry(): void;

  /**
   * Method refresh
   *
   * @description
   * Reads the subscription again while `current` keeps the one shown, then shows the answer. It
   * sends nothing for anyone but an owner, nor while nothing is shown (the first read under way
   * is fresh; after a failure use `retry()`); a refresh under way is shared. A failure other than
   * a `403` or a `404` sets `refreshFailed`. The answer is dropped once the organization changed.
   *
   * @returns {Promise<boolean>} Resolves once settled: whether `current` holds the answer.
   */
  refresh(): Promise<boolean>;
  // #endregion
}

/**
 * Function createSubscriptionStore
 *
 * @description
 * Creates the subscription store.
 *
 * @returns {Type<SubscriptionStoreInstance>} Injectable store constructor.
 */
function createSubscriptionStore(): Type<SubscriptionStoreInstance> {
  return signalStore(
    withState<SubscriptionRefreshState>({ _staleAfter: null, _refreshing: false }),
    withProps(() => {
      const api: BillingApi = inject(BillingApi);
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      return {
        _api: api,
        _workspace: workspace,
        _pendingRefresh: { run: null as Promise<boolean> | null },
        subscription: resource({
          params: (): string | undefined =>
            workspace.role() === 'owner' ? workspace.organization().id : undefined,
          loader: (): Promise<OrganizationSubscription> => api.subscription(),
        }),
      };
    }),
    withComputed((store) => ({
      current: (): OrganizationSubscription | null =>
        store.subscription.hasValue() ? store.subscription.value() : null,
      failed: (): boolean => {
        const error: Error | undefined = store.subscription.error();
        if (error === undefined) return false;
        const problem: ApiProblem | null = readProblem(error.cause ?? error);
        return problem === null || !SILENT_STATUSES.has(problem.status);
      },
      refreshFailed: (): boolean => {
        const stale: OrganizationSubscription | null = store._staleAfter();
        return (
          stale !== null && store.subscription.hasValue() && store.subscription.value() === stale
        );
      },
      refreshing: (): boolean => store._refreshing(),
      quotaCritical: (): boolean => {
        const subscription: OrganizationSubscription | undefined = store.subscription.hasValue()
          ? store.subscription.value()
          : undefined;
        if (subscription === undefined) return false;
        const reached: (used: number, limit: number) => boolean = (used: number, limit: number) =>
          limit > 0 && used >= CRITICAL * limit;
        return (
          reached(subscription.seatsUsed, subscription.seatsLimit) ||
          reached(subscription.storageUsedBytes, subscription.storageLimitBytes)
        );
      },
      storageNearlyFull: (): boolean => {
        const subscription: OrganizationSubscription | undefined = store.subscription.hasValue()
          ? store.subscription.value()
          : undefined;
        return (
          subscription !== undefined &&
          subscription.storageUsedBytes >= NEARLY_FULL * subscription.storageLimitBytes
        );
      },
    })),
    withMethods((store) => ({
      retry(): void {
        store.subscription.reload();
      },
      refresh(): Promise<boolean> {
        const pending: Promise<boolean> | null = store._pendingRefresh.run;
        if (pending !== null) return pending;
        if (store._workspace.role() !== 'owner' || !store.subscription.hasValue()) {
          return Promise.resolve(false);
        }
        const organizationId: string = store._workspace.organization().id;
        const shown: OrganizationSubscription = store.subscription.value();
        const run: Promise<boolean> = store._api
          .subscription()
          .then(
            (read: OrganizationSubscription): boolean => {
              const moved: boolean =
                store._workspace.organization().id !== organizationId ||
                store._workspace.role() !== 'owner';
              if (moved) return false;
              store.subscription.set(read);
              patchState(store, { _staleAfter: null });
              return true;
            },
            (error: unknown): boolean => {
              const problem: ApiProblem | null = readProblem(error);
              const current: OrganizationSubscription | undefined = store.subscription.hasValue()
                ? store.subscription.value()
                : undefined;
              if ((problem === null || !SILENT_STATUSES.has(problem.status)) && current === shown) {
                patchState(store, { _staleAfter: shown });
              }
              return false;
            },
          )
          .finally((): void => {
            store._pendingRefresh.run = null;
            patchState(store, { _refreshing: false });
          });
        store._pendingRefresh.run = run;
        patchState(store, { _refreshing: true });
        return run;
      },
    })),
  );
}

/**
 * Constant SubscriptionStore
 *
 * @description
 * Plan and usage of the current organization, provided once on the `/:org` route by
 * `provideOrganizationUsage()` and shared by the plan line and the storage banner, so an owner's
 * workspace sends one request. Billing answers an owner only, so nobody else sends it. A `403` or
 * `404` shows nothing; any other failure is a flag the plan line offers to retry, and the banner
 * stays hidden until a retry succeeds. `refresh()` (the quotas section, when it opens and before
 * its export) reads it again while the subscription shown stays, and flags a failure apart.
 *
 * @type {ReturnType<typeof createSubscriptionStore>}
 */
export const SubscriptionStore: ReturnType<typeof createSubscriptionStore> =
  createSubscriptionStore();
