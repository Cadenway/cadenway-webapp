import {
  Component,
  computed,
  DestroyRef,
  inject,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import {
  email,
  type FieldTree,
  form,
  FormField,
  pattern,
  required,
  submit,
} from '@angular/forms/signals';
import { Router } from '@angular/router';
import { CwAlert, CwAlertDescription } from '@cadenway/ui/components/alert';
import { CwButton } from '@cadenway/ui/components/button';
import { CwCard } from '@cadenway/ui/components/card';
import { CwCheckbox } from '@cadenway/ui/components/checkbox';
import { CwInput } from '@cadenway/ui/components/input';
import { NgIcon } from '@ng-icons/core';

import type { AuthProblem, SignInCredentials } from '../../../models/auth/auth.interface';
import { SignInStore } from '../../../state/sign-in/sign-in.store';

/**
 * Function problemMessage
 *
 * @description
 * Presents stable, actionable copy without exposing the gateway's exception details.
 *
 * @param {AuthProblem | null} problem - The latest submission failure.
 * @returns {string | null} The alert copy, if the request failed.
 */
function problemMessage(problem: AuthProblem | null): string | null {
  switch (problem?.code) {
    case undefined:
      return null;
    case 'auth.invalid-credentials':
      return 'E-mail ou mot de passe incorrect.';
    case 'auth.account-locked':
      return 'Compte verrouillé pendant 15 minutes.';
    case 'auth.email-not-verified':
      return 'Vérifiez votre adresse e-mail avant de vous connecter.';
    case 'auth.challenge-expired':
      return 'La vérification a expiré. Connectez-vous à nouveau.';
    case 'auth.two-step-code-invalid':
      return 'Code incorrect. Vérifiez le code de votre application.';
    case 'auth.two-step-locked':
      return 'Trop de tentatives. Réessayez plus tard.';
    default:
      return 'Connexion indisponible. Réessayez dans un instant.';
  }
}

/**
 * Component SignInPage
 *
 * @description
 * Opens a cookie session through the password form and, when required, the authenticator challenge.
 */
@Component({
  selector: 'cw-sign-in-page',
  imports: [CwAlert, CwAlertDescription, CwButton, CwCard, CwCheckbox, CwInput, FormField, NgIcon],
  providers: [SignInStore],
  templateUrl: './sign-in-page.component.html',
})
export class SignInPage {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * Page-scoped password and second-step outcomes.
   *
   * @type {InstanceType<typeof SignInStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof SignInStore> = inject(SignInStore);

  /**
   * Property router
   *
   * @description
   * Opens the chooser after the gateway has opened a session.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property destroyRef
   *
   * @description
   * Prevents an old submission from navigating after the sign-in page is gone.
   *
   * @type {DestroyRef}
   * @readonly
   */
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /**
   * Property credentials
   *
   * @description
   * Password form values kept in memory for the lifetime of the page.
   *
   * @type {WritableSignal<SignInCredentials>}
   * @readonly
   */
  private readonly credentials: WritableSignal<SignInCredentials> = signal({
    email: '',
    password: '',
    rememberMe: false,
  });

  /**
   * Property signInForm
   *
   * @description
   * Password form with address validation and a required password.
   *
   * @type {FieldTree<SignInCredentials>}
   * @readonly
   */
  protected readonly signInForm: FieldTree<SignInCredentials> = form(this.credentials, (fields) => {
    required(fields.email);
    email(fields.email);
    required(fields.password);
  });

  /**
   * Property codeModel
   *
   * @description
   * Temporary authenticator code, cleared between answers.
   *
   * @type {WritableSignal<{ code: string }>}
   * @readonly
   */
  private readonly codeModel: WritableSignal<{ code: string }> = signal({ code: '' });

  /**
   * Property codeForm
   *
   * @description
   * Accepts the six digits displayed in the authenticator.
   *
   * @type {FieldTree<{ code: string }>}
   * @readonly
   */
  protected readonly codeForm: FieldTree<{ code: string }> = form(this.codeModel, (fields) => {
    required(fields.code);
    pattern(fields.code, /^[0-9]{6}$/u);
  });

  /**
   * Property showPassword
   *
   * @description
   * Explicit presentation toggle for the current password input.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly showPassword: WritableSignal<boolean> = signal(false);

  /**
   * Property message
   *
   * @description
   * Error alert for the latest failure.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly message: Signal<string | null> = computed(() =>
    problemMessage(this.store.problem()),
  );
  // #endregion

  // #region Methods
  /**
   * Method submitPassword
   *
   * @description
   * Uses Signal Forms to serialize password submission and clears the value after acceptance.
   *
   * @param {Event} event - The form submit event.
   * @returns {Promise<void>} Resolves after the password is handled.
   */
  protected async submitPassword(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.signInForm, async () => {
      const signedIn: boolean = await this.store.signIn(this.credentials());
      if (signedIn || this.store.challengeEmail() !== null) {
        this.credentials.update((value) => ({ ...value, password: '' }));
        this.showPassword.set(false);
      }
      if (signedIn && !this.destroyRef.destroyed) {
        await this.router.navigateByUrl('/organisations', { replaceUrl: true });
      }
    });
  }

  /**
   * Method submitCode
   *
   * @description
   * Sends the second step and navigates on acceptance by the gateway.
   *
   * @param {Event} event - The form submit event.
   * @returns {Promise<void>} Resolves after the answer is handled.
   */
  protected async submitCode(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.codeForm, async () => {
      const signedIn: boolean = await this.store.answer(this.codeModel().code);
      this.codeModel.set({ code: '' });
      if (signedIn && !this.destroyRef.destroyed) {
        await this.router.navigateByUrl('/organisations', { replaceUrl: true });
      }
    });
  }
  // #endregion
}
