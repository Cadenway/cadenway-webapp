import { Component, inject, signal, type WritableSignal } from '@angular/core';
import { email, type FieldTree, form, FormField, required, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { CwAlert, CwAlertDescription } from '@cadenway/ui/components/alert';
import { CwButton } from '@cadenway/ui/components/button';
import { CwCard } from '@cadenway/ui/components/card';
import { CwInput } from '@cadenway/ui/components/input';
import { NgIcon } from '@ng-icons/core';

import { AuthFlowStore, type StepResult } from '../../../state/auth-flow/auth-flow.store';
import { Countdown } from '../../../utils/countdown/countdown.util';
import { focusFirstError } from '../../../utils/form-focus/form-focus.util';

/**
 * Constant RESEND_SECONDS
 *
 * @description
 * Wait before another reset link, the gateway's throttle and the mockup's countdown.
 *
 * @type {number}
 */
const RESEND_SECONDS: number = 45;

/**
 * Component ForgotPage
 *
 * @description
 * Forgotten password of `MotDePasseOublie.dc.html` (`/forgot`): the account address, then
 * « Vérifiez vos e-mails », which always reads the same whether or not an account uses the
 * address. « Renvoyer l'e-mail » waits 45 seconds; « Modifier l'adresse » returns to the form.
 */
@Component({
  selector: 'cw-forgot-page',
  imports: [CwAlert, CwAlertDescription, CwButton, CwCard, CwInput, FormField, NgIcon, RouterLink],
  templateUrl: './forgot-page.component.html',
})
export class ForgotPage {
  // #region Properties
  /**
   * Property flow
   *
   * @description
   * Flow state that shares the address.
   *
   * @type {AuthFlowStore}
   * @readonly
   */
  private readonly flow: AuthFlowStore = inject(AuthFlowStore);

  /**
   * Property countdown
   *
   * @description
   * Seconds before another link.
   *
   * @type {Countdown}
   * @readonly
   */
  protected readonly countdown: Countdown = new Countdown();

  /**
   * Property sentTo
   *
   * @description
   * Address the link went to, or null on the form.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  protected readonly sentTo: WritableSignal<string | null> = signal(null);

  /**
   * Property resent
   *
   * @description
   * Whether a new link was sent.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly resent: WritableSignal<boolean> = signal(false);

  /**
   * Property unavailable
   *
   * @description
   * Whether the last request failed.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly unavailable: WritableSignal<boolean> = signal(false);

  /**
   * Property model
   *
   * @description
   * The account address, from the flow when `/login` shared one.
   *
   * @type {WritableSignal<{ email: string }>}
   * @readonly
   */
  private readonly model: WritableSignal<{ email: string }> = signal({ email: this.flow.email() });

  /**
   * Property forgotForm
   *
   * @description
   * Requires a valid address.
   *
   * @type {FieldTree<{ email: string }>}
   * @readonly
   */
  protected readonly forgotForm: FieldTree<{ email: string }> = form(this.model, (path) => {
    const message: string = $localize`:@@auth.login.email-invalid:Enter the email address of your account, for example camille.martin@ateliernord.fr.`;
    required(path.email, { message });
    email(path.email, { message });
  });
  // #endregion

  // #region Methods
  /**
   * Method send
   *
   * @description
   * Requests the link and shows « Vérifiez vos e-mails ».
   *
   * @param {Event} event - The submit event.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.forgotForm, {
      action: async () => {
        await this.request(false);
        return undefined;
      },
      onInvalid: (fields: FieldTree<{ email: string }>) => {
        focusFirstError(fields);
      },
    });
  }

  /**
   * Method resend
   *
   * @description
   * Requests a new link; the previous one stops working.
   *
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async resend(): Promise<void> {
    if (!this.countdown.running()) await this.request(true);
  }

  /**
   * Method edit
   *
   * @description
   * Returns to the form with the address selected.
   */
  protected edit(): void {
    this.sentTo.set(null);
    this.resent.set(false);
    this.countdown.start(0);
    setTimeout(() => {
      this.forgotForm.email().focusBoundControl();
    });
  }

  /**
   * Method request
   *
   * @description
   * Sends the request; a throttled one still shows the sent state.
   *
   * @param {boolean} again - Whether it is a resend.
   * @returns {Promise<void>} Resolves once handled.
   */
  private async request(again: boolean): Promise<void> {
    const address: string = this.model().email.trim();
    this.unavailable.set(false);
    const result: StepResult = await this.flow.requestPasswordReset(address);
    if (!result.ok && result.problem.code !== 'auth.reset-throttled') {
      this.unavailable.set(true);
      return;
    }
    this.sentTo.set(address);
    this.resent.set(again);
    this.countdown.start(RESEND_SECONDS);
  }
  // #endregion
}
