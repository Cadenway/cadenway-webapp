import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import { CwAlert, CwAlertDescription, CwAlertTitle } from '@cadenway/ui/components/alert';
import { CwBadge } from '@cadenway/ui/components/badge';
import { CwButton } from '@cadenway/ui/components/button';
import { CwCard, CwCardAction, CwCardHeader } from '@cadenway/ui/components/card';
import { NgIcon } from '@ng-icons/core';

import type { SecurityAction } from '../../../models/two-step/security-overview.interface';
import type {
  SecurityKey,
  TwoStepOverview,
  TwoStepRequirement,
} from '../../../models/two-step/two-step.interface';
import { SecurityKeyList } from '../security-key-list/security-key-list.component';

/**
 * Interface CardOrganization
 *
 * @description
 * The workspace organization, which the requirement line names.
 */
export interface CardOrganization {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the organization.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Its name.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;
  // #endregion
}

/**
 * Component TwoStepCard
 *
 * @description
 * The `Two-step verification` card of the `Security and sign-in` section (`Compte.dc.html` lines
 * 279-314): the `Enabled` / `Disabled` badge and `Turn off` / `Turn on`, then the requirement
 * of the workspace organization (`Required by Atelier Nord for owners and administrators.`, or
 * for all members, or without a role for a requirement a later contract adds) and a count of the
 * other organizations requiring it. While a requirement is listed, `Turn off` is disabled and
 * described by that line, since the gateway refuses it. When on, three rows: the authenticator
 * app (`Configured on …`, ` · primary method` when it is) with `Reconfigure`; the security keys
 * (their count and names, the list with `Remove`, and `Add a key`); without WebAuthn
 * (`keysSupported`) only `Add a key` is left out, so registered keys can still be removed, and the
 * row shows only when keys exist; the backup codes left with `Generate new codes`. When off, a
 * grenat alert says only a password protects the account, and asks to set it up now when the
 * workspace organization requires it. The button of the write under way (`busy`) spins and the
 * others are disabled meanwhile. It only emits.
 */
@Component({
  selector: 'cw-two-step-card',
  imports: [
    CwAlert,
    CwAlertDescription,
    CwAlertTitle,
    CwBadge,
    CwButton,
    CwCard,
    CwCardAction,
    CwCardHeader,
    DatePipe,
    NgIcon,
    SecurityKeyList,
  ],
  templateUrl: './two-step-card.component.html',
})
export class TwoStepCard {
  // #region Properties
  /**
   * Property twoStep
   *
   * @description
   * The two-step verification of the account.
   *
   * @type {InputSignal<TwoStepOverview>}
   * @readonly
   */
  public readonly twoStep: InputSignal<TwoStepOverview> = input.required<TwoStepOverview>();

  /**
   * Property organization
   *
   * @description
   * The workspace organization.
   *
   * @type {InputSignal<CardOrganization>}
   * @readonly
   */
  public readonly organization: InputSignal<CardOrganization> = input.required<CardOrganization>();

  /**
   * Property keysSupported
   *
   * @description
   * Whether this browser can register security keys.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly keysSupported: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property busy
   *
   * @description
   * The section's write under way, or null.
   *
   * @type {InputSignal<SecurityAction | null>}
   * @readonly
   */
  public readonly busy: InputSignal<SecurityAction | null> = input<SecurityAction | null>(null);

  /**
   * Property busyId
   *
   * @description
   * The key that write acts on, or null.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly busyId: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property enableRequested
   *
   * @description
   * Emits on `Turn on`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly enableRequested: OutputEmitterRef<void> = output();

  /**
   * Property disableRequested
   *
   * @description
   * Emits on `Turn off`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly disableRequested: OutputEmitterRef<void> = output();

  /**
   * Property reconfigureRequested
   *
   * @description
   * Emits on `Reconfigure`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly reconfigureRequested: OutputEmitterRef<void> = output();

  /**
   * Property addKeyRequested
   *
   * @description
   * Emits on `Add a key`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly addKeyRequested: OutputEmitterRef<void> = output();

  /**
   * Property removeKeyRequested
   *
   * @description
   * Emits the key whose `Remove` was clicked.
   *
   * @type {OutputEmitterRef<SecurityKey>}
   * @readonly
   */
  public readonly removeKeyRequested: OutputEmitterRef<SecurityKey> = output<SecurityKey>();

  /**
   * Property backupCodesRequested
   *
   * @description
   * Emits on `Generate new codes`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly backupCodesRequested: OutputEmitterRef<void> = output();

  /**
   * Property ownRequirement
   *
   * @description
   * The workspace organization's requirement, or null.
   *
   * @type {Signal<TwoStepRequirement | null>}
   * @readonly
   */
  protected readonly ownRequirement: Signal<TwoStepRequirement | null> = computed(
    (): TwoStepRequirement | null =>
      this.twoStep().requiredBy.find(
        (requirement: TwoStepRequirement): boolean =>
          requirement.organizationId === this.organization().id,
      ) ?? null,
  );

  /**
   * Property otherRequirements
   *
   * @description
   * How many other organizations require it.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly otherRequirements: Signal<number> = computed(
    (): number =>
      this.twoStep().requiredBy.filter(
        (requirement: TwoStepRequirement): boolean =>
          requirement.organizationId !== this.organization().id,
      ).length,
  );

  /**
   * Property keyNames
   *
   * @description
   * The keys' names, joined for the row's description.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly keyNames: Signal<string> = computed((): string =>
    this.twoStep()
      .securityKeys.map((key: SecurityKey): string => key.name)
      .join(', '),
  );
  // #endregion
}
