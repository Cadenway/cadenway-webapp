import { Location } from '@angular/common';
import { Component, inject, type OnInit, signal, type WritableSignal } from '@angular/core';
import {
  type FieldContext,
  type FieldTree,
  form,
  FormField,
  minLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CwAlert, CwAlertDescription } from '@cadenway/ui/components/alert';
import { CwButton } from '@cadenway/ui/components/button';
import { CwCard } from '@cadenway/ui/components/card';
import { CwCheckbox } from '@cadenway/ui/components/checkbox';
import { CwInput } from '@cadenway/ui/components/input';
import {
  CwPasswordStrength,
  CwPasswordStrengthLevel,
} from '@cadenway/ui/components/password-strength';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { NgIcon } from '@ng-icons/core';

import type {
  PasswordResetLink,
  PasswordResetResult,
} from '../../../models/session/session.interface';
import { AuthFlowStore, type StepResult } from '../../../state/auth-flow/auth-flow.store';
import { focusFirstError, serverError } from '../../../utils/form-focus/form-focus.util';

/**
 * Interface ResetModel
 *
 * @description
 * Values of the reset form.
 */
interface ResetModel {
  // #region Properties
  /**
   * Property password
   *
   * @description
   * New password.
   *
   * @type {string}
   */
  password: string;

  /**
   * Property confirmation
   *
   * @description
   * The new password typed again.
   *
   * @type {string}
   */
  confirmation: string;

  /**
   * Property closeOtherSessions
   *
   * @description
   * "Fermer mes autres sessions", ticked by default.
   *
   * @type {boolean}
   */
  closeOtherSessions: boolean;
  // #endregion
}

/**
 * Type ResetView
 *
 * @description
 * What the reset screen shows.
 *
 * @type {'loading' | 'form' | 'done' | 'expired'}
 */
type ResetView = 'loading' | 'form' | 'done' | 'expired';

/**
 * Component ResetPage
 *
 * @description
 * New password of `Reinitialisation.dc.html` (`/reset#token=…`). The token is read from the URL
 * fragment, which no server receives, then removed from the address bar and sent in bodies only.
 * The link is inspected first (« Pour le compte … »); an expired, used or replaced link shows
 * « Ce lien a expiré ». The success says how many sessions closed and offers « Se connecter ».
 */
@Component({
  selector: 'cw-reset-page',
  imports: [
    CwAlert,
    CwAlertDescription,
    CwButton,
    CwCard,
    CwCheckbox,
    CwInput,
    CwPasswordStrength,
    CwPasswordStrengthLevel,
    CwSkeleton,
    FormField,
    NgIcon,
    RouterLink,
  ],
  templateUrl: './reset-page.component.html',
})
export class ResetPage implements OnInit {
  // #region Properties
  /**
   * Property flow
   *
   * @description
   * Flow state; it prefills `/login` after the reset.
   *
   * @type {AuthFlowStore}
   * @readonly
   */
  private readonly flow: AuthFlowStore = inject(AuthFlowStore);

  /**
   * Property route
   *
   * @description
   * Gives the URL fragment.
   *
   * @type {ActivatedRoute}
   * @readonly
   */
  private readonly route: ActivatedRoute = inject(ActivatedRoute);

  /**
   * Property location
   *
   * @description
   * Removes the token from the address bar.
   *
   * @type {Location}
   * @readonly
   */
  private readonly location: Location = inject(Location);

  /**
   * Property router
   *
   * @description
   * Opens `/login` after the reset.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property token
   *
   * @description
   * The link's token, or null.
   *
   * @type {string | null}
   */
  private token: string | null = null;

  /**
   * Property view
   *
   * @description
   * What the screen shows.
   *
   * @type {WritableSignal<ResetView>}
   * @readonly
   */
  protected readonly view: WritableSignal<ResetView> = signal('loading');

  /**
   * Property link
   *
   * @description
   * Account of the link.
   *
   * @type {WritableSignal<PasswordResetLink | null>}
   * @readonly
   */
  protected readonly link: WritableSignal<PasswordResetLink | null> = signal(null);

  /**
   * Property result
   *
   * @description
   * Outcome of the reset.
   *
   * @type {WritableSignal<PasswordResetResult | null>}
   * @readonly
   */
  protected readonly result: WritableSignal<PasswordResetResult | null> = signal(null);

  /**
   * Property unavailable
   *
   * @description
   * Whether the last request failed for another reason than the link or the password.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly unavailable: WritableSignal<boolean> = signal(false);

  /**
   * Property showPassword
   *
   * @description
   * Whether both passwords show in clear.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly showPassword: WritableSignal<boolean> = signal(false);

  /**
   * Property showLabel
   *
   * @description
   * Name of the eye button while the passwords are hidden.
   *
   * @type {string}
   * @readonly
   */
  protected readonly showLabel: string = $localize`:@@auth.reset.show:Show the passwords`;

  /**
   * Property hideLabel
   *
   * @description
   * Name of the eye button while the passwords show.
   *
   * @type {string}
   * @readonly
   */
  protected readonly hideLabel: string = $localize`:@@auth.reset.hide:Hide the passwords`;

  /**
   * Property model
   *
   * @description
   * Form values.
   *
   * @type {WritableSignal<ResetModel>}
   * @readonly
   */
  protected readonly model: WritableSignal<ResetModel> = signal({
    password: '',
    confirmation: '',
    closeOtherSessions: true,
  });

  /**
   * Property resetForm
   *
   * @description
   * Requires a 12-character password typed twice the same.
   *
   * @type {FieldTree<ResetModel>}
   * @readonly
   */
  protected readonly resetForm: FieldTree<ResetModel> = form(this.model, (path) => {
    const passwordMessage: string = $localize`:@@auth.signup.password-short:Choose a password of at least 12 characters.`;
    required(path.password, { message: passwordMessage });
    minLength(path.password, 12, { message: passwordMessage });
    required(path.confirmation, {
      message: $localize`:@@auth.reset.confirm-missing:Type the password again to confirm it.`,
    });
    validate(path.confirmation, (context: FieldContext<string>) =>
      context.value() !== '' && context.value() !== context.valueOf(path.password)
        ? {
            kind: 'mismatch',
            message: $localize`:@@auth.reset.mismatch:The two passwords differ: type the same one.`,
          }
        : undefined,
    );
  });
  // #endregion

  // #region Methods
  /**
   * Method ngOnInit
   *
   * @description
   * Reads the token from the fragment, removes it from the address bar and inspects the link.
   */
  public ngOnInit(): void {
    void this.start();
  }

  /**
   * Method start
   *
   * @description
   * Runs the asynchronous part of the page's start.
   *
   * @returns {Promise<void>} Resolves once the link is inspected.
   */
  private async start(): Promise<void> {
    const fragment: string = this.route.snapshot.fragment ?? '';
    this.token = new URLSearchParams(fragment).get('token');
    if (fragment !== '') this.location.replaceState('/reset');
    if (this.token === null || this.token === '') {
      this.view.set('expired');
      return;
    }
    const link: StepResult<PasswordResetLink> = await this.flow.inspectPasswordReset(this.token);
    if (link.ok) {
      this.link.set(link.value);
      this.view.set('form');
    } else if (link.problem.status === 422) {
      this.view.set('expired');
    } else {
      this.unavailable.set(true);
      this.view.set('form');
    }
  }

  /**
   * Method save
   *
   * @description
   * Sets the new password.
   *
   * @param {Event} event - The submit event.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    const token: string | null = this.token;
    if (token === null) return;
    this.unavailable.set(false);
    await submit(this.resetForm, {
      action: async (fields: FieldTree<ResetModel>) => {
        const value: ResetModel = this.model();
        const result: StepResult<PasswordResetResult> = await this.flow.confirmPasswordReset(
          token,
          value.password,
          value.closeOtherSessions,
        );
        if (result.ok) {
          this.result.set(result.value);
          this.view.set('done');
          return undefined;
        }
        switch (result.problem.code) {
          case 'auth.reset-link-expired':
            this.view.set('expired');
            return undefined;
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
            this.unavailable.set(true);
            return undefined;
        }
      },
      onInvalid: (fields: FieldTree<ResetModel>) => {
        focusFirstError(fields);
      },
    });
    if (this.view() === 'form') focusFirstError(this.resetForm);
  }

  /**
   * Method signIn
   *
   * @description
   * Opens `/login` with the account's address.
   *
   * @returns {Promise<void>} Resolves once navigated.
   */
  protected async signIn(): Promise<void> {
    const address: string | undefined = this.result()?.email;
    if (address !== undefined) this.flow.prefill(address);
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
  // #endregion
}
