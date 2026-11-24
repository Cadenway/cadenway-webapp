import { Component, computed, inject, type Signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import type { OrganizationSubscription } from '../../../models/organization-subscription/organization-subscription.interface';
import { SubscriptionStore } from '../../../state/subscription/subscription.store';
import { planName } from '../../../utils/plan-label/plan-label.util';

/**
 * Component PlanSummary
 *
 * @description
 * The « Plan Équipe · 18 / 25 sièges » line of the sidebar footer (mockup `App.dc.html` line
 * 263), linking to `/<slug>/organization/billing`. It shows once Billing answered, which it does
 * for an owner only; nothing shows before, after a failure, or for anyone else. It provides its
 * own `SubscriptionStore` and is a `sidebarFooter` slot contribution.
 */
@Component({
  selector: 'cw-plan-summary',
  imports: [NgIcon, RouterLink],
  providers: [SubscriptionStore],
  host: { class: 'contents' },
  template: `
    @if (store.current(); as subscription) {
      <a
        class="flex items-center gap-1.5 rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
        [routerLink]="billingLink()"
        data-testid="plan-summary"
      >
        <ng-icon name="phosphorUsersThreeBold" class="size-3.5" aria-hidden="true" />
        {{ label(subscription) }}
      </a>
    }
  `,
})
export class PlanSummary {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * Plan and usage of the current organization.
   *
   * @type {InstanceType<typeof SubscriptionStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof SubscriptionStore> = inject(SubscriptionStore);

  /**
   * Property workspace
   *
   * @description
   * Workspace context of the billing address.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property billingLink
   *
   * @description
   * Address of the billing section.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly billingLink: Signal<string> = computed(
    (): string => `/${this.workspace.organization().slug}/organization/billing`,
  );
  // #endregion

  // #region Methods
  /**
   * Method label
   *
   * @description
   * The plan and the seats (« Plan Équipe · 18 / 25 sièges »).
   *
   * @param {OrganizationSubscription} subscription - Plan and usage.
   * @returns {string} The line.
   */
  protected label(subscription: OrganizationSubscription): string {
    return $localize`:@@organization.plan-summary.label:${planName(subscription.plan)}:plan: plan · ${subscription.seatsUsed}:used: / ${subscription.seatsLimit}:limit: seats`;
  }
  // #endregion
}
