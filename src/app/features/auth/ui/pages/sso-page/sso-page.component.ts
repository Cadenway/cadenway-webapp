import {
  afterNextRender,
  Component,
  DestroyRef,
  inject,
  signal,
  type WritableSignal,
} from '@angular/core';
import { email, type FieldTree, form, FormField, required, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { CwAlert, CwAlertDescription } from '@cadenway/ui/components/alert';
import { CwButton } from '@cadenway/ui/components/button';
import { CwCard } from '@cadenway/ui/components/card';
import { CwInput } from '@cadenway/ui/components/input';
import { NgIcon } from '@ng-icons/core';

import { AuthFlowStore, type SsoResult } from '../../../state/auth-flow/auth-flow.store';
import { focusFirstError, serverError } from '../../../utils/form-focus/form-focus.util';

/**
 * Component SsoPage
 *
 * @description
 * The SSO view of `Main.dc.html` (`/login/sso`): a work address, checked with
 * `discoverSignInMethods`. A domain without SAML shows `No SSO is set up for “domain”: use
 * another sign-in method.`; otherwise the browser goes to the organization's identity provider.
 * `Other sign-in methods` returns to `/login`.
 */
@Component({
  selector: 'cw-sso-page',
  imports: [CwAlert, CwAlertDescription, CwButton, CwCard, CwInput, FormField, NgIcon, RouterLink],
  templateUrl: './sso-page.component.html',
})
export class SsoPage {
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
   * Property destroyRef
   *
   * @description
   * Keeps a late answer from redirecting after the page closed.
   *
   * @type {DestroyRef}
   * @readonly
   */
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /**
   * Property model
   *
   * @description
   * The work address.
   *
   * @type {WritableSignal<{ email: string }>}
   * @readonly
   */
  private readonly model: WritableSignal<{ email: string }> = signal({ email: this.flow.email() });

  /**
   * Property ssoForm
   *
   * @description
   * Requires a valid work address.
   *
   * @type {FieldTree<{ email: string }>}
   * @readonly
   */
  protected readonly ssoForm: FieldTree<{ email: string }> = form(this.model, (path) => {
    const message: string = $localize`:@@auth.sso.email-invalid:Enter your work address, for example first.last@ateliernord.fr.`;
    required(path.email, { message });
    email(path.email, { message });
  });

  /**
   * Property unavailable
   *
   * @description
   * Whether the last check failed for another reason than the domain.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly unavailable: WritableSignal<boolean> = signal(false);
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Focuses the address when the view opens, as the mockup does.
   *
   * @constructor
   */
  public constructor() {
    afterNextRender(() => {
      this.ssoForm.email().focusBoundControl();
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method continue
   *
   * @description
   * Checks the domain, then hands the browser to the identity provider.
   *
   * @param {Event} event - The submit event.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async continue(event: Event): Promise<void> {
    event.preventDefault();
    this.unavailable.set(false);
    await submit(this.ssoForm, {
      action: async (fields: FieldTree<{ email: string }>) => {
        const address: string = this.model().email.trim();
        this.flow.setEmail(address);
        const result: SsoResult = await this.flow.startSso(address);
        if (result.kind === 'redirect') {
          if (!this.destroyRef.destroyed) window.location.assign(result.url);
          return undefined;
        }
        if (result.kind === 'no-sso') {
          const domain: string = (address.split('@')[1] ?? '').toLowerCase();
          return serverError(
            fields.email,
            $localize`:@@auth.sso.no-sso:No SSO is set up for “${domain}:domain:”: use another sign-in method.`,
          );
        }
        this.unavailable.set(true);
        return undefined;
      },
      onInvalid: (fields: FieldTree<{ email: string }>) => {
        focusFirstError(fields);
      },
    });
    focusFirstError(this.ssoForm);
  }
  // #endregion
}
