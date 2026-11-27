import {
  Component,
  effect,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  signal,
  untracked,
  type WritableSignal,
} from '@angular/core';
import {
  type FieldContext,
  type FieldTree,
  form,
  FormField,
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
import { NgIcon } from '@ng-icons/core';

/**
 * Constant NAME_MAX_LENGTH
 *
 * @description
 * Longest key name the contract accepts, once trimmed.
 *
 * @type {number}
 */
const NAME_MAX_LENGTH: number = 60;

/**
 * Interface KeyNameModel
 *
 * @description
 * Value of the name form.
 */
interface KeyNameModel {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * The key's name, as typed.
   *
   * @type {string}
   */
  name: string;
  // #endregion
}

/**
 * Component SecurityKeyNameDialog
 *
 * @description
 * The dialog `Add a key` opens before the browser's prompt. The contract requires a name the
 * mockup does not ask for, so this dialog is not drawn by the mockup: `Key name` (for example
 * `YubiKey 5C NFC`), then `Continue`, which stays enabled while the name is invalid (blank, or
 * more than 60 characters once trimmed): an invalid submit shows the error and focuses the field,
 * a valid one emits `submitted` with the trimmed name. While `pending` (the gateway, then the
 * browser's prompt, then the registration) its button spins and the dialog cannot be closed. The
 * form starts over at each opening.
 */
@Component({
  selector: 'cw-security-key-name-dialog',
  imports: [
    CwButton,
    CwDialog,
    CwDialogDescription,
    CwDialogFooter,
    CwDialogHeader,
    CwDialogTitle,
    CwInput,
    FormField,
    NgIcon,
  ],
  template: `
    @let error = nameForm.name().touched() ? nameForm.name().errors()[0]?.message : undefined;
    <cw-dialog
      size="sm"
      [open]="open()"
      [pending]="pending()"
      [showClose]="false"
      data-testid="key-name-dialog"
      (openChange)="openChanged($event)"
    >
      <cw-dialog-header>
        <h2 cwDialogTitle i18n="@@account.security.key-name-title">Add a security key</h2>
        <p cwDialogDescription i18n="@@account.security.key-name-description">
          Name the key, then follow your browser's instructions.
        </p>
      </cw-dialog-header>
      <form id="key-name-form" class="flex flex-col gap-2" novalidate (submit)="send($event)">
        <label
          for="key-name"
          class="text-sm leading-none font-medium"
          i18n="@@account.security.key-name-label"
          >Key name</label
        >
        <input
          cwInput
          id="key-name"
          type="text"
          autocomplete="off"
          placeholder="YubiKey 5C NFC"
          i18n-placeholder="@@account.security.key-name-placeholder"
          [formField]="nameForm.name"
          [attr.aria-describedby]="error ? 'key-name-error' : null"
        />
        @if (error) {
          <p
            id="key-name-error"
            role="alert"
            class="flex items-center gap-1 text-xs font-medium text-destructive"
          >
            <ng-icon
              name="phosphorWarningCircleFill"
              class="size-3.5 shrink-0"
              aria-hidden="true"
            />
            {{ error }}
          </p>
        }
      </form>
      <cw-dialog-footer>
        <button
          cwButton
          type="button"
          variant="outline"
          [disabled]="pending()"
          data-testid="key-name-cancel"
          (click)="dismiss()"
        >
          <ng-container i18n="@@account.security.cancel">Cancel</ng-container>
        </button>
        <button
          cwButton
          type="submit"
          form="key-name-form"
          [loading]="pending()"
          data-testid="key-name-submit"
        >
          <ng-container i18n="@@account.security.setup-continue">Continue</ng-container>
        </button>
      </cw-dialog-footer>
    </cw-dialog>
  `,
})
export class SecurityKeyNameDialog {
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
   * Whether the registration is under way.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly pending: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property submitted
   *
   * @description
   * Emits the trimmed name of a valid submit.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly submitted: OutputEmitterRef<string> = output<string>();

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
   * @type {WritableSignal<KeyNameModel>}
   * @readonly
   */
  private readonly model: WritableSignal<KeyNameModel> = signal<KeyNameModel>({ name: '' });

  /**
   * Property nameForm
   *
   * @description
   * The form: a name that is not blank, of 60 characters at most once trimmed.
   *
   * @type {FieldTree<KeyNameModel>}
   * @readonly
   */
  protected readonly nameForm: FieldTree<KeyNameModel> = form(this.model, (path) => {
    validate(path.name, (context: FieldContext<string>) => {
      const name: string = context.value().trim();
      if (name === '') {
        return {
          kind: 'required',
          message: $localize`:@@account.security.key-name-required:Enter a name for the key.`,
        };
      }
      return name.length > NAME_MAX_LENGTH
        ? {
            kind: 'too-long',
            message: $localize`:@@account.security.key-name-too-long:Use 60 characters at most.`,
          }
        : undefined;
    });
  });
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Starts the form over at each opening.
   *
   * @constructor
   */
  public constructor() {
    effect((): void => {
      if (!this.open()) return;
      untracked((): void => {
        this.nameForm().reset({ name: '' });
      });
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method send
   *
   * @description
   * Emits the trimmed name of a valid form, or shows the error and focuses the field.
   *
   * @param {Event} event - The form submission.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    if (this.pending()) return;
    await submit(this.nameForm, {
      action: (): Promise<void> => {
        this.submitted.emit(this.model().name.trim());
        return Promise.resolve();
      },
      onInvalid: (fields: FieldTree<KeyNameModel>): void => {
        fields.name().focusBoundControl();
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
   * `Cancel`; ignored while the registration runs.
   */
  protected dismiss(): void {
    if (!this.pending()) this.dismissed.emit();
  }
  // #endregion
}
