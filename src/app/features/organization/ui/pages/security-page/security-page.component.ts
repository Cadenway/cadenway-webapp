import {
  Component,
  computed,
  inject,
  linkedSignal,
  type Signal,
  viewChild,
  type WritableSignal,
} from '@angular/core';
import { disabled, type FieldTree, form, FormField } from '@angular/forms/signals';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwCard,
  CwCardContent,
  CwCardFooter,
  CwCardHeader,
  CwCardTitle,
} from '@cadenway/ui/components/card';
import { CwSelect, CwSelectOption } from '@cadenway/ui/components/select';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwSwitch } from '@cadenway/ui/components/switch';
import { CwToastService } from '@cadenway/ui/components/toast';

import { DiscardChangesDialog } from '@features/workspace/ui/dialogs/discard-changes-dialog';
import { type UnsavedChanges, warnBeforeUnload } from '@shared/unsaved-changes';

import type {
  AuthenticationPolicy,
  AuthenticationPolicyChange,
  AuthenticationPolicySaveOutcome,
  AuthenticationPolicySettings,
  SessionTimeoutOption,
} from '../../../models/authentication-policy/authentication-policy.interface';
import { AuthenticationPolicyStore } from '../../../state/authentication-policy/authentication-policy.store';

/**
 * Function settingsOf
 *
 * @description
 * The editable part of a policy, or nothing selected while none is read.
 *
 * @param {AuthenticationPolicy | null} policy - The saved policy.
 * @returns {AuthenticationPolicySettings} What the form starts from.
 */
function settingsOf(policy: AuthenticationPolicy | null): AuthenticationPolicySettings {
  return {
    twoStepRequiredFor: policy?.twoStepRequiredFor ?? null,
    sessionTimeoutMinutes: policy?.sessionTimeoutMinutes ?? null,
  };
}

/**
 * Function changeBetween
 *
 * @description
 * What the edited settings change from the saved policy. A value still unknown (null) is never
 * sent, so a value a later contract added stays as it is until the person picks another one.
 *
 * @param {AuthenticationPolicy | null} saved - The saved policy.
 * @param {AuthenticationPolicySettings} edited - The form's settings.
 * @returns {AuthenticationPolicyChange} The members that differ; empty when nothing does.
 */
function changeBetween(
  saved: AuthenticationPolicy | null,
  edited: AuthenticationPolicySettings,
): AuthenticationPolicyChange {
  if (saved === null) return {};
  return {
    ...(edited.twoStepRequiredFor !== null && edited.twoStepRequiredFor !== saved.twoStepRequiredFor
      ? { twoStepRequiredFor: edited.twoStepRequiredFor }
      : {}),
    ...(edited.sessionTimeoutMinutes !== null &&
    edited.sessionTimeoutMinutes !== saved.sessionTimeoutMinutes
      ? { sessionTimeoutMinutes: edited.sessionTimeoutMinutes }
      : {}),
  };
}

/**
 * Component SecurityPage
 *
 * @description
 * The organization settings section `Security and SSO` (mockup `Organisation.dc.html` lines
 * 437-491, logic lines 1958-1977), for the owner and administrators. It shows the part the
 * contract serves, the `Authentication policy` card: `Require two-step verification for
 * administrators`, `Require it for all members` (its hint counts the people without two-step
 * verification) and the `Idle session timeout` select (12 hours, 1 hour, 7 days, 30 days, in the
 * mockup's order). The SAML card, `Test connection`, `Enforce SSO` and the allowed sign-in methods
 * have no contract yet (gap B13) and are not rendered.
 *
 * The mockup applies each control at once; here the card is a form with the `Unsaved changes`
 * footer, `Cancel` and `Save`. Requiring it for every member implies the administrators: the
 * administrators' switch then stays on and disabled, and turning `all members` off keeps the
 * administrators. `Save` sends only what changed, through the page's `AuthenticationPolicyStore`,
 * which asks for a recent authentication when the gateway wants one; it is disabled while nothing
 * changed and shows its pending state while the request runs, when the controls are disabled.
 * A save toasts `Session policy updated`; a stale version toasts the conflict and shows the latest
 * policy; requiring two-step verification of one's own role without having it toasts why; any
 * other refusal toasts the failure and keeps the edits; closing the reauthentication dialog keeps
 * them silently.
 *
 * While the policy loads, a skeleton of the card shows (`Loading the section`); a failed read
 * reaches the route's error boundary, whose `Retry` runs the route again. The route guards the
 * unsaved edits with `unsavedChangesGuard`, which asks through `cw-discard-changes-dialog`, and the
 * page asks the browser to confirm closing or reloading the tab while they last.
 */
@Component({
  selector: 'cw-organization-security-page',
  imports: [
    CwButton,
    CwCard,
    CwCardContent,
    CwCardFooter,
    CwCardHeader,
    CwCardTitle,
    CwSelect,
    CwSelectOption,
    CwSkeleton,
    CwSwitch,
    DiscardChangesDialog,
    FormField,
  ],
  providers: [AuthenticationPolicyStore],
  templateUrl: './security-page.component.html',
})
export class SecurityPage implements UnsavedChanges {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * The organization's authentication policy and its save.
   *
   * @type {InstanceType<typeof AuthenticationPolicyStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof AuthenticationPolicyStore> =
    inject(AuthenticationPolicyStore);

  /**
   * Property toasts
   *
   * @description
   * Toasts of the settings shell, for the outcome of a save.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property discard
   *
   * @description
   * The confirmation shown before unsaved edits are lost.
   *
   * @type {Signal<DiscardChangesDialog>}
   * @readonly
   */
  private readonly discard: Signal<DiscardChangesDialog> = viewChild.required(DiscardChangesDialog);

  /**
   * Property timeouts
   *
   * @description
   * The options of the `Idle session timeout` select, in the mockup's order (`SESSION_OPTS`).
   *
   * @type {readonly SessionTimeoutOption[]}
   * @readonly
   */
  protected readonly timeouts: readonly SessionTimeoutOption[] = [
    { minutes: 720, label: $localize`:@@organization.security.timeout-12-hours:12 hours` },
    { minutes: 60, label: $localize`:@@organization.security.timeout-1-hour:1 hour` },
    { minutes: 10080, label: $localize`:@@organization.security.timeout-7-days:7 days` },
    { minutes: 43200, label: $localize`:@@organization.security.timeout-30-days:30 days` },
  ];

  /**
   * Property model
   *
   * @description
   * The edited settings, reset to the saved policy whenever a read or a save replaces it.
   *
   * @type {WritableSignal<AuthenticationPolicySettings>}
   * @readonly
   */
  private readonly model: WritableSignal<AuthenticationPolicySettings> = linkedSignal(
    (): AuthenticationPolicySettings => settingsOf(this.store.current()),
  );

  /**
   * Property policyForm
   *
   * @description
   * The card's form; its controls are disabled while a save runs.
   *
   * @type {FieldTree<AuthenticationPolicySettings>}
   * @readonly
   */
  protected readonly policyForm: FieldTree<AuthenticationPolicySettings> = form(
    this.model,
    (path) => {
      disabled(path.sessionTimeoutMinutes, { when: (): boolean => this.store.saving() });
    },
  );

  /**
   * Property change
   *
   * @description
   * What a save would send.
   *
   * @type {Signal<AuthenticationPolicyChange>}
   * @readonly
   */
  private readonly change: Signal<AuthenticationPolicyChange> = computed(
    (): AuthenticationPolicyChange => changeBetween(this.store.current(), this.model()),
  );

  /**
   * Property dirty
   *
   * @description
   * Whether the edits differ from the saved policy; switching a control back makes it clean.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly dirty: Signal<boolean> = computed(
    (): boolean => Object.keys(this.change()).length > 0,
  );

  /**
   * Property requiredForEveryone
   *
   * @description
   * Whether `Require it for all members` is on.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly requiredForEveryone: Signal<boolean> = computed(
    (): boolean => this.model().twoStepRequiredFor === 'everyone',
  );

  /**
   * Property requiredForAdmins
   *
   * @description
   * Whether `Require two-step verification for administrators` is on, which `everyone` implies.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly requiredForAdmins: Signal<boolean> = computed((): boolean => {
    const required: AuthenticationPolicySettings['twoStepRequiredFor'] =
      this.model().twoStepRequiredFor;
    return required === 'admins' || required === 'everyone';
  });
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Asks the browser to confirm leaving the tab while edits are unsaved.
   *
   * @constructor
   */
  public constructor() {
    warnBeforeUnload((): boolean => this.dirty());
  }
  // #endregion

  // #region Methods
  /**
   * Method hasUnsavedChanges
   *
   * @description
   * Whether leaving would lose edits.
   *
   * @returns {boolean} True while the card differs from the saved policy.
   */
  public hasUnsavedChanges(): boolean {
    return this.dirty();
  }

  /**
   * Method confirmDiscard
   *
   * @description
   * Asks whether to discard the unsaved edits.
   *
   * @returns {Promise<boolean>} Resolves true on `Discard`, false on `Keep editing`.
   */
  public confirmDiscard(): Promise<boolean> {
    return this.discard().ask();
  }

  /**
   * Method everyoneHint
   *
   * @description
   * The hint of `Require it for all members`, counting the people without two-step verification
   * as the mockup does (`Organisation.dc.html` line 1966).
   *
   * @param {number} count - People without two-step verification, guests included.
   * @returns {string} The hint.
   */
  protected everyoneHint(count: number): string {
    if (count === 0) {
      return $localize`:@@organization.security.two-step-everyone-hint-none:Everyone has already set it up.`;
    }
    if (count === 1) {
      return $localize`:@@organization.security.two-step-everyone-hint-one:1 person has not set it up: they will have to at their next sign-in.`;
    }
    return $localize`:@@organization.security.two-step-everyone-hint-many:${count}:count: people have not set it up: they will have to at their next sign-in.`;
  }

  /**
   * Method requireForAdmins
   *
   * @description
   * Turns the administrators' requirement on or off; it is disabled while every member is
   * required.
   *
   * @param {boolean} required - The switch's new state.
   */
  protected requireForAdmins(required: boolean): void {
    this.policyForm.twoStepRequiredFor().value.set(required ? 'admins' : 'nobody');
  }

  /**
   * Method requireForEveryone
   *
   * @description
   * Turns every member's requirement on or off; off keeps the administrators' requirement it
   * implied.
   *
   * @param {boolean} required - The switch's new state.
   */
  protected requireForEveryone(required: boolean): void {
    this.policyForm.twoStepRequiredFor().value.set(required ? 'everyone' : 'admins');
  }

  /**
   * Method cancel
   *
   * @description
   * Drops the edits and shows the saved policy again.
   */
  protected cancel(): void {
    this.model.set(settingsOf(this.store.current()));
  }

  /**
   * Method save
   *
   * @description
   * Sends the change and toasts its outcome.
   *
   * @returns {Promise<void>} Resolves once the save ended.
   */
  protected async save(): Promise<void> {
    const outcome: AuthenticationPolicySaveOutcome = await this.store.save(this.change());
    switch (outcome) {
      case 'saved':
        this.toastSaved();
        break;
      case 'outdated':
        this.toasts.error(
          $localize`:@@organization.security.conflict:The policy changed in the meantime`,
          {
            description: $localize`:@@organization.security.conflict-text:Its latest version is shown.`,
          },
        );
        break;
      case 'two-step-not-enabled':
        this.toasts.error(
          $localize`:@@organization.security.two-step-not-enabled:Set up two-step verification first`,
          {
            description: $localize`:@@organization.security.two-step-not-enabled-text:You cannot require it for your own role before using it yourself.`,
          },
        );
        break;
      case 'failed':
        this.toasts.error(
          $localize`:@@organization.security.save-failed:The authentication policy could not be saved`,
        );
        break;
      case 'cancelled':
      case 'skipped':
        break;
    }
  }

  /**
   * Method toastSaved
   *
   * @description
   * The mockup's success toast, naming the timeout now applied.
   */
  private toastSaved(): void {
    const minutes: AuthenticationPolicySettings['sessionTimeoutMinutes'] =
      this.store.current()?.sessionTimeoutMinutes ?? null;
    const timeout: string | undefined = this.timeouts.find(
      (option: SessionTimeoutOption): boolean => option.minutes === minutes,
    )?.label;
    this.toasts.success(
      $localize`:@@organization.security.saved:Session policy updated`,
      timeout === undefined
        ? {}
        : {
            description: $localize`:@@organization.security.saved-text:Idle sessions now expire after ${timeout}:timeout:.`,
          },
    );
  }
  // #endregion
}
