import {
  booleanAttribute,
  Component,
  input,
  type InputSignal,
  type InputSignalWithTransform,
  linkedSignal,
  model,
  type ModelSignal,
  output,
  type OutputEmitterRef,
  type Signal,
  viewChild,
  type WritableSignal,
} from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwDialog,
  CwDialogClose,
  CwDialogFooter,
  CwDialogHeader,
  CwDialogTitle,
  provideCwDialogLabels,
} from '@cadenway/ui/components/dialog';

import { OnboardingInviteField } from '../../components/onboarding-invite-field/onboarding-invite-field.component';

/**
 * Component OnboardingInviteDialog
 *
 * @description
 * The dialog of the checklist's `Invite a team member` item: a `cw-dialog` titled with the item's
 * label, the onboarding invitation field (`Email address`, `Add`, one pill per address), then
 * `Cancel` and `Invite`. The mockup opens the list's share dialog instead, which only grants access
 * to a list and records no invitation; this dialog sends organization invitations, as the
 * contract's `invitationSent` marker requires. Its `Invite` button is named after the share
 * dialog's (`App.dc.html` line 2987).
 *
 * Presentational: `[(open)]` opens it; the list of addresses empties and the field is created anew
 * (no text typed but not added survives) each time it opens or closes. When the host gives a new
 * `kept` list (the addresses a send left unsent), the list shows those addresses instead, so the
 * next `Invite` sends only them. `Invite`, enabled once an address is added or typed, first commits the address still
 * typed in the field (`commitPending()`, as `Add` does): an invalid one shows the field's error and
 * sends nothing. It then emits `submitted` with the addresses, and the host sends them. While `pending`, the dialog cannot be closed, the field and its pills are
 * disabled and `Invite` shows its spinner.
 */
@Component({
  selector: 'cw-onboarding-invite-dialog',
  imports: [
    CwButton,
    CwDialog,
    CwDialogClose,
    CwDialogFooter,
    CwDialogHeader,
    CwDialogTitle,
    OnboardingInviteField,
  ],
  providers: [
    provideCwDialogLabels(() => ({
      close: $localize`:@@onboarding.getting-started.invite-close:Close`,
    })),
  ],
  templateUrl: './onboarding-invite-dialog.component.html',
})
export class OnboardingInviteDialog {
  // #region Properties
  /**
   * Property open
   *
   * @description
   * Whether the dialog is open, `[(open)]`.
   *
   * @type {ModelSignal<boolean>}
   * @readonly
   */
  public readonly open: ModelSignal<boolean> = model<boolean>(false);

  /**
   * Property pending
   *
   * @description
   * Whether the invitations are being sent; false by default.
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly pending: InputSignalWithTransform<boolean, unknown> = input<boolean, unknown>(
    false,
    { transform: booleanAttribute },
  );

  /**
   * Property kept
   *
   * @description
   * The addresses a send left unsent; each new array replaces the list of addresses. Empty by
   * default.
   *
   * @type {InputSignal<readonly string[]>}
   * @readonly
   */
  public readonly kept: InputSignal<readonly string[]> = input<readonly string[]>([]);

  /**
   * Property submitted
   *
   * @description
   * Emits the addresses to invite when `Invite` is pressed.
   *
   * @type {OutputEmitterRef<readonly string[]>}
   * @readonly
   */
  public readonly submitted: OutputEmitterRef<readonly string[]> = output<readonly string[]>();

  /**
   * Property emails
   *
   * @description
   * The addresses added in the field; emptied whenever the dialog opens or closes, and replaced
   * by `kept` whenever it changes while the dialog is open.
   *
   * @type {WritableSignal<readonly string[]>}
   * @readonly
   */
  protected readonly emails: WritableSignal<readonly string[]> = linkedSignal<
    { readonly open: boolean; readonly kept: readonly string[] },
    readonly string[]
  >({
    source: () => ({ open: this.open(), kept: this.kept() }),
    computation: (source: { readonly open: boolean; readonly kept: readonly string[] }) =>
      source.open ? source.kept : [],
  });

  /**
   * Property field
   *
   * @description
   * The invitation field, to commit the address still typed in it before sending.
   *
   * @type {Signal<OnboardingInviteField | undefined>}
   * @readonly
   */
  protected readonly field: Signal<OnboardingInviteField | undefined> =
    viewChild(OnboardingInviteField);
  // #endregion

  // #region Methods
  /**
   * Method send
   *
   * @description
   * Commits the address still typed in the field, then emits the addresses; sends nothing while
   * they are being sent, when the typed address is invalid, or when no address is left.
   */
  protected send(): void {
    if (this.pending()) return;
    if (this.field()?.commitPending() === false) return;
    if (this.emails().length === 0) return;
    this.submitted.emit(this.emails());
  }
  // #endregion
}
