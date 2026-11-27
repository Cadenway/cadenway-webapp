import {
  afterRenderEffect,
  Component,
  computed,
  effect,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  type Signal,
  signal,
  untracked,
  type WritableSignal,
} from '@angular/core';
import { type FieldTree, form, FormField, pattern, required, submit } from '@angular/forms/signals';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwDialog,
  CwDialogDescription,
  CwDialogFooter,
  CwDialogHeader,
  CwDialogTitle,
} from '@cadenway/ui/components/dialog';
import {
  CwInputOtp,
  CwInputOtpGroup,
  CwInputOtpSeparator,
  CwInputOtpSlot,
} from '@cadenway/ui/components/input-otp';
import { NgIcon } from '@ng-icons/core';

import type { BackupCodeSet } from '../../../models/two-step/two-step.interface';

/**
 * Type SetupStep
 *
 * @description
 * The step shown: 1 the key, 2 the code, 3 the first backup codes.
 *
 * @type {1 | 2 | 3}
 */
type SetupStep = 1 | 2 | 3;

/**
 * Interface CodeModel
 *
 * @description
 * Value of the code form.
 */
interface CodeModel {
  // #region Properties
  /**
   * Property code
   *
   * @description
   * The 6 digits the app shows.
   *
   * @type {string}
   */
  code: string;
  // #endregion
}

/**
 * Interface StepLabel
 *
 * @description
 * A step of the progress bars.
 */
interface StepLabel {
  // #region Properties
  /**
   * Property step
   *
   * @description
   * Its number.
   *
   * @type {SetupStep}
   * @readonly
   */
  readonly step: SetupStep;

  /**
   * Property label
   *
   * @description
   * Its name.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;
  // #endregion
}

/**
 * Component AuthenticatorSetupDialog
 *
 * @description
 * The `Set up the authenticator app` dialog (`Compte.dc.html` lines 637-682), `Step N of 3` with
 * the bars `Scan`, `Verify` and `Backup codes`. The design system has no QR code brick yet, so
 * step 1 shows the key only, grouped by 4, with `Copy the key` (`copyKeyRequested`); `Continue`
 * moves to step 2, the 6-digit code (`The code changes every 30 seconds.`): an invalid submit
 * shows the error and focuses the field, a valid one emits `codeSubmitted`, and
 * `codeFailure` shows `Incorrect code` until the code changes. Once the page passes the first
 * `backupCodes`, step 3 shows them (`App configured`) with `Copy` and `Download`, `Close` and
 * `I have saved my codes`; a backdrop click no longer closes it there. While `pending` the
 * primary button spins and the dialog cannot be closed. Every close request emits `dismissed`;
 * `detached` follows once the exit animation ended, so the page keeps the key and the codes on
 * screen while the dialog leaves and forgets them then. The dialog never stores them; its code
 * form starts over at each opening and is cleared once it has left.
 */
@Component({
  selector: 'cw-authenticator-setup-dialog',
  imports: [
    CwButton,
    CwDialog,
    CwDialogDescription,
    CwDialogFooter,
    CwDialogHeader,
    CwDialogTitle,
    CwInputOtp,
    CwInputOtpGroup,
    CwInputOtpSeparator,
    CwInputOtpSlot,
    FormField,
    NgIcon,
  ],
  templateUrl: './authenticator-setup-dialog.component.html',
})
export class AuthenticatorSetupDialog {
  // #region Properties
  /**
   * Property open
   *
   * @description
   * Whether the dialog is open.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly open: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property secret
   *
   * @description
   * The key of the pending setup, or null once forgotten.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly secret: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property backupCodes
   *
   * @description
   * The first backup codes, which switch the dialog to step 3; null before.
   *
   * @type {InputSignal<BackupCodeSet | null>}
   * @readonly
   */
  public readonly backupCodes: InputSignal<BackupCodeSet | null> = input<BackupCodeSet | null>(
    null,
  );

  /**
   * Property pending
   *
   * @description
   * Whether the code is being checked.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly pending: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property codeFailure
   *
   * @description
   * Whether the gateway refused the last code.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly codeFailure: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property copyKeyRequested
   *
   * @description
   * Emits on `Copy the key`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly copyKeyRequested: OutputEmitterRef<void> = output();

  /**
   * Property codeSubmitted
   *
   * @description
   * Emits the 6 digits of a valid code.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly codeSubmitted: OutputEmitterRef<string> = output<string>();

  /**
   * Property copyCodesRequested
   *
   * @description
   * Emits on `Copy` at step 3.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly copyCodesRequested: OutputEmitterRef<void> = output();

  /**
   * Property downloadRequested
   *
   * @description
   * Emits on `Download` at step 3.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly downloadRequested: OutputEmitterRef<void> = output();

  /**
   * Property dismissed
   *
   * @description
   * Emits when the dialog closes, whatever closed it.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly dismissed: OutputEmitterRef<void> = output();

  /**
   * Property detached
   *
   * @description
   * Emits once the closed dialog left the screen.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly detached: OutputEmitterRef<void> = output();

  /**
   * Property entered
   *
   * @description
   * The step reached before the codes: 1 or 2.
   *
   * @type {WritableSignal<1 | 2>}
   * @readonly
   */
  private readonly entered: WritableSignal<1 | 2> = signal<1 | 2>(1);

  /**
   * Property step
   *
   * @description
   * The step shown.
   *
   * @type {Signal<SetupStep>}
   * @readonly
   */
  protected readonly step: Signal<SetupStep> = computed((): SetupStep =>
    this.backupCodes() === null ? this.entered() : 3,
  );

  /**
   * Property steps
   *
   * @description
   * The three steps of the bars (`Compte.dc.html` line 1621).
   *
   * @type {readonly StepLabel[]}
   * @readonly
   */
  protected readonly steps: readonly StepLabel[] = [
    { step: 1, label: $localize`:@@account.security.setup-step-scan:Scan` },
    { step: 2, label: $localize`:@@account.security.setup-step-verify:Verify` },
    { step: 3, label: $localize`:@@account.security.setup-step-codes:Backup codes` },
  ];

  /**
   * Property groupedSecret
   *
   * @description
   * The key grouped by 4 characters, as the mockup shows it (`JBSW Y3DP EHPK 3PXP`).
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly groupedSecret: Signal<string> = computed(
    (): string =>
      this.secret()
        ?.match(/.{1,4}/gu)
        ?.join(' ') ?? '',
  );

  /**
   * Property codeModel
   *
   * @description
   * Value of the code form.
   *
   * @type {WritableSignal<CodeModel>}
   * @readonly
   */
  private readonly codeModel: WritableSignal<CodeModel> = signal<CodeModel>({ code: '' });

  /**
   * Property codeForm
   *
   * @description
   * The code form: exactly 6 digits.
   *
   * @type {FieldTree<CodeModel>}
   * @readonly
   */
  protected readonly codeForm: FieldTree<CodeModel> = form(this.codeModel, (path) => {
    const message: string = $localize`:@@account.security.setup-code-required:Enter the 6 digits of the code.`;
    required(path.code, { message });
    pattern(path.code, /^\d{6}$/u, { message });
  });

  /**
   * Property refusedCode
   *
   * @description
   * The code the gateway refused, or null.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  private readonly refusedCode: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * Property shownFailure
   *
   * @description
   * Whether the refusal shows: while the field still holds the refused code.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly shownFailure: Signal<boolean> = computed(
    (): boolean => this.refusedCode() !== null && this.refusedCode() === this.codeModel().code,
  );
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Starts over at step 1 with an empty code at each opening, shows a refusal and focuses the
   * code, and drops the refusal once the code changes.
   *
   * @constructor
   */
  public constructor() {
    effect((): void => {
      if (!this.open()) return;
      untracked((): void => {
        this.entered.set(1);
        this.clear();
      });
    });
    effect((): void => {
      const failure: boolean = this.codeFailure();
      untracked((): void => {
        this.refusedCode.set(failure ? this.codeModel().code : null);
        if (failure) this.codeForm.code().focusBoundControl();
      });
    });
    let shownStep: SetupStep = 1;
    afterRenderEffect((): void => {
      const step: SetupStep = this.step();
      if (step === 2 && shownStep !== 2) this.codeForm.code().focusBoundControl();
      shownStep = step;
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method next
   *
   * @description
   * `Continue` at step 1, `Verify the code` at step 2 (a valid code emits `codeSubmitted`, an
   * invalid one shows the error and focuses the field), `I have saved my codes` at step 3.
   *
   * @param {Event} event - The form submission.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async next(event: Event): Promise<void> {
    event.preventDefault();
    if (this.pending()) return;
    switch (this.step()) {
      case 1:
        this.entered.set(2);
        return;
      case 2:
        await submit(this.codeForm, {
          action: (): Promise<void> => {
            this.codeSubmitted.emit(this.codeModel().code);
            return Promise.resolve();
          },
          onInvalid: (fields: FieldTree<CodeModel>): void => {
            fields.code().focusBoundControl();
          },
        });
        return;
      case 3:
        this.dismissed.emit();
        return;
    }
  }

  /**
   * Method openChanged
   *
   * @description
   * Reports a close of the dialog itself (Escape, the backdrop).
   *
   * @param {boolean} open - The dialog's new open state.
   */
  protected openChanged(open: boolean): void {
    if (!open) this.dismissed.emit();
  }

  /**
   * Method dismiss
   *
   * @description
   * `Cancel` or `Close`; ignored while the code is checked.
   */
  protected dismiss(): void {
    if (!this.pending()) this.dismissed.emit();
  }

  /**
   * Method left
   *
   * @description
   * Clears the code once the dialog has left and reports it.
   */
  protected left(): void {
    this.clear();
    this.detached.emit();
  }

  /**
   * Method clear
   *
   * @description
   * Forgets the typed code and any refusal.
   */
  private clear(): void {
    this.codeForm().reset({ code: '' });
    this.refusedCode.set(null);
  }
  // #endregion
}
