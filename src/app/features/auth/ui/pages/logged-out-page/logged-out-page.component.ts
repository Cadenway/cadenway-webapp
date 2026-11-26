import {
  Component,
  computed,
  inject,
  input,
  type InputSignal,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import { Router } from '@angular/router';
import { CwAvatar } from '@cadenway/ui/components/avatar';
import { CwButton } from '@cadenway/ui/components/button';
import { CwCard } from '@cadenway/ui/components/card';
import { NgIcon } from '@ng-icons/core';

import type { LoggedOutReason } from '../../../models/logged-out-reason/logged-out-reason.type';
import type { RememberedAccount } from '../../../models/remembered-account/remembered-account.interface';
import { RememberedAccountsService } from '../../../services/remembered-accounts/remembered-accounts.service';
import { AuthFlowStore } from '../../../state/auth-flow/auth-flow.store';

/**
 * Component LoggedOutPage
 *
 * @description
 * The signed-out screen of `Deconnexion.dc.html` (`/logged-out?reason=`): a sign-out by the person
 * (`signed-out`, the default), an expired session (`expired`) or every session closed
 * (`all-devices`), then the accounts remembered on this device. `Sign in` on an account
 * prefills `/login`; the cross forgets it, with `Undo` until the next action.
 */
@Component({
  selector: 'cw-logged-out-page',
  imports: [CwAvatar, CwButton, CwCard, NgIcon],
  templateUrl: './logged-out-page.component.html',
})
export class LoggedOutPage {
  // #region Properties
  /**
   * Property reason
   *
   * @description
   * The `?reason=` query parameter; an unknown value reads as `signed-out`.
   *
   * @type {InputSignal<string | undefined>}
   * @readonly
   */
  public readonly reason: InputSignal<string | undefined> = input<string | undefined>();

  /**
   * Property remembered
   *
   * @description
   * Accounts remembered on this device.
   *
   * @type {RememberedAccountsService}
   * @readonly
   */
  protected readonly remembered: RememberedAccountsService = inject(RememberedAccountsService);

  /**
   * Property flow
   *
   * @description
   * Flow state; it prefills `/login`.
   *
   * @type {AuthFlowStore}
   * @readonly
   */
  private readonly flow: AuthFlowStore = inject(AuthFlowStore);

  /**
   * Property router
   *
   * @description
   * Opens `/login`.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property motive
   *
   * @description
   * The known reason.
   *
   * @type {Signal<LoggedOutReason>}
   * @readonly
   */
  protected readonly motive: Signal<LoggedOutReason> = computed(() => {
    const reason: string | undefined = this.reason();
    return reason === 'expired' || reason === 'all-devices' ? reason : 'signed-out';
  });

  /**
   * Property firstName
   *
   * @description
   * First name of the most recent remembered account, for `See you soon, Camille.`, or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly firstName: Signal<string | null> = computed(
    () => this.remembered.accounts()[0]?.name.trim().split(/\s+/u)[0] ?? null,
  );

  /**
   * Property forgotten
   *
   * @description
   * The account forgotten last, still restorable, or null.
   *
   * @type {WritableSignal<ReturnType<RememberedAccountsService['forget']>>}
   * @readonly
   */
  protected readonly forgotten: WritableSignal<ReturnType<RememberedAccountsService['forget']>> =
    signal(null);
  // #endregion

  // #region Methods
  /**
   * Method signInLabel
   *
   * @description
   * Accessible name of an account's `Sign in`.
   *
   * @param {RememberedAccount} account - The account.
   * @returns {string} The name.
   */
  protected signInLabel(account: RememberedAccount): string {
    return $localize`:@@auth.logged-out.sign-in-as:Sign in with ${account.email}:email:`;
  }

  /**
   * Method forgetLabel
   *
   * @description
   * Accessible name of an account's forget button.
   *
   * @param {RememberedAccount} account - The account.
   * @returns {string} The name.
   */
  protected forgetLabel(account: RememberedAccount): string {
    return $localize`:@@auth.logged-out.forget:Forget ${account.email}:email: on this device`;
  }

  /**
   * Method signInAs
   *
   * @description
   * Opens `/login` with an account's address, or with none.
   *
   * @param {RememberedAccount | undefined} account - The account, or undefined for another one.
   * @returns {Promise<void>} Resolves once navigated.
   */
  protected async signInAs(account: RememberedAccount | undefined): Promise<void> {
    if (account === undefined) this.flow.setEmail('');
    else this.flow.prefill(account.email);
    await this.router.navigateByUrl('/login');
  }

  /**
   * Method forget
   *
   * @description
   * Forgets an account on this device.
   *
   * @param {RememberedAccount} account - The account.
   */
  protected forget(account: RememberedAccount): void {
    this.forgotten.set(this.remembered.forget(account.email));
  }

  /**
   * Method undo
   *
   * @description
   * Remembers the forgotten account again (`Undo`).
   */
  protected undo(): void {
    const forgotten: ReturnType<RememberedAccountsService['forget']> = this.forgotten();
    if (forgotten !== null) this.remembered.restore(forgotten);
    this.forgotten.set(null);
  }
  // #endregion
}
