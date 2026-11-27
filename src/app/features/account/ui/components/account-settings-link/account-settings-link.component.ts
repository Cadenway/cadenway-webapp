import { Component, computed, inject, type Signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

/**
 * Component AccountSettingsLink
 *
 * @description
 * The `My account` group closing the organization settings navigation (mockup
 * `Organisation.dc.html` lines 65-68): its heading and `Profile and security`, which opens
 * `/<slug>/account/security` (`goAccountSecurity`). It follows an organization switch in place
 * through the workspace port. It is a settings shell `settingsNavigation` contribution.
 */
@Component({
  selector: 'cw-account-settings-link',
  imports: [NgIcon, RouterLink],
  host: { class: 'contents' },
  template: `
    <div class="flex flex-col gap-px" role="group" aria-labelledby="account-settings-link-heading">
      <div
        id="account-settings-link-heading"
        class="flex h-8 items-center px-2 text-xs font-medium text-muted-foreground"
        i18n="@@account.navigation.heading"
      >
        My account
      </div>
      <a
        [routerLink]="link()"
        class="flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none focus-visible:ring-inset"
        data-testid="account-settings-link"
      >
        <ng-icon
          name="phosphorUserCircleBold"
          class="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <ng-container i18n="@@account.navigation.profile-and-security"
          >Profile and security</ng-container
        >
      </a>
    </div>
  `,
})
export class AccountSettingsLink {
  // #region Properties
  /**
   * Property workspace
   *
   * @description
   * Workspace context whose slug the link opens.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property link
   *
   * @description
   * Commands of the account's security section.
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  protected readonly link: Signal<readonly string[]> = computed((): readonly string[] => [
    '/',
    this.workspace.organization().slug,
    'account',
    'security',
  ]);
  // #endregion
}
