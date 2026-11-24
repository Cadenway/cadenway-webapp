import { inject, resource, type ResourceRef, type Signal, type Type } from '@angular/core';
import { signalStore, withComputed, withMethods, withProps } from '@ngrx/signals';

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
 * Share of the storage quota from which the « Stockage presque plein » banner shows.
 *
 * @type {number}
 */
const NEARLY_FULL: number = 0.9;

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
   * Whether the read failed for a reason worth a « Réessayer » (not a `403` or a `404`).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly failed: Signal<boolean>;

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
  // #endregion

  // #region Methods
  /**
   * Method retry
   *
   * @description
   * Reads the subscription again after a failure.
   */
  retry(): void;
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
    withProps(() => {
      const api: BillingApi = inject(BillingApi);
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      return {
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
 * stays hidden until a retry succeeds.
 *
 * @type {ReturnType<typeof createSubscriptionStore>}
 */
export const SubscriptionStore: ReturnType<typeof createSubscriptionStore> =
  createSubscriptionStore();
