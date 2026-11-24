import { inject, Service } from '@angular/core';
import { type BillingSubscription, BillingService } from '@cadenway/api-client';
import { firstValueFrom } from 'rxjs';

import type { OrganizationSubscription } from '../../../models/organization-subscription/organization-subscription.interface';
import { toOrganizationSubscription } from '../../adapters/subscription/subscription.adapter';

/**
 * Service BillingApi
 *
 * @description
 * The organization feature's access to Billing, mapped to display models.
 */
@Service()
export class BillingApi {
  // #region Properties
  /**
   * Property billing
   *
   * @description
   * Generated billing operations.
   *
   * @type {BillingService}
   * @readonly
   */
  private readonly billing: BillingService = inject(BillingService);
  // #endregion

  // #region Methods
  /**
   * Method subscription
   *
   * @description
   * Reads the current organization's plan and usage. Only an owner may read it; others get `403`.
   *
   * @returns {Promise<OrganizationSubscription>} The plan and usage.
   */
  public async subscription(): Promise<OrganizationSubscription> {
    const subscription: BillingSubscription = await firstValueFrom(
      this.billing.getBillingSubscription(),
    );
    return toOrganizationSubscription(subscription);
  }
  // #endregion
}
