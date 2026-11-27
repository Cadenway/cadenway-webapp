import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  type Signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CwAlert,
  CwAlertActions,
  CwAlertDescription,
  CwAlertTitle,
} from '@cadenway/ui/components/alert';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwEmpty,
  CwEmptyContent,
  CwEmptyDescription,
  CwEmptyHeader,
  CwEmptyMedia,
  CwEmptyTitle,
} from '@cadenway/ui/components/empty';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwToastService } from '@cadenway/ui/components/toast';
import { NgIcon } from '@ng-icons/core';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import type { OrganizationSubscription } from '../../../models/organization-subscription/organization-subscription.interface';
import {
  BillingCheckoutStore,
  type CheckoutOutcome,
} from '../../../state/billing-checkout/billing-checkout.store';
import { InvoicesStore } from '../../../state/invoices/invoices.store';
import { SubscriptionStore } from '../../../state/subscription/subscription.store';
import { InvoicesTable } from '../../components/invoices-table/invoices-table.component';
import { planName } from '../../../utils/plan-label/plan-label.util';
import { PlanCard } from '../../components/plan-card/plan-card.component';

/**
 * Type PlanState
 *
 * @description
 * What the plan area shows: the card, a skeleton while a retry reads the plan, the inline error,
 * or nothing while the plan is not readable.
 *
 * @type {'ready' | 'reloading' | 'failed' | 'none'}
 */
type PlanState = 'ready' | 'reloading' | 'failed' | 'none';

/**
 * Constant CHECKOUT_RETURN
 *
 * @description
 * Query parameter of Stripe's return address (`?checkout=success` or `?checkout=cancel`), which
 * Billing's `BILLING_STRIPE_CHECKOUT_SUCCESS_URL` and `BILLING_STRIPE_CHECKOUT_CANCEL_URL` set;
 * the slug-less `/org/billing` redirects it to the session's organization.
 *
 * @type {string}
 */
const CHECKOUT_RETURN: string = 'checkout';

/**
 * Component BillingPage
 *
 * @description
 * The organization settings section `Billing` (mockup `Organisation.dc.html` lines 318-378), for
 * the owner, limited to what Billing serves. It shows the plan card (`<plan> plan`, the seats used
 * of the limit and those available, and `Upgrade to the Team plan` on Free) and the `Invoices`
 * table, newest first, page by page, with the PDF link when Stripe has one. The plan catalog,
 * the downgrade, `Manage seats`, the price, the renewal, the next invoice, the payment method and
 * the billing details have no contract (gap B14) and are not rendered.
 *
 * The plan comes from the `SubscriptionStore` of `/:org`; the page-scoped `InvoicesStore` reads
 * the invoices, whose first page is the primary read: the section skeleton shows until it and the
 * plan answered, and its failure reaches the route's error boundary (`Retry` runs the route
 * again). A failed plan read shows the section's error panel in the plan area, whose `Retry`
 * reads it again; a later failed invoices page shows it in place of the table. Both reads are
 * keyed by the workspace organization, so a page reused for another organization shows the
 * skeleton and that one's data.
 *
 * `Upgrade to the Team plan` asks the page-scoped `BillingCheckoutStore` for a Stripe Checkout,
 * bound to the organization shown and to the page, and opens it in the same tab, toasting the
 * mockup's `Redirecting to the payment provider…`; a paid plan already in place, another Checkout
 * under way and any other refusal toast why. Back from Stripe, `?checkout=success` or
 * `?checkout=cancel` toasts the outcome once and leaves the address. After a success the store
 * reads the plan again 2, 4 and 8 s later until it is no longer Free: `Upgrade` is withheld and
 * `Confirming the payment…` shows meanwhile, and a plan still Free after the last read shows
 * `The payment is not confirmed yet` with `Retry`. The page's toasts are dismissed when it is
 * left or the organization changes.
 */
@Component({
  selector: 'cw-billing-page',
  imports: [
    CwAlert,
    CwAlertActions,
    CwAlertDescription,
    CwAlertTitle,
    CwButton,
    CwEmpty,
    CwEmptyContent,
    CwEmptyDescription,
    CwEmptyHeader,
    CwEmptyMedia,
    CwEmptyTitle,
    CwSkeleton,
    InvoicesTable,
    NgIcon,
    PlanCard,
  ],
  providers: [InvoicesStore, BillingCheckoutStore],
  templateUrl: './billing-page.component.html',
})
export class BillingPage {
  // #region Properties
  /**
   * Property invoices
   *
   * @description
   * The organization's invoices, page by page.
   *
   * @type {InstanceType<typeof InvoicesStore>}
   * @readonly
   */
  protected readonly invoices: InstanceType<typeof InvoicesStore> = inject(InvoicesStore);

  /**
   * Property checkout
   *
   * @description
   * The upgrade through Stripe Checkout.
   *
   * @type {InstanceType<typeof BillingCheckoutStore>}
   * @readonly
   */
  protected readonly checkout: InstanceType<typeof BillingCheckoutStore> =
    inject(BillingCheckoutStore);

  /**
   * Property subscriptions
   *
   * @description
   * The plan and usage of the workspace organization, shared with the shell.
   *
   * @type {InstanceType<typeof SubscriptionStore>}
   * @readonly
   */
  protected readonly subscriptions: InstanceType<typeof SubscriptionStore> =
    inject(SubscriptionStore);

  /**
   * Property workspace
   *
   * @description
   * Workspace context: the organization shown.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property toasts
   *
   * @description
   * Toasts of the settings shell.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property route
   *
   * @description
   * The section's route, for Stripe's return parameter.
   *
   * @type {ActivatedRoute}
   * @readonly
   */
  private readonly route: ActivatedRoute = inject(ActivatedRoute);

  /**
   * Property router
   *
   * @description
   * Router, to leave the return parameter.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property shownToasts
   *
   * @description
   * Toasts the page showed, dismissed when it is left or the organization changes.
   *
   * @type {string[]}
   * @readonly
   */
  private readonly shownToasts: string[] = [];

  /**
   * Property primary
   *
   * @description
   * Whether the first invoices page answered while nothing is shown yet. Reading it after a
   * failed first read throws the resource's error, which the route's error boundary renders.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly primary: Signal<boolean> = computed(
    (): boolean => !this.invoices.shown() && this.invoices.invoices.value() !== undefined,
  );

  /**
   * Property loadingSection
   *
   * @description
   * Whether the section skeleton shows: until the first invoices page of the organization and
   * its plan answered.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly loadingSection: Signal<boolean> = computed(
    (): boolean => !this.invoices.shown() || this.subscriptions.subscription.status() === 'loading',
  );

  /**
   * Property plan
   *
   * @description
   * The plan read, or null.
   *
   * @type {Signal<OrganizationSubscription | null>}
   * @readonly
   */
  protected readonly plan: Signal<OrganizationSubscription | null> = computed(
    (): OrganizationSubscription | null => this.subscriptions.current(),
  );

  /**
   * Property planState
   *
   * @description
   * What the plan area shows.
   *
   * @type {Signal<PlanState>}
   * @readonly
   */
  protected readonly planState: Signal<PlanState> = computed((): PlanState => {
    if (this.plan() !== null) return 'ready';
    const status: string = this.subscriptions.subscription.status();
    if (status === 'reloading' || status === 'loading') return 'reloading';
    return status === 'error' ? 'failed' : 'none';
  });

  /**
   * Property description
   *
   * @description
   * The section's subtitle, naming the organization.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly description: Signal<string> = computed(
    (): string =>
      $localize`:@@organization.billing.description:Plan, seats and invoices of the organization ${this.workspace.organization().name}:organization:. Visible to the owner only.`,
  );

  /**
   * Property unconfirmedText
   *
   * @description
   * The note of a payment Billing has not confirmed after the last read.
   *
   * @type {string}
   * @readonly
   */
  protected readonly unconfirmedText: string = $localize`:@@organization.billing.unconfirmed-text:The plan still shows ${planName('free')}:plan:. The confirmation can take a few minutes.`;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Toasts Stripe's return once and leaves its parameter, starting at once the confirmation of a
   * successful payment, and dismisses the page's toasts when it is left or the organization
   * changes.
   *
   * @constructor
   */
  public constructor() {
    const returned: string | null = this.route.snapshot.queryParamMap.get(CHECKOUT_RETURN);
    if (returned === 'success') void this.checkout.confirmPayment();
    if (returned !== null) {
      afterNextRender((): void => {
        this.showReturn(returned);
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { [CHECKOUT_RETURN]: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });
    }
    let organizationId: string = this.workspace.organization().id;
    effect((): void => {
      const current: string = this.workspace.organization().id;
      if (current === organizationId) return;
      organizationId = current;
      this.dismissToasts();
    });
    inject(DestroyRef).onDestroy((): void => {
      this.dismissToasts();
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method upgrade
   *
   * @description
   * Opens the Stripe Checkout of the Team plan and toasts its outcome. A checkout abandoned by a
   * switch or by leaving the page, and a changed organization context, toast nothing.
   *
   * @returns {Promise<void>} Resolves once the checkout ended.
   */
  protected async upgrade(): Promise<void> {
    const outcome: CheckoutOutcome = await this.checkout.start();
    switch (outcome) {
      case 'redirected':
        this.track(
          this.toasts.loading(
            $localize`:@@organization.billing.redirecting:Redirecting to the payment provider…`,
          ),
        );
        break;
      case 'subscribed':
        this.subscriptions.retry();
        this.track(
          this.toasts.info(
            $localize`:@@organization.billing.already-subscribed:The organization already has a paid plan`,
            {
              description: $localize`:@@organization.billing.already-subscribed-text:Its current plan is shown.`,
            },
          ),
        );
        break;
      case 'in-progress':
        this.track(
          this.toasts.error(
            $localize`:@@organization.billing.checkout-in-progress:Another payment is under way`,
            {
              description: $localize`:@@organization.billing.checkout-in-progress-text:Finish it or wait until it expires, then try again.`,
            },
          ),
        );
        break;
      case 'pending':
      case 'failed':
        this.track(
          this.toasts.error(
            $localize`:@@organization.billing.checkout-failed:The payment page could not be opened`,
            {
              description: $localize`:@@organization.billing.checkout-failed-text:Try again in a moment.`,
            },
          ),
        );
        break;
      case 'cancelled':
      case 'context-changed':
      case 'skipped':
        break;
    }
  }

  /**
   * Method showReturn
   *
   * @description
   * Toasts Stripe's return: a completed payment, whose plan the store confirms, or a cancelled
   * one. Another value toasts nothing.
   *
   * @param {string} returned - Value of `checkout`.
   */
  private showReturn(returned: string): void {
    if (returned === 'success') {
      this.track(
        this.toasts.success($localize`:@@organization.billing.checkout-success:Payment complete`, {
          description: $localize`:@@organization.billing.checkout-success-text:The new plan shows here as soon as the payment is confirmed.`,
        }),
      );
    } else if (returned === 'cancel') {
      this.track(
        this.toasts.info($localize`:@@organization.billing.checkout-cancelled:Payment cancelled`, {
          description: $localize`:@@organization.billing.checkout-cancelled-text:Your plan has not changed.`,
        }),
      );
    }
  }

  /**
   * Method track
   *
   * @description
   * Remembers a toast of the page.
   *
   * @param {string} id - Toast id.
   */
  private track(id: string): void {
    this.shownToasts.push(id);
  }

  /**
   * Method dismissToasts
   *
   * @description
   * Dismisses the toasts the page showed.
   */
  private dismissToasts(): void {
    for (const id of this.shownToasts.splice(0)) this.toasts.dismiss(id);
  }
  // #endregion
}
