import {
  Component,
  DestroyRef,
  inject,
  type OnInit,
  signal,
  type WritableSignal,
} from '@angular/core';
import { Router } from '@angular/router';
import { CwAlert, CwAlertDescription } from '@cadenway/ui/components/alert';
import { CwCard } from '@cadenway/ui/components/card';
import { NgIcon } from '@ng-icons/core';

import {
  AuthFlowStore,
  type SessionResult,
  type StepResult,
} from '../../../state/auth-flow/auth-flow.store';
import { Countdown } from '../../../utils/countdown/countdown.util';
import { CodeForm } from '../../forms/code-form/code-form.component';

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
 * Component SignupVerifyPage
 *
 * @description
 * Address verification after sign-up, the verification usage of `Otp.dc.html`
 * (`/signup/verify`). The code and the password of the sign-up (kept in the flow store's memory)
 * open the first session. Without a pending sign-up, for example after a reload, it returns to
 * `/signup`.
 */
@Component({
  selector: 'cw-signup-verify-page',
  imports: [CodeForm, CwAlert, CwAlertDescription, CwCard, NgIcon],
  templateUrl: './signup-verify-page.component.html',
})
export class SignupVerifyPage implements OnInit {
  // #region Properties
  /**
   * Property flow
   *
   * @description
   * Flow state holding the pending sign-up.
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
   * Property countdown
   *
   * @description
   * Seconds before another code request; the sign-up just sent one.
   *
   * @type {Countdown}
   * @readonly
   */
  protected readonly countdown: Countdown = new Countdown();

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
   * Property submitLabel
   *
   * @description
   * Label of the code form's button.
   *
   * @type {string}
   * @readonly
   */
  protected readonly submitLabel: string = $localize`:@@auth.signup-verify.submit:Confirm my address`;
  // #endregion

  // #region Methods
  /**
   * Method ngOnInit
   *
   * @description
   * Starts the resend countdown, or returns to `/signup` without a pending sign-up.
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
   * @returns {Promise<void>} Resolves once handled.
   */
  private async start(): Promise<void> {
    if (this.flow.signUpEmail() === null) {
      await this.router.navigateByUrl('/signup', { replaceUrl: true });
      return;
    }
    this.countdown.start(RESEND_SECONDS);
  }

  /**
   * Method resend
   *
   * @description
   * Sends a new code; the previous one stops working.
   *
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async resend(): Promise<void> {
    if (this.countdown.running()) return;
    this.unavailable.set(false);
    const result: StepResult = await this.flow.resendSignUpCode();
    if (!result.ok && result.problem.code !== 'auth.code-throttled') {
      this.unavailable.set(true);
      return;
    }
    this.resent.set(true);
    this.countdown.start(RESEND_SECONDS);
  }

  /**
   * Method verify
   *
   * @description
   * Checks the code and opens the first session.
   *
   * @param {string} code - The six digits.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async verify(code: string): Promise<void> {
    this.error.set(null);
    this.unavailable.set(false);
    this.checking.set(true);
    const result: SessionResult = await this.flow.verifySignUp(code);
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
    if (result.kind === 'signed-in' && !this.destroyRef.destroyed) {
      await this.router.navigateByUrl(result.destination, { replaceUrl: true });
    }
  }
  // #endregion
}
