import { Component, DestroyRef, inject, input, type InputSignal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CwAlert, CwAlertDescription } from '@cadenway/ui/components/alert';
import { CwButton } from '@cadenway/ui/components/button';
import { CwCard } from '@cadenway/ui/components/card';

import type { OrganizationEntry } from '../../../models/auth/auth.interface';
import type { AuthResult } from '../../../models/auth/auth.type';
import { OrganizationActionsStore } from '../../../state/organization-actions/organization-actions.store';

/**
 * Component WorkspaceEntryPage
 *
 * @description
 * Shows the server-verified current organization and entry links for private workspace features.
 */
@Component({
  selector: 'cw-workspace-entry-page',
  imports: [CwAlert, CwAlertDescription, CwButton, CwCard, RouterLink],
  providers: [OrganizationActionsStore],
  templateUrl: './workspace-entry-page.component.html',
})
export class WorkspaceEntryPage {
  // #region Properties
  /**
   * Property workspace
   *
   * @description
   * The resolver's outcome of proving the current workspace through the session.
   *
   * @type {InputSignal<AuthResult<OrganizationEntry>>}
   * @readonly
   */
  public readonly workspace: InputSignal<AuthResult<OrganizationEntry>> =
    input.required<AuthResult<OrganizationEntry>>();

  /**
   * Property actions
   *
   * @description
   * Coordinates session closure and displays failures without using private gateway messages.
   *
   * @type {InstanceType<typeof OrganizationActionsStore>}
   * @readonly
   */
  protected readonly actions: InstanceType<typeof OrganizationActionsStore> =
    inject(OrganizationActionsStore);

  /**
   * Property router
   *
   * @description
   * Retries the resolver or leaves the workspace when the session closes.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property destroyRef
   *
   * @description
   * Prevents an old sign-out request from redirecting a later page.
   *
   * @type {DestroyRef}
   * @readonly
   */
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  // #endregion

  // #region Methods
  /**
   * Method retry
   *
   * @description
   * Reloads the workspace resolver with the browser's current cookie.
   *
   * @returns {Promise<boolean>} Whether navigation completed.
   */
  protected retry(): Promise<boolean> {
    return this.router.navigateByUrl('/accueil', { onSameUrlNavigation: 'reload' });
  }

  /**
   * Method signOut
   *
   * @description
   * Returns to sign-in once the gateway no longer has an active session.
   *
   * @returns {Promise<void>} Resolves after handling the result.
   */
  protected async signOut(): Promise<void> {
    if ((await this.actions.signOut()) && !this.destroyRef.destroyed) {
      await this.router.navigateByUrl('/connexion', { replaceUrl: true });
    }
  }
  // #endregion
}
