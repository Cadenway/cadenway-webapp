import {
  Component,
  DestroyRef,
  inject,
  type OnInit,
  signal,
  type WritableSignal,
} from '@angular/core';
import { email, type FieldTree, form, FormField, required, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { CwAlert, CwAlertDescription } from '@cadenway/ui/components/alert';
import { CwButton } from '@cadenway/ui/components/button';
import { CwCard } from '@cadenway/ui/components/card';
import { CwInput } from '@cadenway/ui/components/input';
import { NgIcon } from '@ng-icons/core';

import { RuntimeConfigStore } from '@core/config';

import {
  AuthFlowStore,
  type SessionResult,
  type StepResult,
} from '../../../state/auth-flow/auth-flow.store';
import { Countdown } from '../../../utils/countdown/countdown.util';
import { focusFirstError } from '../../../utils/form-focus/form-focus.util';
import { CodeForm } from '../../forms/code-form/code-form.component';
import { CodeHelp } from '../../components/code-help/code-help.component';

/**
 * Constant RESEND_SECONDS
 *
 * @description
 * Wait before another code request, the gateway's throttle and the mockup's countdown.
 *
 * @type {number}
 */
const RESEND_SECONDS: number = 30;

/**
 * Component CodeSignInPage
 *
 * @description
 * Sign-in with an e-mail code, the sign-in usage of `Otp.dc.html` (`/login/code`). It sends a code
 * to the address shared by `/login` on arrival, or asks for the address first when none is known.
 * The code opens the session, or the two-step challenge of an account that has one. `Resend the
 * code` waits 30 seconds between requests.
 */
@Component({
  selector: 'cw-code-sign-in-page',
  imports: [
    CodeForm,
    CodeHelp,
    CwAlert,
    CwAlertDescription,
    CwButton,
    CwCard,
    CwInput,
    FormField,
    NgIcon,
    RouterLink,
  ],
  templateUrl: './code-sign-in-page.component.html',
})
export class CodeSignInPage implements OnInit {
  // #region Properties
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
   * Property siteUrl
   *
   * @description
   * The public site whose Help page the line below the card links to, or null without one.
   *
   * @type {string | null}
   * @readonly
   */
  protected readonly siteUrl: string | null = inject(RuntimeConfigStore).config().siteUrl ?? null;

  /**
   * Property countdown
   *
   * @description
   * Seconds before another code request.
   *
   * @type {Countdown}
   * @readonly
   */
  protected readonly countdown: Countdown = new Countdown();

  /**
   * Property sentTo
   *
   * @description
   * Address the code went to, or null while the address is asked.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  protected readonly sentTo: WritableSignal<string | null> = signal(null);

  /**
   * Property resent
   *
   * @description
   * Whether a new code was sent.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly resent: WritableSignal<boolean> = signal(false);

  /**
   * Property error
   *
   * @description
   * Refusal of the last code, or null.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  protected readonly error: WritableSignal<string | null> = signal(null);

  /**
   * Property unavailable
   *
   * @description
   * Whether the last request failed for another reason than the code.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly unavailable: WritableSignal<boolean> = signal(false);

  /**
   * Property checking
   *
   * @description
   * Whether a code is being checked.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly checking: WritableSignal<boolean> = signal(false);

  /**
   * Property model
   *
   * @description
   * The address asked when none is known.
   *
   * @type {WritableSignal<{ email: string }>}
   * @readonly
   */
  private readonly model: WritableSignal<{ email: string }> = signal({ email: this.flow.email() });

  /**
   * Property emailForm
   *
   * @description
   * Requires a valid address.
   *
   * @type {FieldTree<{ email: string }>}
   * @readonly
   */
  protected readonly emailForm: FieldTree<{ email: string }> = form(this.model, (path) => {
    const message: string = $localize`:@@auth.login.email-invalid:Enter the email address of your account, for example camille.martin@ateliernord.fr.`;
    required(path.email, { message });
    email(path.email, { message });
  });

  /**
   * Property submitLabel
   *
   * @description
   * Label of the code form's button.
   *
   * @type {string}
   * @readonly
   */
  protected readonly submitLabel: string = $localize`:@@auth.code-sign-in.submit:Sign in`;
  // #endregion

  // #region Methods
  /**
   * Method ngOnInit
   *
   * @description
   * Sends the code at once when `/login` shared a valid address.
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
   * @returns {Promise<void>} Resolves once the request is handled.
   */
  private async start(): Promise<void> {
    if (this.emailForm().valid()) await this.request(this.model().email.trim());
  }

  /**
   * Method askCode
   *
   * @description
   * Submits the address form.
   *
   * @param {Event} event - The submit event.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async askCode(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.emailForm, {
      action: async () => {
        await this.request(this.model().email.trim());
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
   * Sends a new code to the same address.
   *
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async resend(): Promise<void> {
    const address: string | null = this.sentTo();
    if (address === null || this.countdown.running()) return;
    await this.request(address);
    if (this.sentTo() !== null) this.resent.set(true);
  }

  /**
   * Method verify
   *
   * @description
   * Checks the code; a wrong or expired one shows under the code.
   *
   * @param {string} code - The six digits.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async verify(code: string): Promise<void> {
    this.error.set(null);
    this.unavailable.set(false);
    this.checking.set(true);
    const result: SessionResult = await this.flow.signInWithCode(code);
    this.checking.set(false);
    if (result.kind === 'failed') {
      if (result.problem.status === 422) {
        this.error.set(
          $localize`:@@auth.code.wrong:Wrong or expired code: check the last email you received.`,
        );
      } else {
        this.unavailable.set(true);
      }
      return;
    }
    if (!this.destroyRef.destroyed) {
      await this.router.navigateByUrl(
        result.kind === 'challenge' ? '/login/two-step' : result.destination,
        { replaceUrl: true },
      );
    }
  }

  /**
   * Method request
   *
   * @description
   * Requests a code; a throttled request still shows the code step, since a code went out less
   * than 30 seconds ago.
   *
   * @param {string} address - Account address.
   * @returns {Promise<void>} Resolves once handled.
   */
  private async request(address: string): Promise<void> {
    this.unavailable.set(false);
    const result: StepResult = await this.flow.requestSignInCode(address);
    if (!result.ok && result.problem.code !== 'auth.code-throttled') {
      this.unavailable.set(true);
      return;
    }
    this.sentTo.set(address);
    this.countdown.start(RESEND_SECONDS);
  }
  // #endregion
}
