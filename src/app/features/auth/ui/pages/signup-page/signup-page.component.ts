import {
  Component,
  DestroyRef,
  inject,
  input,
  type InputSignal,
  signal,
  type WritableSignal,
} from '@angular/core';
import {
  email,
  type FieldTree,
  form,
  FormField,
  minLength,
  required,
  submit,
  type ValidationError,
} from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { CwAlert, CwAlertDescription } from '@cadenway/ui/components/alert';
import { CwButton } from '@cadenway/ui/components/button';
import { CwCard } from '@cadenway/ui/components/card';
import { CwCheckbox } from '@cadenway/ui/components/checkbox';
import { CwInput } from '@cadenway/ui/components/input';
import {
  CwPasswordStrength,
  CwPasswordStrengthLevel,
} from '@cadenway/ui/components/password-strength';
import { NgIcon } from '@ng-icons/core';

import { RuntimeConfigStore } from '@core/config';

import type { AuthProblem } from '../../../models/auth-problem/auth-problem.interface';
import type { FederatedProvider } from '../../../models/session/session.interface';
import { AuthFlowStore, type StepResult } from '../../../state/auth-flow/auth-flow.store';
import { focusFirstError, serverError } from '../../../utils/form-focus/form-focus.util';
import { ProviderButtons } from '../../components/provider-buttons/provider-buttons.component';

/**
 * Constant PASSWORD_MIN_LENGTH
 *
 * @description
 * The gateway's only password rule: 12 characters at least, no composition rule.
 *
 * @type {number}
 */
const PASSWORD_MIN_LENGTH: number = 12;

/**
 * Interface SignupModel
 *
 * @description
 * Values of the sign-up form.
 */
interface SignupModel {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Full name.
   *
   * @type {string}
   */
  name: string;

  /**
   * Property email
   *
   * @description
   * Work address.
   *
   * @type {string}
   */
  email: string;

  /**
   * Property password
   *
   * @description
   * New password, kept in memory until the address is verified.
   *
   * @type {string}
   */
  password: string;

  /**
   * Property acceptTerms
   *
   * @description
   * Acceptance of the terms of use and privacy policy.
   *
   * @type {boolean}
   */
  acceptTerms: boolean;
  // #endregion
}

/**
 * Component SignupPage
 *
 * @description
 * Account creation of `Inscription.dc.html` (`/signup`): social providers, then name, work address,
 * password with `cw-password-strength` and the acceptance of the terms. A taken address shows
 * « Un compte existe déjà avec cette adresse : connectez-vous » on the field; a created account
 * opens `/signup/verify`.
 */
@Component({
  selector: 'cw-signup-page',
  imports: [
    CwAlert,
    CwAlertDescription,
    CwButton,
    CwCard,
    CwCheckbox,
    CwInput,
    CwPasswordStrength,
    CwPasswordStrengthLevel,
    FormField,
    NgIcon,
    ProviderButtons,
    RouterLink,
  ],
  templateUrl: './signup-page.component.html',
})
export class SignupPage {
  // #region Properties
  /**
   * Property reason
   *
   * @description
   * The `?reason=` query parameter; `sign-up-replaced` says the previous sign-up of the address
   * was replaced and must be made again.
   *
   * @type {InputSignal<string | undefined>}
   * @readonly
   */
  public readonly reason: InputSignal<string | undefined> = input<string | undefined>();

  /**
   * Property flow
   *
   * @description
   * Flow state that keeps the pending sign-up.
   *
   * @type {AuthFlowStore}
   * @readonly
   */
  protected readonly flow: AuthFlowStore = inject(AuthFlowStore);

  /**
   * Property siteUrl
   *
   * @description
   * Public site of the terms and privacy pages, or null.
   *
   * @type {string | null}
   * @readonly
   */
  protected readonly siteUrl: string | null = inject(RuntimeConfigStore).config().siteUrl ?? null;

  /**
   * Property router
   *
   * @description
   * Opens the verification screen.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property destroyRef
   *
   * @description
   * Keeps a late answer from navigating after the page closed.
   *
   * @type {DestroyRef}
   * @readonly
   */
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /**
   * Property model
   *
   * @description
   * Form values.
   *
   * @type {WritableSignal<SignupModel>}
   * @readonly
   */
  protected readonly model: WritableSignal<SignupModel> = signal({
    name: '',
    email: '',
    password: '',
    acceptTerms: false,
  });

  /**
   * Property signupForm
   *
   * @description
   * Requires a name, a valid address, a 12-character password and the terms.
   *
   * @type {FieldTree<SignupModel>}
   * @readonly
   */
  protected readonly signupForm: FieldTree<SignupModel> = form(this.model, (path) => {
    required(path.name, { message: $localize`:@@auth.signup.name-required:Enter your full name.` });
    const emailMessage: string = $localize`:@@auth.login.email-invalid:Enter the email address of your account, for example camille.martin@ateliernord.fr.`;
    required(path.email, { message: emailMessage });
    email(path.email, { message: emailMessage });
    const passwordMessage: string = $localize`:@@auth.signup.password-short:Choose a password of at least 12 characters.`;
    required(path.password, { message: passwordMessage });
    minLength(path.password, PASSWORD_MIN_LENGTH, { message: passwordMessage });
    required(path.acceptTerms, {
      message: $localize`:@@auth.signup.terms-required:Accept the terms to create your account.`,
    });
  });

  /**
   * Property showPassword
   *
   * @description
   * Whether the password shows in clear.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly showPassword: WritableSignal<boolean> = signal(false);

  /**
   * Property showLabel
   *
   * @description
   * Name of the eye button while the password is hidden.
   *
   * @type {string}
   * @readonly
   */
  protected readonly showLabel: string = $localize`:@@auth.password.show:Show the password`;

  /**
   * Property hideLabel
   *
   * @description
   * Name of the eye button while the password shows.
   *
   * @type {string}
   * @readonly
   */
  protected readonly hideLabel: string = $localize`:@@auth.password.hide:Hide the password`;

  /**
   * Property problem
   *
   * @description
   * A refusal that concerns no field.
   *
   * @type {WritableSignal<AuthProblem | null>}
   * @readonly
   */
  protected readonly problem: WritableSignal<AuthProblem | null> = signal(null);
  // #endregion

  // #region Methods
  /**
   * Method emailTaken
   *
   * @description
   * Whether the address field holds the « adresse déjà utilisée » refusal, shown with its link.
   *
   * @returns {boolean} Whether the address is taken.
   */
  protected emailTaken(): boolean {
    return this.signupForm
      .email()
      .errors()
      .some((error: ValidationError) => error.kind === 'server');
  }

  /**
   * Method create
   *
   * @description
   * Creates the account and opens `/signup/verify`.
   *
   * @param {Event} event - The submit event.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async create(event: Event): Promise<void> {
    event.preventDefault();
    this.problem.set(null);
    await submit(this.signupForm, {
      action: async (fields: FieldTree<SignupModel>) => {
        const value: SignupModel = this.model();
        const result: StepResult = await this.flow.signUp({
          name: value.name.trim(),
          email: value.email.trim(),
          password: value.password,
        });
        if (result.ok) {
          if (!this.destroyRef.destroyed) await this.router.navigateByUrl('/signup/verify');
          return undefined;
        }
        switch (result.problem.code) {
          case 'auth.email-taken':
            return serverError(
              fields.email,
              $localize`:@@auth.signup.email-taken:An account already uses this address: sign in.`,
            );
          case 'auth.password-too-short':
            return serverError(
              fields.password,
              $localize`:@@auth.signup.password-short:Choose a password of at least 12 characters.`,
            );
          case 'auth.password-compromised':
            return serverError(
              fields.password,
              $localize`:@@auth.signup.password-compromised:This password appears in a list of compromised passwords: choose another one.`,
            );
          default:
            this.problem.set(result.problem);
            return undefined;
        }
      },
      onInvalid: (fields: FieldTree<SignupModel>) => {
        focusFirstError(fields);
      },
    });
    focusFirstError(this.signupForm);
  }

  /**
   * Method startProvider
   *
   * @description
   * Signs up through a provider: the gateway links or creates the account on return.
   *
   * @param {FederatedProvider} provider - The provider.
   * @returns {Promise<void>} Resolves once the redirect started or was refused.
   */
  protected async startProvider(provider: FederatedProvider): Promise<void> {
    this.problem.set(null);
    const result: StepResult<string> | null = await this.flow.startFederatedSignIn(provider);
    if (result === null || this.destroyRef.destroyed) return;
    if (result.ok) window.location.assign(result.value);
    else this.problem.set(result.problem);
  }
  // #endregion
}
