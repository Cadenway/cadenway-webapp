import { Component, input, type InputSignal, output, type OutputEmitterRef } from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import { NgIcon } from '@ng-icons/core';

import type { FederatedProvider } from '../../../models/session/session.interface';

/**
 * Component ProviderButtons
 *
 * @description
 * The two-by-two grid of social providers of `Main.dc.html` and `Inscription.dc.html` (Google,
 * GitHub, Microsoft, GitLab). It emits the chosen provider; the page starts the redirect. While
 * `busy`, the buttons are disabled.
 */
@Component({
  selector: 'cw-provider-buttons',
  imports: [CwButton, NgIcon],
  template: `
    <div class="grid grid-cols-2 gap-2">
      @for (provider of providers; track provider.id) {
        <button
          cwButton
          type="button"
          variant="outline"
          [disabled]="busy()"
          (click)="selected.emit(provider.id)"
        >
          <ng-icon [name]="provider.icon" aria-hidden="true" />
          {{ provider.label }}
        </button>
      }
    </div>
  `,
})
export class ProviderButtons {
  // #region Properties
  /**
   * Property busy
   *
   * @description
   * Disables the buttons while a sign-in is being prepared.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly busy: InputSignal<boolean> = input(false);

  /**
   * Property selected
   *
   * @description
   * The provider the person chose.
   *
   * @type {OutputEmitterRef<FederatedProvider>}
   * @readonly
   */
  public readonly selected: OutputEmitterRef<FederatedProvider> = output<FederatedProvider>();

  /**
   * Property providers
   *
   * @description
   * Providers in mockup order with their brand icon; brand names are not translated.
   *
   * @type {readonly { readonly id: FederatedProvider; readonly label: string; readonly icon: string }[]}
   * @readonly
   */
  protected readonly providers: readonly {
    readonly id: FederatedProvider;
    readonly label: string;
    readonly icon: string;
  }[] = [
    { id: 'google', label: 'Google', icon: 'svglGoogle' },
    { id: 'github', label: 'GitHub', icon: 'svglGithubLight' },
    { id: 'microsoft', label: 'Microsoft', icon: 'svglMicrosoft' },
    { id: 'gitlab', label: 'GitLab', icon: 'svglGitlab' },
  ];
  // #endregion
}
