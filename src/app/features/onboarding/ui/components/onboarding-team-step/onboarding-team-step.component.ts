import {
  booleanAttribute,
  Component,
  input,
  type InputSignalWithTransform,
  computed,
  model,
  type ModelSignal,
  type Signal,
  viewChild,
} from '@angular/core';

import { OnboardingInviteField } from '../onboarding-invite-field/onboarding-invite-field.component';

/**
 * Component OnboardingTeamStep
 *
 * @description
 * The assistant's `Team` screen (`App.dc.html` lines 2693-2696): the shared invitation field,
 * which edits `emails` and sends nothing; the assistant invites them when it creates the space. A
 * person who may not invite (`canInvite` false: neither owner nor administrator, whom
 * `inviteMembers` would refuse) gets no form, and the assistant offers `Skip`. `hasText` and
 * `commitPending()` let the assistant keep an address typed without `Add` when it moves on.
 */
@Component({
  selector: 'cw-onboarding-team-step',
  imports: [OnboardingInviteField],
  template: `
    @if (canInvite()) {
      <cw-onboarding-invite-field [(emails)]="emails" [disabled]="disabled()" />
    }
  `,
})
export class OnboardingTeamStep {
  // #region Properties
  /**
   * Property emails
   *
   * @description
   * The addresses to invite.
   *
   * @type {ModelSignal<readonly string[]>}
   * @readonly
   */
  public readonly emails: ModelSignal<readonly string[]> = model<readonly string[]>([]);

  /**
   * Property canInvite
   *
   * @description
   * Whether the person may invite; otherwise no form shows.
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly canInvite: InputSignalWithTransform<boolean, unknown> = input<boolean, unknown>(
    false,
    { transform: booleanAttribute },
  );

  /**
   * Property disabled
   *
   * @description
   * Whether the field is disabled (while the space is being created).
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly disabled: InputSignalWithTransform<boolean, unknown> = input<boolean, unknown>(
    false,
    { transform: booleanAttribute },
  );

  /**
   * Property hasText
   *
   * @description
   * Whether an address is typed in the field and not added yet; false without a form.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  public readonly hasText: Signal<boolean> = computed(
    (): boolean => this.field()?.hasText() ?? false,
  );

  /**
   * Property field
   *
   * @description
   * The invitation field, when the form shows.
   *
   * @type {Signal<OnboardingInviteField | undefined>}
   * @readonly
   */
  private readonly field: Signal<OnboardingInviteField | undefined> =
    viewChild(OnboardingInviteField);
  // #endregion

  // #region Methods
  /**
   * Method commitPending
   *
   * @description
   * Adds the address still typed in the field, as `Add` does, before the assistant moves on.
   *
   * @returns {boolean} False when the typed address is invalid (the field then shows its error and
   * takes the focus): the assistant stays on the screen.
   */
  public commitPending(): boolean {
    return this.field()?.commitPending() ?? true;
  }
  // #endregion
}
