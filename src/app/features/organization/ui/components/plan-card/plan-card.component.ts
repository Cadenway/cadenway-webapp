import {
  Component,
  computed,
  input,
  type InputSignal,
  type InputSignalWithTransform,
  booleanAttribute,
  output,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import { NgIcon } from '@ng-icons/core';

import type { OrganizationSubscription } from '../../../models/organization-subscription/organization-subscription.interface';
import { planName } from '../../../utils/plan-label/plan-label.util';

/**
 * Component PlanCard
 *
 * @description
 * The plan card of the `Billing` section (mockup `Organisation.dc.html` lines 323-340), limited to
 * what Billing serves: the `<plan> plan` title and the `Seats` tile, `<used> / <limit>` with
 * `<n> available`. The interval badge, `Manage seats`, the price and renewal line, the next
 * invoice, the payment method and the billing details have no contract yet (gap B14) and are not
 * rendered. On the Free plan the card offers `Upgrade to the Team plan`, which emits
 * `upgradeRequested` and shows its pending state while `upgrading`. Below 640 px the button
 * drops under the title.
 */
@Component({
  selector: 'cw-plan-card',
  imports: [CwButton, NgIcon],
  templateUrl: './plan-card.component.html',
})
export class PlanCard {
  // #region Properties
  /**
   * Property subscription
   *
   * @description
   * The organization's plan and seats.
   *
   * @type {InputSignal<OrganizationSubscription>}
   * @readonly
   */
  public readonly subscription: InputSignal<OrganizationSubscription> =
    input.required<OrganizationSubscription>();

  /**
   * Property upgrading
   *
   * @description
   * Whether the checkout of the upgrade is under way.
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly upgrading: InputSignalWithTransform<boolean, unknown> = input(false, {
    transform: booleanAttribute,
  });

  /**
   * Property upgradeRequested
   *
   * @description
   * Emits when the owner asks to upgrade from Free to Team.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly upgradeRequested: OutputEmitterRef<void> = output();

  /**
   * Property title
   *
   * @description
   * The card's title (`Team plan`).
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly title: Signal<string> = computed(
    (): string =>
      $localize`:@@organization.billing.plan-title:${planName(this.subscription().plan)}:plan: plan`,
  );

  /**
   * Property upgradable
   *
   * @description
   * Whether the plan is Free, the only one Checkout upgrades.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly upgradable: Signal<boolean> = computed(
    (): boolean => this.subscription().plan === 'free',
  );

  /**
   * Property upgradeLabel
   *
   * @description
   * The upgrade button's text.
   *
   * @type {string}
   * @readonly
   */
  protected readonly upgradeLabel: string = $localize`:@@organization.billing.upgrade:Upgrade to the ${planName('team')}:plan: plan`;

  /**
   * Property seatsFree
   *
   * @description
   * The seats still free (`7 available`), never below zero.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly seatsFree: Signal<string> = computed((): string => {
    const free: number = Math.max(
      0,
      this.subscription().seatsLimit - this.subscription().seatsUsed,
    );
    return free === 1
      ? $localize`:@@organization.billing.seats-free-one:1 available`
      : $localize`:@@organization.billing.seats-free:${free}:count: available`;
  });
  // #endregion
}
