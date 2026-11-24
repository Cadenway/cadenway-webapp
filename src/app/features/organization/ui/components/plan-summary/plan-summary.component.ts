import { Component, computed, inject, type Signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CwButton } from '@cadenway/ui/components/button';
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
 * for an owner only; nothing shows before the answer, after a `403` or a `404`, or for anyone
 * else. Any other failure shows an inline error with « Réessayer », which reads the subscription
 * again. It reads the `SubscriptionStore` of the `/:org` route and is a `sidebarFooter` slot
 * contribution.
 */
@Component({
  selector: 'cw-plan-summary',
  imports: [CwButton, NgIcon, RouterLink],
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
    } @else if (store.failed()) {
      <div class="flex items-center gap-1.5 text-xs text-muted-foreground" role="alert">
        <ng-icon
          name="phosphorWarningCircleBold"
          class="size-3.5 text-destructive"
          aria-hidden="true"
        />
        <span class="min-w-0 flex-1 truncate" i18n="@@organization.plan-summary.failed"
          >The plan could not be loaded.</span
        >
        <button
          cwButton
          type="button"
          variant="ghost"
          size="sm"
          class="h-6 px-1.5 text-xs"
          (click)="store.retry()"
          i18n="@@organization.retry"
        >
          Retry
        </button>
      </div>
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
