import { _IdGenerator } from '@angular/cdk/a11y';
import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  type InputSignalWithTransform,
  booleanAttribute,
  model,
  type ModelSignal,
  type Signal,
  signal,
  viewChildren,
  type WritableSignal,
} from '@angular/core';
import {
  disabled,
  type FieldContext,
  type FieldTree,
  form,
  FormField,
  submit,
  validate,
} from '@angular/forms/signals';
import { CwButton } from '@cadenway/ui/components/button';
import { CwInput } from '@cadenway/ui/components/input';
import { NgIcon } from '@ng-icons/core';

/**
 * Constant INVITE_EMAIL_PATTERN
 *
 * @description
 * A full address as the mockup checks it before adding it (`App.dc.html` line 5258): something,
 * `@`, a domain and an extension of two characters or more, without spaces.
 *
 * @type {RegExp}
 */
const INVITE_EMAIL_PATTERN: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

/**
 * Interface InviteFieldModel
 *
 * @description
 * The value of the invite form.
 */
interface InviteFieldModel {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * The address being typed, before it is added to the list.
   *
   * @type {string}
   */
  email: string;
  // #endregion
}

/**
 * Component OnboardingInviteField
 *
 * @description
 * The invitation field of the onboarding (`App.dc.html` lines 2694-2695, logic lines 5256-5268),
 * shared by the assistant's `Team` step and the getting-started invite dialog: the `Email address`
 * field with its outline `Add` button, then one pill per address with its `Remove <email>` button.
 * It is its own `<form>`, so a host must not nest it inside another form.
 *
 * The trimmed address must match the mockup's pattern; only a truly empty field is valid, so blank
 * text is invalid, as in the mockup. Once the field is touched (blurred, or submitted with `Add`)
 * an invalid address shows `Enter a full address, for example ines.robert@ateliernord.fr.` under
 * the field, which it describes, and `CwInput` sets `aria-invalid` from the same field state; the
 * error follows the text until the next valid add. An invalid `Add` keeps the focus in the field,
 * and `Add` on an empty field adds nothing and shows no error. A valid address is added once (a
 * duplicate, compared without regard to case, is dropped), the field is emptied and untouched, and
 * the focus returns to it. Removing a pill moves the focus to the next pill's remove button, else
 * the previous one's, else the field.
 *
 * Presentational: the list is the two-way `emails` model; sending the invitations belongs to the
 * host. `disabled` disables the field and every button, for example while the host sends them.
 */
@Component({
  selector: 'cw-onboarding-invite-field',
  imports: [CwButton, CwInput, FormField, NgIcon],
  templateUrl: './onboarding-invite-field.component.html',
})
export class OnboardingInviteField {
  // #region Properties
  /**
   * Property emails
   *
   * @description
   * The addresses added, in the order added, each as typed (trimmed) and distinct without regard to
   * case, `[(emails)]`.
   *
   * @type {ModelSignal<readonly string[]>}
   * @readonly
   */
  public readonly emails: ModelSignal<readonly string[]> = model<readonly string[]>([]);

  /**
   * Property disabled
   *
   * @description
   * Whether the field, `Add` and the remove buttons are disabled; false by default.
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly disabled: InputSignalWithTransform<boolean, unknown> = input<boolean, unknown>(
    false,
    { transform: booleanAttribute },
  );

  /**
   * Property fieldId
   *
   * @description
   * Id of the address field, unique in the document so that both hosts may render the component.
   *
   * @type {string}
   * @readonly
   */
  protected readonly fieldId: string = inject(_IdGenerator).getId('cw-onboarding-invite-');

  /**
   * Property errorId
   *
   * @description
   * Id of the error line, which describes the field while it shows.
   *
   * @type {string}
   * @readonly
   */
  protected readonly errorId: string = `${this.fieldId}-error`;

  /**
   * Property model
   *
   * @description
   * Value of the invite form.
   *
   * @type {WritableSignal<InviteFieldModel>}
   * @readonly
   */
  protected readonly model: WritableSignal<InviteFieldModel> = signal<InviteFieldModel>({
    email: '',
  });

  /**
   * Property inviteForm
   *
   * @description
   * The invite form: any text, blank text included, must match the mockup's pattern once trimmed;
   * only an empty field is valid, and it adds nothing. The field is disabled with `disabled`.
   *
   * @type {FieldTree<InviteFieldModel>}
   * @readonly
   */
  protected readonly inviteForm: FieldTree<InviteFieldModel> = form(this.model, (path) => {
    disabled(path.email, { when: (): boolean => this.disabled() });
    validate(path.email, (context: FieldContext<string>) => {
      const text: string = context.value();
      if (text === '' || INVITE_EMAIL_PATTERN.test(text.trim())) return undefined;
      return {
        kind: 'email',
        message: $localize`:@@onboarding.invite.invalid:Enter a full address, for example ines.robert@ateliernord.fr.`,
      };
    });
  });

  /**
   * Property error
   *
   * @description
   * Message of the field while it is touched and invalid, the state `CwInput` reads for
   * `aria-invalid`; null otherwise.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly error: Signal<string | null> = computed((): string | null =>
    this.inviteForm.email().touched() && this.inviteForm.email().invalid()
      ? (this.inviteForm.email().errors()[0]?.message ?? null)
      : null,
  );

  /**
   * Property removeButtons
   *
   * @description
   * The pills' remove buttons, in list order, to move the focus after a removal.
   *
   * @type {Signal<readonly ElementRef<HTMLButtonElement>[]>}
   * @readonly
   */
  private readonly removeButtons: Signal<readonly ElementRef<HTMLButtonElement>[]> = viewChildren<
    string,
    ElementRef<HTMLButtonElement>
  >('removeButton', { read: ElementRef });

  /**
   * Property injector
   *
   * @description
   * Injector of the component, to move the focus once the list has rendered.
   *
   * @type {Injector}
   * @readonly
   */
  private readonly injector: Injector = inject(Injector);
  // #endregion

  // #region Methods
  /**
   * Method add
   *
   * @description
   * Adds the typed address once and empties the field, or shows the error (`submit()` marks the
   * field touched); the focus stays in, or returns to, the field.
   *
   * @param {Event} event - The form submission.
   * @returns {Promise<void>} Resolves once checked.
   */
  protected async add(event: Event): Promise<void> {
    event.preventDefault();
    if (this.disabled()) return;
    await submit(this.inviteForm, {
      action: (): Promise<undefined> => {
        const email: string = this.model().email.trim();
        if (email !== '') {
          const key: string = email.toLowerCase();
          if (!this.emails().some((added: string): boolean => added.toLowerCase() === key)) {
            this.emails.update((added: readonly string[]): readonly string[] => [...added, email]);
          }
          this.model.set({ email: '' });
        }
        this.inviteForm().reset();
        this.inviteForm.email().focusBoundControl();
        return Promise.resolve(undefined);
      },
      onInvalid: (fields: FieldTree<InviteFieldModel>): void => {
        fields.email().focusBoundControl();
      },
    });
  }

  /**
   * Method remove
   *
   * @description
   * Removes an address, then moves the focus to the remove button now at its place, else the last
   * one, else the field.
   *
   * @param {number} index - Position of the address in the list.
   */
  protected remove(index: number): void {
    if (this.disabled()) return;
    this.emails.update((added: readonly string[]): readonly string[] =>
      added.filter((_email: string, position: number): boolean => position !== index),
    );
    afterNextRender(
      (): void => {
        const buttons: readonly ElementRef<HTMLButtonElement>[] = this.removeButtons();
        const target: ElementRef<HTMLButtonElement> | undefined = buttons.at(
          Math.min(index, buttons.length - 1),
        );
        if (target) target.nativeElement.focus();
        else this.inviteForm.email().focusBoundControl();
      },
      { injector: this.injector },
    );
  }

  /**
   * Method removeLabel
   *
   * @description
   * The accessible name of a pill's remove button: `Remove ines.robert@ateliernord.fr`.
   *
   * @param {string} email - The address.
   * @returns {string} The name.
   */
  protected removeLabel(email: string): string {
    return $localize`:@@onboarding.invite.remove:Remove ${email}:email:`;
  }
  // #endregion
}
