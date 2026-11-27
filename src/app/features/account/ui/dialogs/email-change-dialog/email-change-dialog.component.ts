import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  inject,
  Injector,
  input,
  type InputSignal,
  model,
  type ModelSignal,
  output,
  type OutputEmitterRef,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import {
  type FieldContext,
  type FieldTree,
  form,
  FormField,
  submit,
  validate,
  type ValidationError,
} from '@angular/forms/signals';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwDialog,
  CwDialogDescription,
  CwDialogFooter,
  CwDialogHeader,
  CwDialogTitle,
} from '@cadenway/ui/components/dialog';
import { CwInput } from '@cadenway/ui/components/input';
import {
  CwInputOtp,
  CwInputOtpGroup,
  CwInputOtpSeparator,
  CwInputOtpSlot,
} from '@cadenway/ui/components/input-otp';
import { CwToastService } from '@cadenway/ui/components/toast';
import { NgIcon } from '@ng-icons/core';

import type {
  EmailConfirmOutcome,
  EmailRequestResult,
} from '../../../models/profile/profile.interface';
import { ProfileStore } from '../../../state/profile/profile.store';

/**
 * Constant EMAIL_PATTERN
 *
 * @description
 * The address check of the mockup (`Compte.dc.html` line 1443): something, `@`, a domain and a
 * top-level domain of 2 letters or more.
 *
 * @type {RegExp}
 */
const EMAIL_PATTERN: RegExp = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/iu;

/**
 * Constant EMAIL_LIMIT
 *
 * @description
 * The longest address the contract accepts, in characters.
 *
 * @type {number}
 */
const EMAIL_LIMIT: number = 254;

/**
 * Interface AddressModel
 *
 * @description
 * Value of the first step.
 */
interface AddressModel {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * The new address, as typed.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;
  // #endregion
}

/**
 * Interface CodeModel
 *
 * @description
 * Value of the second step.
 */
interface CodeModel {
  // #region Properties
  /**
   * Property code
   *
   * @description
   * The 6 digits, as typed.
   *
   * @type {string}
   * @readonly
   */
  readonly code: string;
  // #endregion
}

/**
 * Type EmailStep
 *
 * @description
 * The step shown: the new address, then the code sent to it.
 *
 * @type {'address' | 'code'}
 */
type EmailStep = 'address' | 'code';

/**
 * Function normalized
 *
 * @description
 * An address as compared and sent: trimmed, lower case.
 *
 * @param {string} value - The address as typed.
 * @returns {string} The address.
 */
function normalized(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Function countdown
 *
 * @description
 * A wait in `m:ss`, as the mockup writes it (`0:27`).
 *
 * @param {number} seconds - Whole seconds left.
 * @returns {string} The wait.
 */
function countdown(seconds: number): string {
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Component EmailChangeDialog
 *
 * @description
 * The `Change the email address` dialog of the `Profile` section (mockup `Compte.dc.html` lines
 * 593-635, logic lines 1443-1452 and 1576-1591), an overlay acting as a page over the page's
 * `ProfileStore`. `show()` opens it on its first step, `Step 1 of 2`, with the two bars of the
 * steps `New address` and `Verification code`.
 *
 * 1. `New email address`: the address is checked as the mockup does (`Invalid address: …`, and
 *    `This is already your current address: …` against `currentEmail`), then `Send the code` asks
 *    for a code through the reauthentication; a closed reauthentication keeps the step. A refusal
 *    shows on the field: the current address, an address another account uses (kept until the
 *    address changes), a throttled address; any other failure toasts and keeps the step.
 * 2. `Code sent to <email>`: a 3 + 3 one-time code, `Resend the code in m:ss` until the gateway's
 *    `resendAvailableAt` (then `Resend the code`, which asks again for the same address and toasts
 *    `Code resent`), and `Use another address` back to the first step. `Confirm the address` sends
 *    the code: a wrong or expired code shows on the field; an address another account took meanwhile
 *    goes back to the first step with that error; success closes the dialog, toasts
 *    `Email address changed` and emits `changed`.
 *
 * Submit stays enabled while a field is invalid: the error shows and the field takes the focus,
 * which also moves to the code field when the second step appears. While a request runs the
 * dialog cannot be closed and its button shows its spinner. `Cancel`, Escape and the backdrop
 * close it.
 */
@Component({
  selector: 'cw-email-change-dialog',
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
  templateUrl: './email-change-dialog.component.html',
})
export class EmailChangeDialog {
  // #region Properties
  /**
   * Property open
   *
   * @description
   * Whether the dialog is open.
   *
   * @type {ModelSignal<boolean>}
   * @readonly
   */
  public readonly open: ModelSignal<boolean> = model<boolean>(false);

  /**
   * Property currentEmail
   *
   * @description
   * The address of the account, which the new one must differ from.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly currentEmail: InputSignal<string> = input.required<string>();

  /**
   * Property changed
   *
   * @description
   * Emits the new address once the account holds it.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly changed: OutputEmitterRef<string> = output<string>();

  /**
   * Property store
   *
   * @description
   * The page's account and its address change.
   *
   * @type {InstanceType<typeof ProfileStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof ProfileStore> = inject(ProfileStore);

  /**
   * Property toasts
   *
   * @description
   * Toasts of the settings shell.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property injector
   *
   * @description
   * Schedules the focus moves after a step renders.
   *
   * @type {Injector}
   * @readonly
   */
  private readonly injector: Injector = inject(Injector);

  /**
   * Property step
   *
   * @description
   * The step shown.
   *
   * @type {WritableSignal<EmailStep>}
   * @readonly
   */
  protected readonly step: WritableSignal<EmailStep> = signal<EmailStep>('address');

  /**
   * Property sentTo
   *
   * @description
   * The new address the code was sent to.
   *
   * @type {WritableSignal<string>}
   * @readonly
   */
  protected readonly sentTo: WritableSignal<string> = signal('');

  /**
   * Property resendAt
   *
   * @description
   * When another code can be asked for, in milliseconds since the epoch.
   *
   * @type {WritableSignal<number>}
   * @readonly
   */
  private readonly resendAt: WritableSignal<number> = signal(0);

  /**
   * Property now
   *
   * @description
   * The clock of the resend countdown, ticking every second while the second step shows.
   *
   * @type {WritableSignal<number>}
   * @readonly
   */
  private readonly now: WritableSignal<number> = signal(Date.now());

  /**
   * Property ticker
   *
   * @description
   * The interval of the countdown, or null while none runs.
   *
   * @type {ReturnType<typeof setInterval> | null}
   */
  private ticker: ReturnType<typeof setInterval> | null = null;

  /**
   * Property takenEmail
   *
   * @description
   * An address the gateway answered another account uses, refused until the address changes.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  private readonly takenEmail: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * Property resendIn
   *
   * @description
   * The whole seconds before another code can be asked for; 0 once it can.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly resendIn: Signal<number> = computed((): number =>
    Math.max(0, Math.ceil((this.resendAt() - this.now()) / 1000)),
  );

  /**
   * Property resendWait
   *
   * @description
   * The countdown shown in `Resend the code in m:ss`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly resendWait: Signal<string> = computed((): string =>
    countdown(this.resendIn()),
  );

  /**
   * Property messages
   *
   * @description
   * The field errors of both steps.
   *
   * @type {{ readonly invalid: string; readonly unchanged: string; readonly taken: string; readonly throttled: string; readonly code: string; readonly wrongCode: string }}
   * @readonly
   */
  private readonly messages: {
    readonly invalid: string;
    readonly unchanged: string;
    readonly taken: string;
    readonly throttled: string;
    readonly code: string;
    readonly wrongCode: string;
  } = {
    invalid: $localize`:@@account.profile.email-invalid:Invalid address: check the format, for example firstname.lastname@example.com.`,
    unchanged: $localize`:@@account.profile.email-unchanged:This is already your current address: enter the new one.`,
    taken: $localize`:@@account.profile.email-taken:An account already uses this address.`,
    throttled: $localize`:@@account.profile.email-throttled:A code was just sent: wait before asking for a new one.`,
    code: $localize`:@@account.profile.code-required:Enter the 6 digits of the code.`,
    wrongCode: $localize`:@@account.profile.code-wrong:Wrong or expired code: check the last email you received.`,
  };

  /**
   * Property addressModel
   *
   * @description
   * Value of the first step.
   *
   * @type {WritableSignal<AddressModel>}
   * @readonly
   */
  private readonly addressModel: WritableSignal<AddressModel> = signal({ email: '' });

  /**
   * Property codeModel
   *
   * @description
   * Value of the second step.
   *
   * @type {WritableSignal<CodeModel>}
   * @readonly
   */
  private readonly codeModel: WritableSignal<CodeModel> = signal({ code: '' });

  /**
   * Property addressForm
   *
   * @description
   * The first step: a well-formed address, other than the current one and than one another
   * account uses.
   *
   * @type {FieldTree<AddressModel>}
   * @readonly
   */
  protected readonly addressForm: FieldTree<AddressModel> = form(this.addressModel, (path) => {
    validate(path.email, (context: FieldContext<string>) => {
      const email: string = normalized(context.value());
      if (email.length > EMAIL_LIMIT || !EMAIL_PATTERN.test(email)) {
        return { kind: 'email', message: this.messages.invalid };
      }
      if (email === normalized(this.currentEmail())) {
        return { kind: 'unchanged', message: this.messages.unchanged };
      }
      return email === this.takenEmail()
        ? { kind: 'taken', message: this.messages.taken }
        : undefined;
    });
  });

  /**
   * Property codeForm
   *
   * @description
   * The second step: the 6 digits.
   *
   * @type {FieldTree<CodeModel>}
   * @readonly
   */
  protected readonly codeForm: FieldTree<CodeModel> = form(this.codeModel, (path) => {
    validate(path.code, (context: FieldContext<string>) =>
      /^\d{6}$/u.test(context.value()) ? undefined : { kind: 'code', message: this.messages.code },
    );
  });
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Stops the countdown with the dialog.
   *
   * @constructor
   */
  public constructor() {
    inject(DestroyRef).onDestroy((): void => {
      this.stopTicker();
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method show
   *
   * @description
   * Opens the dialog on its first step, empty.
   */
  public show(): void {
    this.step.set('address');
    this.sentTo.set('');
    this.takenEmail.set(null);
    this.addressForm().reset({ email: '' });
    this.codeForm().reset({ code: '' });
    this.stopTicker();
    this.open.set(true);
  }

  /**
   * Method openChanged
   *
   * @description
   * Follows the dialog closing itself (Escape, the backdrop) and stops the countdown.
   *
   * @param {boolean} open - The dialog's new open state.
   */
  protected openChanged(open: boolean): void {
    this.open.set(open);
    if (!open) this.stopTicker();
  }

  /**
   * Method dismiss
   *
   * @description
   * Closes the dialog from `Cancel`, unless a request runs.
   */
  protected dismiss(): void {
    if (!this.store.emailPending()) this.openChanged(false);
  }

  /**
   * Method next
   *
   * @description
   * Submits the step shown.
   *
   * @param {Event} event - The form submission.
   * @returns {Promise<void>} Resolves once the step's request ended.
   */
  protected async next(event: Event): Promise<void> {
    event.preventDefault();
    if (this.store.emailPending()) return;
    if (this.step() === 'address') await this.sendAddress();
    else await this.sendCode();
  }

  /**
   * Method resend
   *
   * @description
   * Asks again for a code at the same address once the countdown ended, and toasts the outcome.
   *
   * @returns {Promise<void>} Resolves once the request ended.
   */
  protected async resend(): Promise<void> {
    if (this.resendIn() > 0 || this.store.emailPending()) return;
    const email: string = this.sentTo();
    const result: EmailRequestResult = await this.store.requestEmailChange(email);
    switch (result.outcome) {
      case 'sent':
        this.resendAt.set(result.code.resendAvailableAt);
        this.codeForm().reset({ code: '' });
        this.toasts.success($localize`:@@account.profile.code-resent:Code resent`, {
          description: $localize`:@@account.profile.code-resent-text:A new code went to ${email}:email:.`,
        });
        break;
      case 'refused':
        if (result.resendAvailableAt !== null) this.resendAt.set(result.resendAvailableAt);
        this.toasts.error(this.refusalMessage(result.reason));
        break;
      case 'failed':
        this.toastRequestFailure();
        break;
      case 'cancelled':
        break;
    }
  }

  /**
   * Method back
   *
   * @description
   * Goes back to the first step, keeping the address typed.
   */
  protected back(): void {
    if (this.store.emailPending()) return;
    this.stopTicker();
    this.codeForm().reset({ code: '' });
    this.step.set('address');
    this.focusLater((): void => {
      this.addressForm.email().focusBoundControl();
    });
  }

  /**
   * Method sendAddress
   *
   * @description
   * Submits the first step: asks for a code, then shows the second step.
   *
   * @returns {Promise<void>} Resolves once the request ended.
   */
  private async sendAddress(): Promise<void> {
    await submit(this.addressForm, {
      action: async (
        fields: FieldTree<AddressModel>,
      ): Promise<ValidationError.WithOptionalFieldTree[] | undefined> => {
        const email: string = normalized(this.addressModel().email);
        const result: EmailRequestResult = await this.store.requestEmailChange(email);
        switch (result.outcome) {
          case 'sent':
            this.sentTo.set(result.code.email);
            this.resendAt.set(result.code.resendAvailableAt);
            this.codeForm().reset({ code: '' });
            this.step.set('code');
            this.startTicker();
            this.focusLater((): void => {
              this.codeForm.code().focusBoundControl();
            });
            return undefined;
          case 'refused':
            if (result.reason === 'taken') {
              this.takenEmail.set(email);
              return undefined;
            }
            return [
              {
                kind: 'server',
                message: this.refusalMessage(result.reason),
                fieldTree: fields.email,
              },
            ];
          case 'failed':
            this.toastRequestFailure();
            return undefined;
          case 'cancelled':
            return undefined;
        }
      },
      onInvalid: (): void => {
        this.addressForm.email().focusBoundControl();
      },
    });
    if (this.step() === 'address' && this.addressForm.email().invalid()) {
      this.addressForm.email().focusBoundControl();
    }
  }

  /**
   * Method sendCode
   *
   * @description
   * Submits the second step: confirms the address with its code.
   *
   * @returns {Promise<void>} Resolves once the confirmation ended.
   */
  private async sendCode(): Promise<void> {
    const email: string = this.sentTo();
    await submit(this.codeForm, {
      action: async (
        fields: FieldTree<CodeModel>,
      ): Promise<ValidationError.WithOptionalFieldTree[] | undefined> => {
        const outcome: EmailConfirmOutcome = await this.store.confirmEmailChange(
          this.codeModel().code,
          email,
        );
        switch (outcome) {
          case 'confirmed':
            this.openChanged(false);
            this.toasts.success($localize`:@@account.profile.email-changed:Email address changed`, {
              description: $localize`:@@account.profile.email-changed-text:${email}:email: is verified and now receives your emails.`,
            });
            this.changed.emit(email);
            return undefined;
          case 'wrong-code':
            return [{ kind: 'server', message: this.messages.wrongCode, fieldTree: fields.code }];
          case 'taken':
            this.takenEmail.set(normalized(email));
            this.stopTicker();
            this.step.set('address');
            this.addressForm.email().markAsTouched();
            this.focusLater((): void => {
              this.addressForm.email().focusBoundControl();
            });
            return undefined;
          case 'failed':
            this.toasts.error(
              $localize`:@@account.profile.email-change-failed:The address could not be changed`,
              {
                description: $localize`:@@account.profile.email-change-failed-text:Try again in a moment.`,
              },
            );
            return undefined;
          case 'cancelled':
            return undefined;
        }
      },
      onInvalid: (): void => {
        this.codeForm.code().focusBoundControl();
      },
    });
    if (this.open() && this.step() === 'code' && this.codeForm.code().invalid()) {
      this.codeForm.code().focusBoundControl();
    }
  }

  /**
   * Method refusalMessage
   *
   * @description
   * Why the gateway refused to send a code.
   *
   * @param {'invalid' | 'unchanged' | 'taken' | 'throttled'} reason - The refusal.
   * @returns {string} The message.
   */
  private refusalMessage(reason: 'invalid' | 'unchanged' | 'taken' | 'throttled'): string {
    switch (reason) {
      case 'invalid':
        return this.messages.invalid;
      case 'unchanged':
        return this.messages.unchanged;
      case 'taken':
        return this.messages.taken;
      case 'throttled':
        return this.messages.throttled;
    }
  }

  /**
   * Method toastRequestFailure
   *
   * @description
   * Toasts that the code could not be sent.
   */
  private toastRequestFailure(): void {
    this.toasts.error($localize`:@@account.profile.code-send-failed:The code could not be sent`, {
      description: $localize`:@@account.profile.code-send-failed-text:Try again in a moment.`,
    });
  }

  /**
   * Method focusLater
   *
   * @description
   * Runs a focus move once the step shown has rendered.
   *
   * @param {() => void} move - The focus move.
   */
  private focusLater(move: () => void): void {
    afterNextRender(move, { injector: this.injector });
  }

  /**
   * Method startTicker
   *
   * @description
   * Ticks the countdown every second.
   */
  private startTicker(): void {
    this.stopTicker();
    this.now.set(Date.now());
    this.ticker = setInterval((): void => {
      this.now.set(Date.now());
    }, 1000);
  }

  /**
   * Method stopTicker
   *
   * @description
   * Stops the countdown.
   */
  private stopTicker(): void {
    if (this.ticker !== null) clearInterval(this.ticker);
    this.ticker = null;
  }
  // #endregion
}
