import {
  Component,
  effect,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  signal,
  type WritableSignal,
} from '@angular/core';
import { type FieldTree, form, FormField, pattern, required, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwInputOtp,
  CwInputOtpGroup,
  CwInputOtpSeparator,
  CwInputOtpSlot,
} from '@cadenway/ui/components/input-otp';
import { NgIcon } from '@ng-icons/core';

import { focusFirstError } from '../../../utils/form-focus/form-focus.util';

/**
 * Component CodeForm
 *
 * @description
 * The 6-digit e-mail code form of `Otp.dc.html`, shared by `/login/code` and `/signup/verify`:
 * `Verification code` in two groups of three, the submit button (disabled until six digits),
 * `Resend the code` with its countdown, `Change the address` and the `New code sent`
 * status. It emits the code; the page sends it and passes back `error` (shown under the code and
 * clearing it) and `busy`.
 */
@Component({
  selector: 'cw-code-form',
  imports: [
    CwButton,
    CwInputOtp,
    CwInputOtpGroup,
    CwInputOtpSeparator,
    CwInputOtpSlot,
    FormField,
    NgIcon,
    RouterLink,
  ],
  templateUrl: './code-form.component.html',
})
export class CodeForm {
  // #region Properties
  /**
   * Property submitLabel
   *
   * @description
   * Label of the submit button (`Sign in`, `Confirm my address`).
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly submitLabel: InputSignal<string> = input.required<string>();

  /**
   * Property backLink
   *
   * @description
   * Path of `Change the address`.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly backLink: InputSignal<string> = input.required<string>();

  /**
   * Property resendIn
   *
   * @description
   * Seconds left before a resend as `m:ss`, or null when resending is available.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly resendIn: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property resent
   *
   * @description
   * Whether a new code was sent, which shows the status line.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly resent: InputSignal<boolean> = input(false);

  /**
   * Property error
   *
   * @description
   * Refusal of the last code, or null.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly error: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property busy
   *
   * @description
   * Whether the page is checking a code.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly busy: InputSignal<boolean> = input(false);

  /**
   * Property codeSubmitted
   *
   * @description
   * The six digits the person submitted.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly codeSubmitted: OutputEmitterRef<string> = output<string>();

  /**
   * Property resendRequested
   *
   * @description
   * The person asked for a new code.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly resendRequested: OutputEmitterRef<void> = output();

  /**
   * Property model
   *
   * @description
   * The typed code.
   *
   * @type {WritableSignal<{ code: string }>}
   * @readonly
   */
  private readonly model: WritableSignal<{ code: string }> = signal({ code: '' });

  /**
   * Property codeForm
   *
   * @description
   * Requires six digits.
   *
   * @type {FieldTree<{ code: string }>}
   * @readonly
   */
  protected readonly codeForm: FieldTree<{ code: string }> = form(this.model, (path) => {
    required(path.code);
    pattern(path.code, /^\d{6}$/u);
  });
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Clears the code and focuses it again when a refusal arrives.
   *
   * @constructor
   */
  public constructor() {
    effect(() => {
      if (this.error() === null) return;
      this.model.set({ code: '' });
      this.codeForm.code().focusBoundControl();
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method send
   *
   * @description
   * Emits a complete code.
   *
   * @param {Event} event - The submit event.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    await submit(this.codeForm, {
      action: () => {
        this.codeSubmitted.emit(this.model().code);
        return Promise.resolve(undefined);
      },
      onInvalid: (fields: FieldTree<{ code: string }>) => {
        focusFirstError(fields);
      },
    });
  }
  // #endregion
}
