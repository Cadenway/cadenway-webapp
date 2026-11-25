import {
  Component,
  DestroyRef,
  inject,
  type OnInit,
  signal,
  type WritableSignal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CwAlert, CwAlertDescription } from '@cadenway/ui/components/alert';
import { CwButton } from '@cadenway/ui/components/button';
import { CwCard } from '@cadenway/ui/components/card';
import { CwSpinner } from '@cadenway/ui/components/spinner';
import { NgIcon } from '@ng-icons/core';

import { AuthFlowStore, type SessionResult } from '../../../state/auth-flow/auth-flow.store';

/**
 * Component FederatedContinuePage
 *
 * @description
 * The return from a provider (`/auth/federated/continue`, the path the gateway imposes). It
 * redeems the HttpOnly continuation cookie once (`finishFederatedSignIn`, an empty body), then
 * opens the destination, or `/login/two-step` for an account with two-step verification. A refused
 * continuation shows an error and `Other sign-in methods`.
 */
@Component({
  selector: 'cw-federated-continue-page',
  imports: [CwAlert, CwAlertDescription, CwButton, CwCard, CwSpinner, NgIcon, RouterLink],
  templateUrl: './federated-continue-page.component.html',
})
export class FederatedContinuePage implements OnInit {
  // #region Properties
  /**
   * Property flow
   *
   * @description
   * Flow state that redeems the continuation once.
   *
   * @type {AuthFlowStore}
   * @readonly
   */
  private readonly flow: AuthFlowStore = inject(AuthFlowStore);

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
   * Property refused
   *
   * @description
   * Whether the continuation was refused.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly refused: WritableSignal<boolean> = signal(false);
  // #endregion

  // #region Methods
  /**
   * Method ngOnInit
   *
   * @description
   * Redeems the continuation and opens the next screen.
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
    const result: SessionResult = await this.flow.finishFederatedSignIn();
    if (this.destroyRef.destroyed) return;
    if (result.kind === 'failed') {
      this.refused.set(true);
      return;
    }
    await this.router.navigateByUrl(
      result.kind === 'challenge' ? '/login/two-step' : result.destination,
      { replaceUrl: true },
    );
  }
  // #endregion
}
