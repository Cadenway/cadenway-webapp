import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  type InputSignal,
  type OnInit,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import { email, type FieldTree, form, FormField, required, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { CwAlert, CwAlertDescription, CwAlertTitle } from '@cadenway/ui/components/alert';
import { CwButton } from '@cadenway/ui/components/button';
import { CwCard } from '@cadenway/ui/components/card';
import { CwCheckbox } from '@cadenway/ui/components/checkbox';
import { CwInput } from '@cadenway/ui/components/input';
import { NgIcon } from '@ng-icons/core';

import type { AuthProblem } from '../../../models/auth-problem/auth-problem.interface';
import type { FederatedProvider } from '../../../models/session/session.interface';
import {
  AuthFlowStore,
  type SessionResult,
  type StepResult,
} from '../../../state/auth-flow/auth-flow.store';
import { focusFirstError, serverError } from '../../../utils/form-focus/form-focus.util';
import { ProviderButtons } from '../../components/provider-buttons/provider-buttons.component';

/**
 * Interface LoginModel
 *
 * @description
 * Values of the password form.
 */
interface LoginModel {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * Account address.
   *
   * @type {string}
   */
  email: string;

  /**
   * Property password
   *
   * @description
   * Password, kept in this page's memory only and cleared once accepted.
   *
   * @type {string}
   */
  password: string;

  /**
   * Property rememberMe
   *
   * @description
   * `Stay signed in for 30 days`.
   *
   * @type {boolean}
   */
  rememberMe: boolean;
  // #endregion
}

/**
 * Component LoginPage
 *
 * @description
 * The sign-in screen of `Main.dc.html` (`/login`): social providers, the company SSO entry
 * (`/login/sso`), the password form with `Stay signed in for 30 days`, the e-mail code entry
 * (`/login/code`) and the links to `/forgot` and `/signup`. A wrong password shows the attempts
 * left before the lockout; a lockout shows `Account locked for 15 minutes.` An address
 * prefilled from `/logged-out` focuses the password. A `?next=` path is kept for after sign-in.
 */
@Component({
  selector: 'cw-login-page',
  imports: [
    CwAlert,
    CwAlertDescription,
    CwAlertTitle,
    CwButton,
    CwCard,
    CwCheckbox,
    CwInput,
    FormField,
    NgIcon,
    ProviderButtons,
    RouterLink,
  ],
  templateUrl: './login-page.component.html',
})
export class LoginPage implements OnInit {
  // #region Properties
  /**
   * Property next
   *
   * @description
   * The `?next=` path to open after sign-in, checked by the flow store.
   *
   * @type {InputSignal<string | undefined>}
   * @readonly
   */
  public readonly next: InputSignal<string | undefined> = input<string | undefined>();

  /**
   * Property flow
   *
   * @description
   * Flow state shared with the other auth screens.
   *
   * @type {AuthFlowStore}
   * @readonly
   */
  protected readonly flow: AuthFlowStore = inject(AuthFlowStore);

  /**
   * Property router
   *
   * @description
   * Opens the next screen.
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
   * Form values, starting from the flow's address and session preference.
   *
   * @type {WritableSignal<LoginModel>}
   * @readonly
   */
  private readonly model: WritableSignal<LoginModel> = signal({
    email: this.flow.email(),
    password: '',
    rememberMe: this.flow.rememberMe(),
  });

  /**
   * Property loginForm
   *
   * @description
   * Requires a valid address and a password.
   *
   * @type {FieldTree<LoginModel>}
   * @readonly
   */
  protected readonly loginForm: FieldTree<LoginModel> = form(this.model, (path) => {
    required(path.email, {
      message: $localize`:@@auth.login.email-required:Enter the email address of your account, for example camille.martin@ateliernord.fr.`,
    });
    email(path.email, {
      message: $localize`:@@auth.login.email-invalid:Enter the email address of your account, for example camille.martin@ateliernord.fr.`,
    });
    required(path.password, {
      message: $localize`:@@auth.login.password-required:Enter your password.`,
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
   * The last refusal of a sign-in attempt, shown above the providers.
   *
   * @type {WritableSignal<AuthProblem | null>}
   * @readonly
   */
  protected readonly problem: WritableSignal<AuthProblem | null> = signal(null);

  /**
   * Property alert
   *
   * @description
   * Which alert the refusal shows.
   *
   * @type {Signal<'invalid' | 'locked' | 'unverified' | 'unavailable' | null>}
   * @readonly
   */
  protected readonly alert: Signal<'invalid' | 'locked' | 'unverified' | 'unavailable' | null> =
    computed(() => {
      const problem: AuthProblem | null = this.problem();
      if (problem === null) return null;
      switch (problem.code) {
        case 'auth.invalid-credentials':
          return 'invalid';
        case 'auth.account-locked':
          return 'locked';
        case 'auth.email-not-verified':
          return 'unverified';
        default:
          return 'unavailable';
      }
    });
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Focuses the password when the address was prefilled from a remembered account.
   *
   * @constructor
   */
  public constructor() {
    afterNextRender(() => {
      if (this.flow.prefilled()) this.loginForm.password().focusBoundControl();
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method ngOnInit
   *
   * @description
   * Keeps the `?next=` path for after sign-in, or forgets an older one.
   */
  public ngOnInit(): void {
    this.flow.setReturnUrl(this.next());
  }

  /**
   * Method typedEmail
   *
   * @description
   * Shares a typed address with the other screens; it is no longer a prefilled one.
   */
  protected typedEmail(): void {
    if (this.model().email !== this.flow.email()) this.flow.setEmail(this.model().email.trim());
  }

  /**
   * Method signIn
   *
   * @description
   * Submits the password form. A wrong password marks the password field; a challenge opens
   * `/login/two-step`; a session opens its destination.
   *
   * @param {Event} event - The submit event.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async signIn(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.loginForm, {
      action: async (fields: FieldTree<LoginModel>) => {
        const { email: address, password, rememberMe }: LoginModel = this.model();
        this.problem.set(null);
        this.flow.setRememberMe(rememberMe);
        const result: SessionResult = await this.flow.signInWithPassword(address.trim(), password);
        if (result.kind === 'failed') {
          this.problem.set(result.problem);
          return result.problem.code === 'auth.invalid-credentials'
            ? serverError(
                fields.password,
                $localize`:@@auth.login.password-wrong:Wrong password: check the capital letters.`,
              )
            : undefined;
        }
        this.model.update((value: LoginModel) => ({ ...value, password: '' }));
        this.showPassword.set(false);
        await this.open(result.kind === 'challenge' ? '/login/two-step' : result.destination);
        return undefined;
      },
      onInvalid: (fields: FieldTree<LoginModel>) => {
        focusFirstError(fields);
      },
    });
    if (this.problem()?.code === 'auth.invalid-credentials') focusFirstError(this.loginForm);
  }

  /**
   * Method startProvider
   *
   * @description
   * Hands the browser to the chosen provider with the session preference.
   *
   * @param {FederatedProvider} provider - The provider.
   * @returns {Promise<void>} Resolves once the redirect started or was refused.
   */
  protected async startProvider(provider: FederatedProvider): Promise<void> {
    this.problem.set(null);
    this.flow.setRememberMe(this.model().rememberMe);
    const result: StepResult<string> | null = await this.flow.startFederatedSignIn(provider);
    if (result === null || this.destroyRef.destroyed) return;
    if (result.ok) window.location.assign(result.value);
    else this.problem.set(result.problem);
  }

  /**
   * Method keepPreferences
   *
   * @description
   * Shares the address and the session preference before another sign-in screen opens.
   */
  protected keepPreferences(): void {
    this.typedEmail();
    this.flow.setRememberMe(this.model().rememberMe);
  }

  /**
   * Method open
   *
   * @description
   * Opens a path in place of the sign-in screen, unless the page closed meanwhile.
   *
   * @param {string} path - The application path.
   * @returns {Promise<void>} Resolves once navigated.
   */
  private async open(path: string): Promise<void> {
    if (!this.destroyRef.destroyed) await this.router.navigateByUrl(path, { replaceUrl: true });
  }
  // #endregion
}
