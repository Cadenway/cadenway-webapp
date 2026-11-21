import {
  Component,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
  type Signal,
  type InputSignal,
  type OutputEmitterRef,
  type WritableSignal,
} from '@angular/core';
import { email, form, FormField, required, submit, type FieldTree } from '@angular/forms/signals';
import { CwButton } from '@cadenway/ui/components/button';
import { CwInput } from '@cadenway/ui/components/input';
import { NgIcon } from '@ng-icons/core';

import type { FederatedSignInRequest } from '../../../models/auth/auth.type';

/**
 * Component FederatedSignInForm
 *
 * @description
 * Offers the configured social providers and validates an enterprise email address.
 */
@Component({
  selector: 'cw-federated-sign-in-form',
  imports: [CwButton, CwInput, FormField, NgIcon],
  templateUrl: './federated-sign-in-form.component.html',
})
export class FederatedSignInForm {
  // #region Properties
  /**
   * Property rememberMe
   *
   * @description
   * The session duration preference selected on the sign-in screen.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly rememberMe: InputSignal<boolean> = input(false);

  /**
   * Property busy
   *
   * @description
   * Disables repeated submissions while the gateway starts a flow.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly busy: InputSignal<boolean> = input(false);

  /**
   * Property started
   *
   * @description
   * The provider and validated input selected by the caller.
   *
   * @type {OutputEmitterRef<FederatedSignInRequest>}
   * @readonly
   */
  public readonly started: OutputEmitterRef<FederatedSignInRequest> =
    output<FederatedSignInRequest>();

  /**
   * Property showSso
   *
   * @description
   * Whether the enterprise address form is visible.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly showSso: WritableSignal<boolean> = signal(false);

  /**
   * Property ssoEmail
   *
   * @description
   * The address input shown after choosing enterprise sign-in.
   *
   * @type {Signal<ElementRef<HTMLInputElement> | undefined>}
   * @readonly
   */
  private readonly ssoEmail: Signal<ElementRef<HTMLInputElement> | undefined> =
    viewChild<ElementRef<HTMLInputElement>>('ssoEmail');

  /**
   * Property ssoModel
   *
   * @description
   * Work address kept only for this form's lifetime.
   *
   * @type {WritableSignal<{ email: string }>}
   * @readonly
   */
  private readonly ssoModel: WritableSignal<{ email: string }> = signal({ email: '' });

  /**
   * Property ssoForm
   *
   * @description
   * Requires a valid work address before starting enterprise sign-in.
   *
   * @type {FieldTree<{ email: string }>}
   * @readonly
   */
  protected readonly ssoForm: FieldTree<{ email: string }> = form(this.ssoModel, (fields) => {
    required(fields.email);
    email(fields.email);
  });
  // #endregion

  // #region Methods
  /**
   * Method openSso
   *
   * @description
   * Opens enterprise sign-in and focuses its address field after rendering.
   */
  protected openSso(): void {
    this.showSso.set(true);
    requestAnimationFrame(() => this.ssoEmail()?.nativeElement.focus());
  }

  /**
   * Method selectProvider
   *
   * @description
   * Sends the social provider selected from the sign-in screen.
   *
   * @param {'google' | 'github' | 'microsoft' | 'gitlab'} provider - The selected provider.
   */
  protected selectProvider(provider: 'google' | 'github' | 'microsoft' | 'gitlab'): void {
    if (!this.busy()) this.started.emit({ provider, rememberMe: this.rememberMe() });
  }

  /**
   * Method submitSso
   *
   * @description
   * Sends the validated enterprise address to the page.
   *
   * @param {Event} event - The form submission.
   * @returns {Promise<void>} Resolves when the validated address has been emitted.
   */
  protected async submitSso(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.ssoForm, () => {
      if (!this.busy()) {
        this.started.emit({
          provider: 'saml',
          email: this.ssoModel().email.trim(),
          rememberMe: this.rememberMe(),
        });
      }
      return Promise.resolve(undefined);
    });
  }
  // #endregion
}
