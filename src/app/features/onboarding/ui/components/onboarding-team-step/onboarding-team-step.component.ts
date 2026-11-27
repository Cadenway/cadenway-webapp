import {
  booleanAttribute,
  Component,
  input,
  type InputSignalWithTransform,
  model,
  type ModelSignal,
} from '@angular/core';

import { OnboardingInviteField } from '../onboarding-invite-field/onboarding-invite-field.component';

/**
 * Component OnboardingTeamStep
 *
 * @description
 * The assistant's `Team` screen (`App.dc.html` lines 2693-2696): the shared invitation field,
 * which edits `emails` and sends nothing; the assistant invites them once the space exists. A
 * person who may not invite (`canInvite` false: neither owner nor administrator, whom
 * `inviteMembers` would refuse) gets no form, and the assistant offers `Skip`.
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
  // #endregion
}
