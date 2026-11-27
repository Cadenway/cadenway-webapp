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
import {
  type FieldContext,
  type FieldTree,
  form,
  FormField,
  required,
  submit,
  validate,
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
  CwPasswordStrength,
  CwPasswordStrengthLevel,
} from '@cadenway/ui/components/password-strength';
import { NgIcon } from '@ng-icons/core';

import type { PasswordChangeOutcome } from '../../../models/two-step/security-overview.interface';

/**
 * Constant MIN_LENGTH
 *
 * @description
 * Shortest password the contract accepts; it sets no composition rule.
 *
 * @type {number}
 */
const MIN_LENGTH: number = 12;

/**
 * Type PasswordRefusal
 *
 * @description
 * A refusal of the gateway the dialog shows on a field.
 *
 * @type {Extract<PasswordChangeOutcome, { kind: 'password-incorrect' | 'password-too-short' | 'password-compromised' | 'locked' }>}
 */
export type PasswordRefusal = Extract<
  PasswordChangeOutcome,
  { kind: 'password-incorrect' | 'password-too-short' | 'password-compromised' | 'locked' }
>;

/**
 * Interface PasswordChangeDraft
 *
 * @description
 * What a valid submit sends. Both are secrets, held in memory for the request only.
 */
export interface PasswordChangeDraft {
  // #region Properties
  /**
   * Property currentPassword
   *
   * @description
   * The current password.
   *
   * @type {string}
   * @readonly
   */
  readonly currentPassword: string;

  /**
   * Property newPassword
   *
   * @description
   * The new password.
   *
   * @type {string}
   * @readonly
   */
  readonly newPassword: string;
  // #endregion
}

/**
 * Interface PasswordModel
 *
 * @description
 * Value of the password form.
 */
interface PasswordModel {
  // #region Properties
  /**
   * Property current
   *
   * @description
   * `Current password`.
   *
   * @type {string}
   */
  current: string;

  /**
   * Property next
   *
   * @description
   * `New password`.
   *
   * @type {string}
   */
  next: string;

  /**
   * Property confirmation
   *
   * @description
   * `Confirm`.
   *
   * @type {string}
   */
  confirmation: string;
  // #endregion
}

/**
 * Function emptyModel
 *
 * @description
 * The form with no password typed.
 *
 * @returns {PasswordModel} The empty value.
 */
function emptyModel(): PasswordModel {
  return { current: '', next: '', confirmation: '' };
}

/**
 * Component PasswordChangeDialog
 *
 * @description
 * The `Change password` dialog of the `Security and sign-in` section (`Compte.dc.html` lines
 * 578-591): `Current password`, `New password` with the strength meter and the length help
 * (`12 characters minimum.`, `N more characters.`, `Long enough.`), and `Confirm`. Submit stays
 * enabled while the form is invalid, as the forms rule asks (the mockup disables it): an invalid
 * submit shows the errors (no current password, fewer than 12 characters, `The two passwords do
 * not match.`) and focuses the first faulty field; a valid one emits `submitted`. While `pending`
 * its button spins and the dialog cannot be closed. A `failure` of the gateway shows under its
 * field (the current password for a wrong one or a lockout, the new one otherwise), which takes
 * focus, until that field changes. The passwords live in the form only: they are cleared at each
 * opening and once the dialog has left the screen, and never logged.
 */
@Component({
  selector: 'cw-password-change-dialog',
  imports: [
    CwButton,
    CwDialog,
    CwDialogDescription,
    CwDialogFooter,
    CwDialogHeader,
    CwDialogTitle,
    CwInput,
    CwPasswordStrength,
    CwPasswordStrengthLevel,
    FormField,
    NgIcon,
  ],
  templateUrl: './password-change-dialog.component.html',
})
export class PasswordChangeDialog {
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
   * Property pending
   *
   * @description
   * Whether the change is under way.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly pending: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property failure
   *
   * @description
   * The gateway's refusal of the last submit, or null.
   *
   * @type {InputSignal<PasswordRefusal | null>}
   * @readonly
   */
  public readonly failure: InputSignal<PasswordRefusal | null> = input<PasswordRefusal | null>(
    null,
  );

  /**
   * Property submitted
   *
   * @description
   * Emits the passwords of a valid submit.
   *
   * @type {OutputEmitterRef<PasswordChangeDraft>}
   * @readonly
   */
  public readonly submitted: OutputEmitterRef<PasswordChangeDraft> = output<PasswordChangeDraft>();

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
   * Property model
   *
   * @description
   * Value of the form.
   *
   * @type {WritableSignal<PasswordModel>}
   * @readonly
   */
  protected readonly model: WritableSignal<PasswordModel> = signal(emptyModel());

  /**
   * Property passwordForm
   *
   * @description
   * The form: a current password, a new one of 12 characters at least, typed twice the same.
   *
   * @type {FieldTree<PasswordModel>}
   * @readonly
   */
  protected readonly passwordForm: FieldTree<PasswordModel> = form(this.model, (path) => {
    required(path.current, {
      message: $localize`:@@account.security.password-current-required:Enter your current password.`,
    });
    validate(path.next, (context: FieldContext<string>) =>
      context.value().length < MIN_LENGTH
        ? {
            kind: 'too-short',
            message: $localize`:@@account.security.password-too-short:Use at least 12 characters.`,
          }
        : undefined,
    );
    validate(path.confirmation, (context: FieldContext<string>) =>
      context.value() !== context.valueOf(path.next)
        ? {
            kind: 'mismatch',
            message: $localize`:@@account.security.password-mismatch:The two passwords do not match.`,
          }
        : undefined,
    );
  });

  /**
   * Property missing
   *
   * @description
   * How many characters the new password lacks, for the help line.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly missing: Signal<number> = computed((): number =>
    Math.max(0, MIN_LENGTH - this.model().next.length),
  );

  /**
   * Property refusal
   *
   * @description
   * The gateway's last refusal and the value its field held then, or null.
   *
   * @type {WritableSignal<{ readonly failure: PasswordRefusal; readonly value: string } | null>}
   * @readonly
   */
  private readonly refusal: WritableSignal<{
    readonly failure: PasswordRefusal;
    readonly value: string;
  } | null> = signal(null);

  /**
   * Property shownFailure
   *
   * @description
   * The gateway's refusal while the field it concerns keeps the value it was sent with.
   *
   * @type {Signal<PasswordRefusal | null>}
   * @readonly
   */
  protected readonly shownFailure: Signal<PasswordRefusal | null> = computed(
    (): PasswordRefusal | null => {
      const refusal: { readonly failure: PasswordRefusal; readonly value: string } | null =
        this.refusal();
      if (refusal === null) return null;
      return this.fieldValue(refusal.failure) === refusal.value ? refusal.failure : null;
    },
  );
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Starts the form over at each opening, shows a refusal and focuses its field, and drops the
   * refusal once that field changes.
   *
   * @constructor
   */
  public constructor() {
    effect((): void => {
      if (!this.open()) return;
      untracked((): void => {
        this.clear();
      });
    });
    effect((): void => {
      const failure: PasswordRefusal | null = this.failure();
      untracked((): void => {
        this.refusal.set(failure === null ? null : { failure, value: this.fieldValue(failure) });
      });
    });
    let focused: PasswordRefusal | null = null;
    afterRenderEffect((): void => {
      const failure: PasswordRefusal | null = this.shownFailure();
      if (failure !== null && failure !== focused) {
        if (this.onCurrent(failure)) this.passwordForm.current().focusBoundControl();
        else this.passwordForm.next().focusBoundControl();
      }
      focused = failure;
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method onCurrent
   *
   * @description
   * Whether a refusal concerns the current password.
   *
   * @param {PasswordRefusal} failure - The refusal.
   * @returns {boolean} True for a wrong current password or a lockout.
   */
  protected onCurrent(failure: PasswordRefusal): boolean {
    return failure.kind === 'password-incorrect' || failure.kind === 'locked';
  }

  /**
   * Method send
   *
   * @description
   * Emits the passwords of a valid form, or shows the errors and focuses the first faulty field.
   *
   * @param {Event} event - The form submission.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    if (this.pending()) return;
    await submit(this.passwordForm, {
      action: (): Promise<void> => {
        const value: PasswordModel = this.model();
        this.submitted.emit({ currentPassword: value.current, newPassword: value.next });
        return Promise.resolve();
      },
      onInvalid: (fields: FieldTree<PasswordModel>): void => {
        if (fields.current().invalid()) fields.current().focusBoundControl();
        else if (fields.next().invalid()) fields.next().focusBoundControl();
        else fields.confirmation().focusBoundControl();
      },
    });
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
   * `Cancel`; ignored while the change runs.
   */
  protected dismiss(): void {
    if (!this.pending()) this.dismissed.emit();
  }

  /**
   * Method clear
   *
   * @description
   * Forgets the typed passwords and any refusal.
   */
  protected clear(): void {
    this.passwordForm().reset(emptyModel());
    this.refusal.set(null);
  }

  /**
   * Method fieldValue
   *
   * @description
   * The current value of the field a refusal concerns.
   *
   * @param {PasswordRefusal} failure - The refusal.
   * @returns {string} The field's value.
   */
  private fieldValue(failure: PasswordRefusal): string {
    return this.onCurrent(failure) ? this.model().current : this.model().next;
  }
  // #endregion
}
