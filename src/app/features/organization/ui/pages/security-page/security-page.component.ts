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
  AuthenticationPolicyForm,
  AuthenticationPolicySaveOutcome,
  SessionTimeoutOption,
  TwoStepRequirement,
} from '../../../models/authentication-policy/authentication-policy.interface';
import { AuthenticationPolicyStore } from '../../../state/authentication-policy/authentication-policy.store';

/**
 * Function formOf
 *
 * @description
 * The form value of a saved policy, or nothing on or selected while none is read. A saved
 * `everyone` sets both switches, a saved `admins` the administrators' one; a requirement this
 * version does not know sets neither.
 *
 * @param {AuthenticationPolicy | null} policy - The saved policy.
 * @returns {AuthenticationPolicyForm} What the form starts from.
 */
function formOf(policy: AuthenticationPolicy | null): AuthenticationPolicyForm {
  const required: TwoStepRequirement | null = policy?.twoStepRequiredFor ?? null;
  return {
    requireAdmins: required === 'admins' || required === 'everyone',
    requireEveryone: required === 'everyone',
    sessionTimeoutMinutes: policy?.sessionTimeoutMinutes ?? null,
  };
}

/**
 * Function requirementOf
 *
 * @description
 * The two-step requirement the switches select.
 *
 * @param {AuthenticationPolicyForm} value - The form value.
 * @returns {TwoStepRequirement} `everyone`, else `admins`, else `nobody`.
 */
function requirementOf(value: AuthenticationPolicyForm): TwoStepRequirement {
  if (value.requireEveryone) return 'everyone';
  return value.requireAdmins ? 'admins' : 'nobody';
}

/**
 * Function changeBetween
 *
 * @description
 * What the form changes from the saved policy. The requirement is sent only once a switch differs
 * from what the saved policy set and the requirement it selects differs from the saved one; the
 * timeout only once another option is picked. Switching back is therefore clean, and a value a
 * later contract added stays as it is until the person changes its control.
 *
 * @param {AuthenticationPolicy | null} saved - The saved policy.
 * @param {AuthenticationPolicyForm} edited - The form value.
 * @returns {AuthenticationPolicyChange} The members that differ; empty when nothing does.
 */
function changeBetween(
  saved: AuthenticationPolicy | null,
  edited: AuthenticationPolicyForm,
): AuthenticationPolicyChange {
  if (saved === null) return {};
  const start: AuthenticationPolicyForm = formOf(saved);
  const switched: boolean =
    edited.requireAdmins !== start.requireAdmins ||
    edited.requireEveryone !== start.requireEveryone;
  const required: TwoStepRequirement = requirementOf(edited);
  return {
    ...(switched && required !== saved.twoStepRequiredFor ? { twoStepRequiredFor: required } : {}),
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
 * administrators' switch then shows on and disabled, while it keeps the person's own choice, to
 * which turning `all members` off goes back. `Save` sends only what changed, through the page's
 * `AuthenticationPolicyStore`, which asks for a recent authentication when the gateway wants one
 * and is bound to the organization shown; it is disabled while nothing changed and shows its
 * pending state while the request runs, when the controls are disabled. A save of the timeout
 * toasts `Session policy updated` with the new timeout, a save of the two-step requirement alone
 * `Two-step verification policy updated`; a stale version toasts the conflict and shows the latest
 * policy; requiring two-step verification of one's own role without having it toasts why; any
 * other refusal toasts the failure and keeps the edits. Closing the reauthentication dialog, a
 * switch to another organization, leaving the page and a changed organization context keep them
 * silently.
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
   * The form value, reset to the saved policy whenever a read or a save replaces it, an
   * organization switch included.
   *
   * @type {WritableSignal<AuthenticationPolicyForm>}
   * @readonly
   */
  private readonly model: WritableSignal<AuthenticationPolicyForm> = linkedSignal(
    (): AuthenticationPolicyForm => formOf(this.store.current()),
  );

  /**
   * Property policyForm
   *
   * @description
   * The card's form; its controls are disabled while a save runs.
   *
   * @type {FieldTree<AuthenticationPolicyForm>}
   * @readonly
   */
  protected readonly policyForm: FieldTree<AuthenticationPolicyForm> = form(this.model, (path) => {
    disabled(path.sessionTimeoutMinutes, { when: (): boolean => this.store.saving() });
  });

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
    (): boolean => this.model().requireEveryone,
  );

  /**
   * Property requiredForAdmins
   *
   * @description
   * Whether `Require two-step verification for administrators` shows on: the person's choice, or
   * on while `everyone` implies it, without changing that choice.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly requiredForAdmins: Signal<boolean> = computed((): boolean => {
    const value: AuthenticationPolicyForm = this.model();
    return value.requireAdmins || value.requireEveryone;
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
   * Records the administrators' choice; the switch is disabled while every member is required.
   *
   * @param {boolean} required - The switch's new state.
   */
  protected requireForAdmins(required: boolean): void {
    this.policyForm.requireAdmins().value.set(required);
  }

  /**
   * Method requireForEveryone
   *
   * @description
   * Turns every member's requirement on or off; off goes back to the administrators' choice.
   *
   * @param {boolean} required - The switch's new state.
   */
  protected requireForEveryone(required: boolean): void {
    this.policyForm.requireEveryone().value.set(required);
  }

  /**
   * Method cancel
   *
   * @description
   * Drops the edits and shows the saved policy again.
   */
  protected cancel(): void {
    this.model.set(formOf(this.store.current()));
  }

  /**
   * Method save
   *
   * @description
   * Sends the change and toasts its outcome. A cancelled save (the reauthentication dialog
   * closed, the organization switched, the page left) and a changed organization context, which
   * the workspace recovery handles, toast nothing and keep the edits.
   *
   * @returns {Promise<void>} Resolves once the save ended.
   */
  protected async save(): Promise<void> {
    const change: AuthenticationPolicyChange = this.change();
    const outcome: AuthenticationPolicySaveOutcome = await this.store.save(change);
    switch (outcome) {
      case 'saved':
        this.toastSaved(change);
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
      case 'context-changed':
      case 'skipped':
        break;
    }
  }

  /**
   * Method toastSaved
   *
   * @description
   * The success toast. A change of the timeout gets the mockup's toast naming the new timeout; a
   * change of the two-step requirement alone gets `Two-step verification policy updated`, which
   * the mockup does not draw.
   *
   * @param {AuthenticationPolicyChange} change - What the save sent.
   */
  private toastSaved(change: AuthenticationPolicyChange): void {
    const minutes: AuthenticationPolicyChange['sessionTimeoutMinutes'] =
      change.sessionTimeoutMinutes;
    if (minutes === undefined) {
      this.toasts.success(
        $localize`:@@organization.security.two-step-saved:Two-step verification policy updated`,
      );
      return;
    }
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
