import {
  afterNextRender,
  Component,
  computed,
  effect,
  inject,
  Injector,
  signal,
  type Signal,
  untracked,
  type WritableSignal,
} from '@angular/core';
import {
  type FieldTree,
  form,
  FormField,
  pattern,
  required,
  submit,
  type ValidationError,
} from '@angular/forms/signals';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwDialog,
  CwDialogDescription,
  CwDialogFooter,
  CwDialogHeader,
  CwDialogTitle,
  provideCwDialogLabels,
} from '@cadenway/ui/components/dialog';
import { CwInput } from '@cadenway/ui/components/input';
import {
  CwInputOtp,
  CwInputOtpGroup,
  CwInputOtpSeparator,
  CwInputOtpSlot,
  provideCwInputOtpLabels,
} from '@cadenway/ui/components/input-otp';
import { NgIcon } from '@ng-icons/core';

import type {
  ReauthenticationMethod,
  ReauthenticationPrompt,
} from '../../../models/reauthentication/reauthentication.interface';
import { ReauthenticationService } from '../../../reauthentication/reauthentication.service';

/**
 * Interface PasswordModel
 *
 * @description
 * Value of the password form.
 */
interface PasswordModel {
  // #region Properties
  /**
   * Property password
   *
   * @description
   * The current password.
   *
   * @type {string}
   */
  password: string;
  // #endregion
}

/**
 * Interface CodeModel
 *
 * @description
 * Value of the authenticator code form.
 */
interface CodeModel {
  // #region Properties
  /**
   * Property code
   *
   * @description
   * The 6 digits the authenticator app shows.
   *
   * @type {string}
   */
  code: string;
  // #endregion
}

/**
 * Function focusFirstError
 *
 * @description
 * Moves focus to the first invalid field after an invalid submit.
 *
 * @template T
 * @param {FieldTree<T>} fields - The submitted form.
 */
function focusFirstError<T>(fields: FieldTree<T>): void {
  const first: ValidationError.WithFieldTree | undefined = fields().errorSummary().at(0);
  first?.fieldTree().focusBoundControl();
}

/**
 * Component ReauthenticationDialog
 *
 * @description
 * The dialog `ReauthenticationService` opens when a guarded operation needs a recent
 * authentication: `Confirm it's you`, then the current password, or the 6-digit code of the
 * authenticator app for an account with two-step verification, with `Cancel` and `Confirm`. The
 * mockup draws no such dialog, so its copy is the application's own. Submit stays enabled while
 * the field is invalid: an invalid submit shows the error and focuses the field; while the answer
 * is checked it shows its spinner (`loading`, so it keeps focus) and the dialog cannot be closed.
 * A refused answer shows its reason under the field (wrong password or code with the attempts
 * left, 15-minute lockout, gateway unavailable), empties the field and focuses it again. Closing it (`Cancel`, Escape, the close
 * button) cancels the waiting operation. It is a settings shell `overlays` contribution.
 */
@Component({
  selector: 'cw-reauthentication-dialog',
  imports: [
    CwButton,
    CwDialog,
    CwDialogDescription,
    CwDialogFooter,
    CwDialogHeader,
    CwDialogTitle,
    CwInput,
    CwInputOtp,
    CwInputOtpGroup,
    CwInputOtpSeparator,
    CwInputOtpSlot,
    FormField,
    NgIcon,
  ],
  providers: [
    provideCwDialogLabels(() => ({ close: $localize`:@@account.reauthentication.close:Close` })),
    provideCwInputOtpLabels(() => ({
      ariaLabel: $localize`:@@account.reauthentication.code-label:Authentication code`,
    })),
  ],
  templateUrl: './reauthentication-dialog.component.html',
})
export class ReauthenticationDialog {
  // #region Properties
  /**
   * Property reauthentication
   *
   * @description
   * The question and the answer of the waiting operation.
   *
   * @type {ReauthenticationService}
   * @readonly
   */
  private readonly reauthentication: ReauthenticationService = inject(ReauthenticationService);

  /**
   * Property prompt
   *
   * @description
   * The question shown, or null while the dialog is closed.
   *
   * @type {Signal<ReauthenticationPrompt | null>}
   * @readonly
   */
  protected readonly prompt: Signal<ReauthenticationPrompt | null> = this.reauthentication.prompt;

  /**
   * Property method
   *
   * @description
   * What the dialog asks for, the password by default.
   *
   * @type {Signal<ReauthenticationMethod>}
   * @readonly
   */
  protected readonly method: Signal<ReauthenticationMethod> = computed(
    (): ReauthenticationMethod => this.prompt()?.method ?? 'password',
  );

  /**
   * Property passwordModel
   *
   * @description
   * Value of the password form.
   *
   * @type {WritableSignal<PasswordModel>}
   * @readonly
   */
  private readonly passwordModel: WritableSignal<PasswordModel> = signal({ password: '' });

  /**
   * Property codeModel
   *
   * @description
   * Value of the code form.
   *
   * @type {WritableSignal<CodeModel>}
   * @readonly
   */
  private readonly codeModel: WritableSignal<CodeModel> = signal({ code: '' });

  /**
   * Property passwordForm
   *
   * @description
   * The password form; the password is required.
   *
   * @type {FieldTree<PasswordModel>}
   * @readonly
   */
  protected readonly passwordForm: FieldTree<PasswordModel> = form(this.passwordModel, (path) => {
    required(path.password, {
      message: $localize`:@@account.reauthentication.password-required:Enter your password.`,
    });
  });

  /**
   * Property codeForm
   *
   * @description
   * The code form; the code is 6 digits.
   *
   * @type {FieldTree<CodeModel>}
   * @readonly
   */
  protected readonly codeForm: FieldTree<CodeModel> = form(this.codeModel, (path) => {
    const message: string = $localize`:@@account.reauthentication.code-required:Enter the 6 digits of the code.`;
    required(path.code, { message });
    pattern(path.code, /^\d{6}$/u, { message });
  });

  /**
   * Property injector
   *
   * @description
   * Injector scheduling the focus move after a refusal is rendered.
   *
   * @type {Injector}
   * @readonly
   */
  private readonly injector: Injector = inject(Injector);
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Empties both forms when a new question opens or an answer is refused, and once a checked
   * answer is refused, moves focus back to the field, which may be the other method's.
   *
   * @constructor
   */
  public constructor() {
    let checking: boolean = false;
    effect((): void => {
      const prompt: ReauthenticationPrompt | null = this.prompt();
      if (prompt?.pending === true) {
        checking = true;
        return;
      }
      const refused: boolean = checking && prompt !== null;
      checking = false;
      untracked((): void => {
        this.passwordForm().reset({ password: '' });
        this.codeForm().reset({ code: '' });
        if (!refused) return;
        afterNextRender(
          (): void => {
            if (this.method() === 'code') this.codeForm.code().focusBoundControl();
            else this.passwordForm.password().focusBoundControl();
          },
          { injector: this.injector },
        );
      });
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method send
   *
   * @description
   * Submits the field of the current method, or shows its error and focuses it.
   *
   * @param {Event} event - The form submission.
   * @returns {Promise<void>} Resolves once the answer is checked.
   */
  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    if (this.prompt()?.pending === true) return;
    if (this.method() === 'code') {
      await submit(this.codeForm, {
        action: () => this.reauthentication.answer({ code: this.codeModel().code }),
        onInvalid: (fields: FieldTree<CodeModel>) => {
          focusFirstError(fields);
        },
      });
      return;
    }
    await submit(this.passwordForm, {
      action: () => this.reauthentication.answer({ password: this.passwordModel().password }),
      onInvalid: (fields: FieldTree<PasswordModel>) => {
        focusFirstError(fields);
      },
    });
  }

  /**
   * Method openChanged
   *
   * @description
   * Cancels the waiting operation when the dialog closes itself (Escape, the close button).
   *
   * @param {boolean} open - The dialog's new open state.
   */
  protected openChanged(open: boolean): void {
    if (!open) this.reauthentication.cancel();
  }

  /**
   * Method cancel
   *
   * @description
   * Cancels the waiting operation from the `Cancel` button.
   */
  protected cancel(): void {
    this.reauthentication.cancel();
  }
  // #endregion
}
