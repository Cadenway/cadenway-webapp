import type { BillingSubscription } from '@cadenway/api-client';

import type { OrganizationSubscription } from '../../../models/organization-subscription/organization-subscription.interface';

/**
 * Function toOrganizationSubscription
 *
 * @description
 * Keeps the plan, the seats and the attachment storage of a subscription.
 *
 * @param {BillingSubscription} subscription - `GET /v1/billing/subscription` answer.
 * @returns {OrganizationSubscription} Display model of the subscription.
 */
export function toOrganizationSubscription(
  subscription: BillingSubscription,
): OrganizationSubscription {
  return {
    plan: subscription.plan,
    seatsUsed: subscription.seats.used,
    seatsLimit: subscription.seats.limit,
    storageUsedBytes: subscription.storage.attachmentBytesUsed,
    storageLimitBytes: subscription.storage.limitBytes,
  };
}
