import { inject, resource, type ResourceRef, type Signal, type Type } from '@angular/core';
import { signalStore, withComputed, withProps } from '@ngrx/signals';

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
 * Interface SubscriptionStoreInstance
 *
 * @description
 * The current organization's plan and usage, read for an owner only.
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
  );
}

/**
 * Constant SubscriptionStore
 *
 * @description
 * Plan and usage of the current organization, provided by each shell widget that shows them.
 * Billing answers only an owner, so nobody else sends the request; a failed read shows nothing,
 * since both widgets are secondary hints.
 *
 * @type {ReturnType<typeof createSubscriptionStore>}
 */
export const SubscriptionStore: ReturnType<typeof createSubscriptionStore> =
  createSubscriptionStore();
